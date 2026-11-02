import { sqlType } from './ddl';
import { querySql } from './explore';
import {
  FACT_TABLE_TYPES,
  PRIORITIES,
  SQL_DIALECTS,
  displayName,
  optionLabel,
  physicalSettings,
  type KimballProject,
  type PhysicalSettings,
  type SqlDialect,
} from './model';
import { physicalModel, sqlName, type PhysicalColumn, type PhysicalModel, type PhysicalTable } from './physical';
import type { PrototypeFile } from './prototype';
import { SANDBOX_PORT } from './sandbox';
import { generateSampleData, type Cell, type SampleDataset, type SampleTable } from './sampledata';
import { requirementAnswers } from './traceability';
import { APP_VERSION } from './version';

/**
 * A dbt project for the physical model: one model per table with descriptions and
 * tests from the design, the sample rows as seeds so it runs against the Docker
 * sandbox as it is, and an analysis per answered requirement. It is the starting
 * point for the real build: swap the seeds for staging models and keep the tests.
 */

export interface DbtTest {
  test: 'unique' | 'not_null' | 'relationships';
  /** For relationships: the model and column the value must exist in. */
  to?: { model: string; field: string };
}

export interface DbtColumn {
  name: string;
  description: string;
  tests: DbtTest[];
}

export interface DbtModel {
  name: string;
  /** The seed with the sample rows the model reads. */
  seed: string;
  table: PhysicalTable;
  description: string;
  columns: DbtColumn[];
}

export const dbtSeedName = (table: string) => `sample_${table}`;

