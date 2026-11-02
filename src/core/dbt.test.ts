import { describe, expect, it } from 'vitest';
import {
  dbtModels,
  dbtProjectFiles,
  escapeJinja,
  generateSampleData,
  loadExample,
  physicalModel,
  prototypeFiles,
  type KimballProject,
  type PrototypeFile,
  type SqlDialect,
} from './index';

const retail = (dialect: SqlDialect = 'postgres'): KimballProject => {
  const p = loadExample('retail', '2026-01-01T00:00:00.000Z');
  p.physical = { dialect, seed: 1, dateFrom: '2025-01-01', dateTo: '2025-01-31', rows: {} };
  return p;
};
const file = (files: PrototypeFile[], name: string) => {
  const f = files.find((x) => x.name === name);
  if (!f) throw new Error(`no ${name}`);
  return f.data;
};

/**
 * The YAML we write is a small, regular subset: two-space indents, keys that are words or
 * JSON strings, and values that are JSON, a plain word, or nothing (a nested block).
 */
function expectRegularYaml(text: string) {
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const m = line.match(/^((?: {2})*)(- )?(?:("(?:[^"\\]|\\.)*"|\+?[a-z_-]+):(?: (.*))?|([a-z_]+))$/);
    expect(m, line).not.toBeNull();
    const value = m![4];
    if (value === undefined || /^[a-z]+$/.test(value) || /^\d+$/.test(value)) continue;
    expect(() => JSON.parse(value), line).not.toThrow();
  }
}