/** Jinja reads {{ }}, {% %} and {# #} anywhere in a dbt file, comments and descriptions included. */
export function escapeJinja(text: string): string {
  return text.replace(/\{[{%#]/g, (m) => `{{ '${m}' }}`);
}

/** One line of free text for a SQL comment or a description; YAML parsers reject control characters. */
const oneLine = (text: string) => escapeJinja(text.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ').trim());

function tableDescription(t: PhysicalTable): string {
  if (t.kind === 'fact') {
    const type = optionLabel(FACT_TABLE_TYPES, t.factTableType ?? null);
    return [t.description, t.grain ? `Grain: ${t.grain}` : 'Grain: not declared yet.', type ? `${type} fact table.` : ''].filter(Boolean).join(' ');
  }
  return [
    t.description,
    t.calendar ? 'A calendar: one row per day.' : '',
    t.junk ? 'Junk dimension: one row per combination of its flags and codes.' : '',
    t.scd2 ? 'Keeps type 2 history: one row per version.' : '',
    t.businessKey?.length ? `Business key: ${t.businessKey.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function columnTests(t: PhysicalTable, c: PhysicalColumn): DbtTest[] {
  switch (c.role) {
    case 'surrogate-key':
      return [{ test: 'unique' }, { test: 'not_null' }];
    case 'business-key':
      // One row per business key, unless the dimension keeps versions or the key has several columns.
      return t.businessKey?.length === 1 && !t.scd2 && !t.junk ? [{ test: 'unique' }, { test: 'not_null' }] : [{ test: 'not_null' }];
    case 'foreign-key':
      return c.references ? [{ test: 'not_null' }, { test: 'relationships', to: { model: c.references.table, field: c.references.column } }] : [{ test: 'not_null' }];
    case 'degenerate':
      return [{ test: 'not_null' }];
    case 'history':
      return c.nullable ? [] : [{ test: 'not_null' }];
    default:
      return [];
  }
}

/** The models and their tests, dimensions first. */
export function dbtModels(model: PhysicalModel): DbtModel[] {
  return model.tables.map((t) => ({
    name: t.name,
    seed: dbtSeedName(t.name),
    table: t,
    description: oneLine(tableDescription(t)),
    columns: t.columns.map((c) => ({ name: c.name, description: oneLine(c.note), tests: columnTests(t, c) })),
  }));
}

// ─── Files ───

/** YAML scalars as JSON strings: never read as yes/no/null, with the control characters JSON leaves raw escaped. */
const q = (s: string) => JSON.stringify(s).replace(/[\u007f-\u009f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

function modelSql(m: DbtModel): string {
  const t = m.table;
  const lines = [`-- ${m.name}: ${oneLine(t.label)}`];
  if (t.kind === 'fact' && t.grain) lines.push(`-- Grain: ${oneLine(t.grain)}`);
  lines.push(
    '--',
    `-- Reads the made-up sample rows for now (seeds/${m.seed}.csv). For the real build, select these`,
    '-- columns from your staging model instead; the tests in _models.yml still apply.',
  );
  if (t.kind === 'fact') {
    lines.push(
      "-- Look up each dimension's surrogate key by its business key (the current row of a type 2",
      '-- dimension), and use the Unknown row when there is no match, so no key is ever null.',
    );
  } else if (t.calendar) {
    lines.push('-- A calendar is generated, not loaded: one row per day from a date spine.');
  } else {
    if (t.scd2) {
      lines.push(
        '-- Type 2 history: take the versions from a dbt snapshot of the source. row_effective_date is',
        '-- dbt_valid_from as a date. dbt_valid_to is when the next version starts and null for the',
        '-- current one, so row_expiration_date is the day before it (9999-12-31 while current) and',
        '-- is_current_row is true where dbt_valid_to is null.',
      );
    }
    lines.push('-- Add an Unknown row (for example key -1) for facts that arrive without a match.');
  }
  lines.push('', 'select', t.columns.map((c) => `    ${c.name}`).join(',\n'), `from {{ ref('${m.seed}') }}`);
  return lines.join('\n') + '\n';
}

function modelsYml(models: DbtModel[]): string {
  const out = ['version: 2', '', 'models:'];
  for (const m of models) {
    out.push(`  - name: ${q(m.name)}`, `    description: ${q(m.description)}`, '    columns:');
    for (const c of m.columns) {
      out.push(`      - name: ${q(c.name)}`);
      if (c.description) out.push(`        description: ${q(c.description)}`);
      if (!c.tests.length) continue;
      out.push('        data_tests:');
      for (const t of c.tests) {
        if (t.test === 'relationships') {
          out.push('          - relationships:', '              arguments:', `                to: ${q(`ref('${t.to!.model}')`)}`, `                field: ${q(t.to!.field)}`);
        } else {
          out.push(`          - ${t.test}`);
        }
      }
    }
  }
  return out.join('\n') + '\n';
}

function projectYml(project: KimballProject, name: string, models: DbtModel[], dialect: SqlDialect): string {
  const out = [
    `# ${oneLine(displayName(project.meta, 'Untitled project'))}: dbt project generated by Kimball Designer ${APP_VERSION}.`,
    "# The models read the made-up sample rows in seeds/. For the real build, replace each ref('sample_…')",
    '# with your staging model and keep the tests.',
    `name: ${q(name)}`,
    'version: "1.0.0"',
    'config-version: 2',
    // Generic tests take their arguments under `arguments:` by default from 1.10.8.
    'require-dbt-version: ">=1.10.8"',
    `profile: ${q(name)}`,
    '',
    'model-paths: ["models"]',
    'seed-paths: ["seeds"]',
    'analysis-paths: ["analyses"]',
    'target-path: "target"',
    'clean-targets: ["target", "dbt_packages"]',
    '',
    'models:',
    `  ${q(name)}:`,
    '    +materialized: table',
    '',
    `# Column types for ${optionLabel(SQL_DIALECTS, dialect)}, the same as in the CREATE TABLE script.`,
    'seeds:',
    `  ${q(name)}:`,
    '    +quote_columns: false',
  ];
  for (const m of models) {
    out.push(`    ${q(m.seed)}:`, '      +column_types:');
    for (const c of m.table.columns) out.push(`        ${q(c.name)}: ${q(sqlType(c, dialect))}`);
  }
  return out.join('\n') + '\n';
}

function profilesYml(name: string, dialect: SqlDialect): string {
  const head = ['# Where dbt runs the project. dbt reads this file from the folder you run it in; or copy the', '# profile into ~/.dbt/profiles.yml.', `${q(name)}:`];
  if (dialect === 'postgres') {
    return [
      ...head,
      '  target: sandbox',
      '  outputs:',
      "    # The Docker sandbox of the prototype bundle (docker compose up -d in the bundle's folder).",
      '    sandbox:',
      '      type: postgres',
      '      host: "127.0.0.1"',
      `      port: ${SANDBOX_PORT}`,
      '      user: kimball',
      '      password: ""',
      '      dbname: kimball',
      '      schema: analytics',
      '      threads: 4',
      '',
    ].join('\n');
  }
  const env = (v: string, fallback?: string) => q(`{{ env_var('${v}'${fallback === undefined ? '' : `, '${fallback}'`}) }}`);
  const outputs =
    dialect === 'sqlserver'
      ? [
          '      type: sqlserver',
          '      driver: "ODBC Driver 18 for SQL Server"',
          `      server: ${env('DBT_SQLSERVER_HOST')}`,
          '      port: 1433',
          `      database: ${env('DBT_SQLSERVER_DATABASE')}`,
          '      schema: analytics',
          `      user: ${env('DBT_SQLSERVER_USER')}`,
          `      password: ${env('DBT_SQLSERVER_PASSWORD')}`,
          '      encrypt: true',
          '      trust_cert: false',
          '      threads: 4',
        ]
      : [
          '      type: snowflake',
          `      account: ${env('SNOWFLAKE_ACCOUNT')}`,
          `      user: ${env('SNOWFLAKE_USER')}`,
          '      # Key-pair sign-in: Snowflake is ending sign-ins with only a password.',
          `      private_key_path: ${env('SNOWFLAKE_PRIVATE_KEY_PATH')}`,
          `      private_key_passphrase: ${env('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE', '')}`,
          `      role: ${env('SNOWFLAKE_ROLE')}`,
          `      warehouse: ${env('SNOWFLAKE_WAREHOUSE')}`,
          `      database: ${env('SNOWFLAKE_DATABASE')}`,
          '      schema: analytics',
          '      threads: 4',
        ];
  return [...head, '  target: dev', '  outputs:', '    # Set the environment variables; never write passwords or keys into this file.', '    dev:', ...outputs, ''].join('\n');
}

function readme(project: KimballProject, name: string, dialect: SqlDialect, analyses: number): string {
  const adapter = { postgres: 'dbt-postgres', sqlserver: 'dbt-sqlserver', snowflake: 'dbt-snowflake' }[dialect];
  const where =
    dialect === 'postgres'
      ? `It runs against the Docker sandbox of the prototype bundle (PostgreSQL on 127.0.0.1:${SANDBOX_PORT}): start it first with \`docker compose up -d\` in the bundle's folder. dbt writes to the \`analytics\` schema.`
      : `\`profiles.yml\` reads the connection from environment variables; set them first. For the Docker sandbox, choose PostgreSQL in the prototype settings and generate the project again.`;
  return `# ${displayName(project.meta, 'Untitled project')}: dbt project

Generated by Kimball Designer ${APP_VERSION} for ${optionLabel(SQL_DIALECTS, dialect)}. The models and tests follow your design; the seeds are **made-up sample rows**, so you can run the whole project before any source is connected.

## Run it

You need Python and dbt 1.10.8 or later with the ${adapter} adapter (\`pip install ${adapter}\`). ${where}

\`\`\`bash
dbt debug          # checks the connection
dbt seed           # loads the sample rows
dbt run            # builds the dimension and fact models
dbt test           # keys are unique and not null, and every fact key exists in its dimension
dbt docs generate && dbt docs serve
\`\`\`

## Files

| File | What |
|---|---|
| \`dbt_project.yml\` | Project \`${name}\`: models as tables, seed column types for ${optionLabel(SQL_DIALECTS, dialect)} |
| \`profiles.yml\` | The connection |
| \`models/marts/*.sql\` | One model per dimension and fact table |
| \`models/marts/_models.yml\` | Descriptions from the design (grain, additivity, SCD) and the tests |
| \`seeds/sample_*.csv\` | The sample rows each model reads for now |
| \`analyses/*.sql\` | ${analyses ? `The saved query for each of the ${analyses} answered requirements; \`dbt compile\` writes the SQL to \`target/\`` : 'Empty: save the query that answers a requirement in the Prototype phase to get one here'} |

## Build it for real

1. Declare your sources and write a staging model per source table (\`models/staging/\`).
2. In each model, replace \`ref('sample_…')\` with the staging model and keep the column names.
3. Dimensions: generate the surrogate key, take type 2 history from a dbt snapshot, and add an Unknown row.
4. Facts: look up each surrogate key by the business key and use the Unknown row when nothing matches. Consider incremental models for large fact tables.
5. Delete the seeds, and keep and extend the tests.
`;
}

/** Every file of the dbt project, with paths relative to its root folder. */
export function dbtProjectFiles(
  project: KimballProject,
  settings: PhysicalSettings = physicalSettings(project),
  model: PhysicalModel = physicalModel(project),
  dataset: SampleDataset = generateSampleData(project, model, settings),
): PrototypeFile[] {
  const name = sqlName(displayName(project.meta, 'kimball'), 'kimball');
  const dialect = settings.dialect;
  const models = dbtModels(model);
  const files: PrototypeFile[] = [];
  const ref = (table: string) => `\u0000${table}\u0000`;
  const analyses = requirementAnswers(project, model)
    .filter((a) => a.query)
    .map((a) => {
      const r = a.requirement;
      const header = [`-- ${a.label} (${optionLabel(PRIORITIES, r.priority)}): ${r.statement}`, `-- ${a.description}`].map((l) => l.replace(/\s+/g, ' ').trim());
      // No closing semicolon: dbt wraps analyses in other SQL, e.g. for dbt show.
      const sql = escapeJinja([...header, querySql(model, a.query!, dialect, ref).replace(/;\s*$/, '')].join('\n')).replace(/\u0000(\w+)\u0000/g, "{{ ref('$1') }}");
      return { name: `analyses/${a.label.toLowerCase()}_${sqlName(r.statement, 'requirement').slice(0, 40).replace(/_+$/, '')}.sql`, data: sql + '\n' };
    });
  files.push(
    { name: 'README.md', data: readme(project, name, dialect, analyses.length) },
    { name: 'dbt_project.yml', data: projectYml(project, name, models, dialect) },
    { name: 'profiles.yml', data: profilesYml(name, dialect) },
    { name: 'models/marts/_models.yml', data: modelsYml(models) },
    ...models.map((m) => ({ name: `models/marts/${m.name}.sql`, data: modelSql(m) })),
    ...analyses,
  );
  for (const m of models) {
    const rows = dataset.tables[m.name];
    if (rows) files.push({ name: `seeds/${m.seed}.csv`, data: seedCsv(rows) });
  }
  return files;
}

/**
 * A seed is data, not a spreadsheet: no byte-order mark (dbt reads the header as column
 * names) and no formula guard, so "+354 555 4873" loads as it is.
 */
function seedCsv(table: SampleTable): string {
  const cell = (v: Cell) => (v === null ? '' : typeof v === 'string' && /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
  return [table.columns.join(','), ...table.rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}