/** RFC 4180 rows: quoted cells may hold commas, quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\r' && text[i + 1] === '\n') row.push(cell), rows.push(row), (row = []), (cell = ''), i++;
    else cell += ch;
  }
  return rows;
}

describe('dbt project', () => {
  it('has a model and a seed per table, the config, a profile and an analysis per answered requirement', () => {
    const p = retail();
    const files = dbtProjectFiles(p);
    const names = files.map((f) => f.name);
    for (const t of physicalModel(p).tables) {
      expect(names).toContain(`models/marts/${t.name}.sql`);
      expect(names).toContain(`seeds/sample_${t.name}.csv`);
    }
    expect(names).toEqual(expect.arrayContaining(['README.md', 'dbt_project.yml', 'profiles.yml', 'models/marts/_models.yml']));
    expect(names.filter((n) => n.startsWith('analyses/'))).toEqual([
      'analyses/r1_which_categories_and_brands_are_growing.sql',
      'analyses/r2_did_a_promotion_increase_sales_and_did_i.sql',
      'analyses/r6_how_long_do_online_orders_take_from_orde.sql',
    ]);
  });

  it('writes regular YAML', () => {
    for (const dialect of ['postgres', 'sqlserver', 'snowflake'] as const) {
      const files = dbtProjectFiles(retail(dialect));
      for (const name of ['dbt_project.yml', 'profiles.yml', 'models/marts/_models.yml']) expectRegularYaml(file(files, name));
    }
  });

  it('types the seeds for the dialect, the same as the CREATE TABLE script', () => {
    const pg = file(dbtProjectFiles(retail('postgres')), 'dbt_project.yml');
    expect(pg).toContain('name: "retail_analytics"');
    expect(pg).toContain('    "sample_fact_retail_sales":\n      +column_types:\n        "date_key": "integer"');
    expect(pg).toContain('"net_sales_amount": "numeric(18,2)"');
    expect(pg).toContain('+quote_columns: false');
    const ms = file(dbtProjectFiles(retail('sqlserver')), 'dbt_project.yml');
    expect(ms).toContain('"store_name": "nvarchar(100)"');
    expect(ms).toContain('"is_current_row": "bit"');
    expect(file(dbtProjectFiles(retail('snowflake')), 'dbt_project.yml')).toContain('"net_sales_amount": "number(18,2)"');
  });

  it('connects to the sandbox for PostgreSQL and reads other connections from the environment', () => {
    const pg = file(dbtProjectFiles(retail('postgres')), 'profiles.yml');
    expect(pg).toContain('"retail_analytics":\n  target: sandbox');
    expect(pg).toContain('port: 5433');
    const ms = file(dbtProjectFiles(retail('sqlserver')), 'profiles.yml');
    expect(ms).toContain('type: sqlserver');
    expect(ms).toContain(`password: "{{ env_var('DBT_SQLSERVER_PASSWORD') }}"`);
    const sf = file(dbtProjectFiles(retail('snowflake')), 'profiles.yml');
    expect(sf).toContain(`account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"`);
    // Snowflake is ending sign-ins with only a password.
    expect(sf).toContain(`private_key_path: "{{ env_var('SNOWFLAKE_PRIVATE_KEY_PATH') }}"`);
    expect(sf).toContain(`private_key_passphrase: "{{ env_var('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE', '') }}"`);
    expect(sf).not.toContain('password:');
  });

  it('needs the dbt version that reads test arguments by default', () => {
    expect(file(dbtProjectFiles(retail()), 'dbt_project.yml')).toContain('require-dbt-version: ">=1.10.8"');
    expect(file(dbtProjectFiles(retail()), 'README.md')).toContain('dbt 1.10.8 or later');
  });

  it('tests keys, business keys and every fact key against its dimension', () => {
    const yml = file(dbtProjectFiles(retail()), 'models/marts/_models.yml');
    expect(yml).toContain('      - name: "product_key"\n        description: "Surrogate key: a meaningless integer the facts join on"\n        data_tests:\n          - unique\n          - not_null');
    expect(yml).toContain(
      '      - name: "cashier_employee_key"\n        description: "Cashier (role of Employee)"\n        data_tests:\n          - not_null\n          - relationships:\n              arguments:\n                to: "ref(\'dim_employee\')"\n                field: "employee_key"',
    );
    const models = dbtModels(physicalModel(retail()));
    // A type 2 dimension has a row per version, so its business key repeats.
    const product = models.find((m) => m.name === 'dim_product')!;
    expect(product.columns.find((c) => c.name === 'sku_number')!.tests).toEqual([{ test: 'not_null' }]);
    const plain = models.filter((m) => m.table.kind === 'dimension' && !m.table.scd2 && !m.table.junk && m.table.businessKey?.length === 1);
    expect(plain.length).toBeGreaterThan(0);
    for (const m of plain) {
      expect(m.columns.find((c) => c.name === m.table.businessKey![0])!.tests, m.name).toEqual([{ test: 'unique' }, { test: 'not_null' }]);
    }
    const sales = models.find((m) => m.name === 'fact_retail_sales')!;
    expect(sales.description).toContain('Grain: One row per product scanned on a sales transaction line');
    expect(sales.columns.find((c) => c.name === 'pos_transaction_number')!.tests).toEqual([{ test: 'not_null' }]);
  });

  it('reads the seed in each model and explains the real build', () => {
    const files = dbtProjectFiles(retail());
    const dim = file(files, 'models/marts/dim_product.sql');
    expect(dim).toMatch(/select\n {4}product_key,\n {4}sku_number,[\s\S]*\nfrom \{\{ ref\('sample_dim_product'\) \}\}\n$/);
    expect(dim).toContain('dbt snapshot');
    expect(file(files, 'models/marts/dim_date.sql')).toContain('date spine');
    expect(file(files, 'models/marts/fact_retail_sales.sql')).toContain('-- Grain: One row per product scanned');
  });

  it('writes the requirement queries with ref() and without a closing semicolon', () => {
    const sql = file(dbtProjectFiles(retail('sqlserver')), 'analyses/r1_which_categories_and_brands_are_growing.sql');
    expect(sql).toContain("SELECT TOP (20)\n  p.category,\n  d.fiscal_week,");
    expect(sql).toContain("FROM {{ ref('fact_retail_sales') }} AS f\nJOIN {{ ref('dim_product') }} AS p ON p.product_key = f.product_key");
    expect(sql.trimEnd().endsWith(';')).toBe(false);
  });

  it('keeps user text from being read as Jinja', () => {
    expect(escapeJinja('Use {{ var }} and {% if %} and {# note #}')).toBe("Use {{ '{{' }} var }} and {{ '{%' }} if %} and {{ '{#' }} note #}");
    const p = retail();
    p.dimensions.find((d) => d.id === 'dm_store')!.description = 'Stores {{ evil }}';
    p.requirements[0]!.statement = 'Growth {% by %} week?';
    p.requirements[0]!.query!.filter = { column: { dimensionId: 'dm_store', attributeId: 'at_store_region' }, value: '{{ x }}' };
    const files = dbtProjectFiles(p);
    expect(file(files, 'models/marts/_models.yml')).toContain(`"Stores {{ '{{' }} evil }}`);
    const analysis = files.find((f) => f.name.startsWith('analyses/r1_'))!.data;
    expect(analysis).toContain("-- R1 (Must): Growth {{ '{%' }} by %} week?");
    expect(analysis).toContain("= '{{ '{{' }} x }}'");
    expect(analysis).toContain("{{ ref('fact_retail_sales') }}");
  });

  it('keeps control characters out of the YAML', () => {
    const p = retail();
    p.dimensions.find((d) => d.id === 'dm_store')!.description = 'Stores\u007f and\u0085 more\u0007';
    const yml = file(dbtProjectFiles(p), 'models/marts/_models.yml');
    expect(yml).toContain('"Stores and more');
    expect(yml).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
  });

  it('writes seed values as they are, without the spreadsheet formula guard', () => {
    const p = retail();
    const region = p.dimensions.find((d) => d.id === 'dm_store')!.attributes.find((a) => a.id === 'at_store_region')!;
    region.sampleValues = ['+354 555 4873', '-10%', '=North', '@home', 'East, "upper"'];
    const model = physicalModel(p);
    const data = generateSampleData(p, model, p.physical!);
    const table = data.tables.dim_store!;
    const parsed = parseCsv(file(dbtProjectFiles(p, p.physical, model, data), 'seeds/sample_dim_store.csv'));
    expect(parsed[0]).toEqual(table.columns);
    expect(parsed.slice(1)).toEqual(table.rows.map((r) => r.map((v) => (v === null ? '' : String(v)))));
    const regions = new Set(parsed.slice(1).map((r) => r[table.columns.indexOf('region')]));
    expect([...regions].some((v) => v.startsWith('+') || v.startsWith('-') || v.startsWith('=') || v.startsWith('@'))).toBe(true);
    expect([...regions].some((v) => v.startsWith("'"))).toBe(false);
  });

  it('writes seeds without a byte-order mark, with the table columns as the header', () => {
    const p = retail();
    const files = dbtProjectFiles(p);
    for (const t of physicalModel(p).tables) {
      const csv = file(files, `seeds/sample_${t.name}.csv`);
      expect(csv.charCodeAt(0)).not.toBe(0xfeff);
      expect(csv.split('\r\n')[0]).toBe(t.columns.map((c) => c.name).join(','));
    }
  });

  it('is part of the prototype bundle', () => {
    const names = prototypeFiles(retail()).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['dbt/dbt_project.yml', 'dbt/models/marts/fact_retail_sales.sql', 'dbt/seeds/sample_dim_date.csv']));
    expect(file(prototypeFiles(retail()), 'README.md')).toContain('| `dbt/` |');
  });
});
