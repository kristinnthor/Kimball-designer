import { displayName, optionLabel, SQL_DIALECTS, type KimballProject, type SqlDialect } from './model';
import { physicalModel, type PhysicalColumn, type PhysicalModel, type PhysicalTable } from './physical';
import { APP_VERSION } from './version';

/**
 * CREATE TABLE scripts and index recommendations for the physical star schema,
 * in PostgreSQL, SQL Server or Snowflake flavour.
 */

export type IndexKind =
  | 'primary-key'
  | 'business-key'
  | 'foreign-key'
  | 'degenerate'
  | 'columnstore'
  | 'brin'
  | 'grain'
  | 'partition'
  | 'clustering'
  | 'search';

export interface IndexAdvice {
  table: string;
  kind: IndexKind;
  columns: string[];
  /** Statement to run. Comment-only text for advice that is a design choice, such as partitioning. */
  sql: string;
  /**
   * `table`: part of CREATE TABLE (keys); `now`: in the script; `later`: recommended once the
   * table is large or the grain is confirmed, included commented out.
   */
  when: 'table' | 'now' | 'later';
  why: string;
}

export interface DdlOptions {
  dialect: SqlDialect;
  /** Start with DROP TABLE IF EXISTS so the script can be re-run (facts first). */
  dropFirst?: boolean;
  model?: PhysicalModel;
}

// ─── Types and names ───

export function sqlType(column: PhysicalColumn, dialect: SqlDialect): string {
  const size = column.size;
  switch (column.dataType) {
    case 'text': {
      const n = size && 'length' in size ? size.length : 100;
      return dialect === 'sqlserver' ? `nvarchar(${n})` : `varchar(${n})`;
    }
    case 'integer':
      return dialect === 'sqlserver' ? 'int' : 'integer';
    case 'decimal': {
      const { precision, scale } = size && 'precision' in size ? size : { precision: 18, scale: 4 };
      return dialect === 'snowflake' ? `number(${precision},${scale})` : dialect === 'sqlserver' ? `decimal(${precision},${scale})` : `numeric(${precision},${scale})`;
    }
    case 'date':
      return 'date';
    case 'boolean':
      return dialect === 'sqlserver' ? 'bit' : 'boolean';
  }
}

/** FNV-1a, for short stable suffixes. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 5);
}

/** Constraint or index name, kept under PostgreSQL's 63-character limit. */
export function objectName(prefix: string, table: string, columns: string[] = []): string {
  const name = [prefix, table, ...columns].join('_');
  return name.length <= 60 ? name : `${name.slice(0, 53).replace(/_+$/, '')}_${hash(name)}`;
}

const comment = (text: string) => text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

// ─── Index advice ───

const dateKeys = (fact: PhysicalTable, model: PhysicalModel) =>
  fact.columns.filter((c) => c.role === 'foreign-key' && model.tables.find((t) => t.name === c.references?.table)?.calendar);

const keyColumns = (fact: PhysicalTable) => fact.columns.filter((c) => c.role === 'foreign-key' || c.role === 'degenerate');

const currentFlag = (dialect: SqlDialect) => (dialect === 'sqlserver' ? 'is_current_row = 1' : 'is_current_row');

function dimensionAdvice(table: PhysicalTable, dialect: SqlDialect): IndexAdvice[] {
  const out: IndexAdvice[] = [];
  const pk = table.keyColumn!;
  out.push({
    table: table.name,
    kind: 'primary-key',
    columns: [pk],
    sql: `CONSTRAINT ${objectName('pk', table.name)} PRIMARY KEY${dialect === 'sqlserver' ? ' CLUSTERED' : ''} (${pk})`,
    when: 'table',
    why:
      dialect === 'snowflake'
        ? 'Surrogate key. Snowflake records but does not enforce it; BI tools use it to suggest joins, so the load must keep it unique.'
        : `Surrogate key: every fact table joins on it${dialect === 'sqlserver' ? ', so it is the clustered index' : ''}.`,
  });
  const bk = table.businessKey ?? [];
  const attrs = table.columns.filter((c) => c.role === 'attribute').map((c) => c.name);
  if (dialect === 'snowflake') {
    if (bk.length) {
      out.push({
        table: table.name,
        kind: 'search',
        columns: bk,
        sql: `ALTER TABLE ${table.name} ADD SEARCH OPTIMIZATION ON EQUALITY(${bk.join(', ')});`,
        when: 'later',
        why: 'Only if you often look up single members by business key in a large dimension (Enterprise edition; costs credits). Snowflake has no B-tree indexes: micro-partition pruning does the rest.',
      });
    }
    return out;
  }
  const uniq = dialect === 'sqlserver' ? 'CREATE UNIQUE NONCLUSTERED INDEX' : 'CREATE UNIQUE INDEX';
  if (table.calendar) {
    out.push({
      table: table.name,
      kind: 'business-key',
      columns: bk,
      sql: `${uniq} ${objectName('ux', table.name, bk)} ON ${table.name} (${bk.join(', ')});`,
      when: 'now',
      why: 'One row per calendar day; lets loads and queries find a date key from a date.',
    });
  } else if (bk.length && table.scd2) {
    out.push(
      {
        table: table.name,
        kind: 'business-key',
        columns: bk,
        sql: `${uniq} ${objectName('ux', table.name, ['current'])} ON ${table.name} (${bk.join(', ')}) WHERE ${currentFlag(dialect)};`,
        when: 'now',
        why: 'Type 2 history: only one current row per business key. Fact loads use this index to find the current surrogate key.',
      },
      {
        table: table.name,
        kind: 'business-key',
        columns: [...bk, 'row_effective_date'],
        sql: `${uniq} ${objectName('ux', table.name, ['version'])} ON ${table.name} (${[...bk, 'row_effective_date'].join(', ')});`,
        when: 'now',
        why: 'One version per business key and start date; finds the version that was valid on a given day.',
      },
    );
  } else if (bk.length) {
    out.push({
      table: table.name,
      kind: 'business-key',
      columns: bk,
      sql: `${uniq} ${objectName('ux', table.name, bk)} ON ${table.name} (${bk.join(', ')});`,
      when: 'now',
      why: 'One row per business key: catches duplicate loads and makes the surrogate-key lookup during fact loads fast.',
    });
  } else if (attrs.length) {
    out.push({
      table: table.name,
      kind: 'business-key',
      columns: attrs,
      sql: `${uniq} ${objectName('ux', table.name, ['combination'])} ON ${table.name} (${attrs.join(', ')});`,
      when: 'now',
      why: 'A junk dimension holds each combination of flags and codes once.',
    });
  }
  return out;
}

function factAdvice(table: PhysicalTable, model: PhysicalModel, dialect: SqlDialect): IndexAdvice[] {
  const out: IndexAdvice[] = [];
  const fks = table.columns.filter((c) => c.role === 'foreign-key');
  const degenerate = table.columns.filter((c) => c.role === 'degenerate');
  const dates = dateKeys(table, model);
  const primaryDate = dates[0];
  for (const fk of fks) {
    out.push({
      table: table.name,
      kind: 'foreign-key',
      columns: [fk.name],
      sql: `CONSTRAINT ${objectName('fk', table.name, [fk.name])} FOREIGN KEY (${fk.name}) REFERENCES ${fk.references!.table} (${fk.references!.column})`,
      when: 'table',
      why:
        dialect === 'snowflake'
          ? 'Informational foreign key (not enforced); documents the star join for BI tools.'
          : 'Every fact row points to an existing dimension row. If constraints slow down large loads, check them in the load instead.',
    });
  }

  if (dialect === 'postgres') {
    for (const fk of fks) {
      out.push({
        table: table.name,
        kind: 'foreign-key',
        columns: [fk.name],
        sql: `CREATE INDEX ${objectName('ix', table.name, [fk.name])} ON ${table.name} (${fk.name});`,
        when: 'now',
        why: 'PostgreSQL does not index foreign keys by itself: one index per key speeds up joins and filters by each dimension.',
      });
    }
    for (const d of degenerate) {
      out.push({
        table: table.name,
        kind: 'degenerate',
        columns: [d.name],
        sql: `CREATE INDEX ${objectName('ix', table.name, [d.name])} ON ${table.name} (${d.name});`,
        when: 'now',
        why: 'Finds every row of one transaction or document (drill-through) by its degenerate dimension.',
      });
    }
    if (primaryDate) {
      out.push({
        table: table.name,
        kind: 'brin',
        columns: [primaryDate.name],
        sql: `CREATE INDEX ${objectName('brin', table.name, [primaryDate.name])} ON ${table.name} USING brin (${primaryDate.name});`,
        when: 'later',
        why: 'For millions of rows loaded in date order: a BRIN index is tiny and makes date-range scans fast. Use it instead of the B-tree index on the same column.',
      });
      out.push({
        table: table.name,
        kind: 'partition',
        columns: [primaryDate.name],
        sql: `-- Declare the table with PARTITION BY RANGE (${primaryDate.name}) and create one partition per year.`,
        when: 'later',
        why: 'Past roughly 100 million rows, partitions by date make archiving, reloading a period and date-filtered queries cheaper.',
      });
    }
  }

  if (dialect === 'sqlserver') {
    out.push({
      table: table.name,
      kind: 'columnstore',
      columns: [],
      sql: `CREATE CLUSTERED COLUMNSTORE INDEX ${objectName('cci', table.name)} ON ${table.name};`,
      when: 'now',
      why: 'The default for fact tables: compresses the data around ten times and runs aggregations in batch mode. With it, separate indexes per foreign key are usually unnecessary.',
    });
    if (primaryDate) {
      out.push({
        table: table.name,
        kind: 'foreign-key',
        columns: [primaryDate.name],
        sql: `CREATE NONCLUSTERED INDEX ${objectName('ix', table.name, [primaryDate.name])} ON ${table.name} (${primaryDate.name});`,
        when: 'later',
        why: 'Only if you often read a few days of detail rows. Loading in date order already lets the columnstore skip segments.',
      });
      out.push({
        table: table.name,
        kind: 'partition',
        columns: [primaryDate.name],
        sql: `-- Create a partition function and scheme on ${primaryDate.name} (for example one partition per year) and build the table on it.`,
        when: 'later',
        why: 'For very large tables: switch partitions in and out to load or archive a period in seconds.',
      });
    }
    for (const d of degenerate) {
      out.push({
        table: table.name,
        kind: 'degenerate',
        columns: [d.name],
        sql: `CREATE NONCLUSTERED INDEX ${objectName('ix', table.name, [d.name])} ON ${table.name} (${d.name});`,
        when: 'later',
        why: `Speeds up looking up one ${d.note.replace(/^Degenerate dimension: /, '')} at a time.`,
      });
    }
  }

  if (dialect === 'snowflake' && primaryDate) {
    out.push({
      table: table.name,
      kind: 'clustering',
      columns: [primaryDate.name],
      sql: `ALTER TABLE ${table.name} CLUSTER BY (${primaryDate.name});`,
      when: 'later',
      why: 'Only for very large tables (terabytes) filtered by date where pruning is poor. Automatic clustering costs credits; data loaded in date order is usually clustered already.',
    });
  }

  // A snapshot's grain is its keys: enforce it once the team agrees the list matches the grain statement.
  const keys = keyColumns(table).map((c) => c.name);
  const create = dialect === 'sqlserver' ? 'CREATE UNIQUE NONCLUSTERED INDEX' : 'CREATE UNIQUE INDEX';
  if (dialect !== 'snowflake' && keys.length > 0 && table.factTableType === 'periodic-snapshot') {
    out.push({
      table: table.name,
      kind: 'grain',
      columns: keys,
      sql: `${create} ${objectName('ux', table.name, ['grain'])} ON ${table.name} (${keys.join(', ')});`,
      when: 'later',
      why: `A periodic snapshot has one row per entity per period. Check these keys match the grain${table.grain ? ` ("${table.grain}")` : ''}, then make them unique.`,
    });
  }
  if (table.factTableType === 'accumulating-snapshot') {
    // Milestone dates change as the row is updated, so only an instance identifier can be the key.
    out.push(
      degenerate.length && dialect !== 'snowflake'
        ? {
            table: table.name,
            kind: 'grain',
            columns: degenerate.map((d) => d.name),
            sql: `${create} ${objectName('ux', table.name, ['grain'])} ON ${table.name} (${degenerate.map((d) => d.name).join(', ')});`,
            when: 'later',
            why: 'An accumulating snapshot has one row per process instance, updated as milestones happen. Make the instance identifier unique once you confirm it; loads update rows by it.',
          }
        : {
            table: table.name,
            kind: 'grain',
            columns: [],
            sql: '-- Add the order or case number as a degenerate dimension so each row can be found and updated.',
            when: 'later',
            why: 'An accumulating snapshot is updated as milestones happen, so each row needs a stable identifier, such as the order line number. The design has none yet.',
          },
    );
  }
  return out;
}

/** Index and key recommendations for every table, in script order. */
export function indexAdvice(model: PhysicalModel, dialect: SqlDialect): IndexAdvice[] {
  return model.tables.flatMap((t) => (t.kind === 'dimension' ? dimensionAdvice(t, dialect) : factAdvice(t, model, dialect)));
}

// ─── Script ───

function columnSql(table: PhysicalTable, c: PhysicalColumn, dialect: SqlDialect): string {
  const surrogate = c.role === 'surrogate-key' && !table.calendar;
  let type = sqlType(c, dialect);
  if (surrogate) {
    type =
      dialect === 'postgres'
        ? 'integer GENERATED BY DEFAULT AS IDENTITY'
        : dialect === 'sqlserver'
          ? 'int IDENTITY(1,1)'
          : 'integer AUTOINCREMENT';
  }
  return `${c.name} ${type}${c.nullable ? '' : ' NOT NULL'}`;
}

function tableSql(table: PhysicalTable, advice: IndexAdvice[], dialect: SqlDialect): string {
  const lines: { sql: string; note?: string }[] = table.columns.map((c) => ({ sql: columnSql(table, c, dialect), note: c.note }));
  for (const a of advice) if (a.table === table.name && a.when === 'table') lines.push({ sql: a.sql });
  const width = Math.min(48, Math.max(...lines.map((l) => l.sql.length)) + 1);
  const body = lines
    .map((l, i) => {
      const text = `  ${l.sql}${i < lines.length - 1 ? ',' : ''}`;
      return l.note ? `${text.padEnd(width + 3)} -- ${comment(l.note)}` : text;
    })
    .join('\n');
  const kind = table.kind === 'dimension' ? 'dimension' : 'facts';
  const generic = table.description === `${table.label} ${table.kind === 'dimension' ? 'dimension' : 'fact table'}`;
  const head: string[] = [`-- ${comment(table.label)} ${kind}${generic ? '' : `: ${comment(table.description)}`}`];
  if (table.grain) head.push(`-- Grain: ${comment(table.grain)}`);
  if (table.factTableType) head.push(`-- Type: ${table.factTableType.replace('-', ' ')} fact table`);
  if (table.scd2) head.push('-- History: type 2. A change adds a new row with new effective dates; facts keep the key that was current.');
  if (table.kind === 'fact' && !table.columns.some((c) => c.role === 'measure')) head.push('-- Factless: count rows to measure how often the event happened.');
  return `${head.join('\n')}\nCREATE TABLE ${table.name} (\n${body}\n);`;
}

/** The full CREATE TABLE script with keys, indexes, and the recommendations for later as comments. */
export function ddlScript(project: KimballProject, options: DdlOptions): string {
  const { dialect } = options;
  const model = options.model ?? physicalModel(project);
  const advice = indexAdvice(model, dialect);
  const dims = model.tables.filter((t) => t.kind === 'dimension');
  const facts = model.tables.filter((t) => t.kind === 'fact');
  const out: string[] = [
    `-- ${comment(displayName(project.meta, 'Untitled project'))}: star schema for ${optionLabel(SQL_DIALECTS, dialect)}`,
    `-- Generated by Kimball Designer ${APP_VERSION} from the high-level design. It is a starting point for`,
    '-- the detailed design: review names, data types, lengths and keys before you build.',
    `-- ${dims.length} dimension table${dims.length === 1 ? '' : 's'}, ${facts.length} fact table${facts.length === 1 ? '' : 's'}.`,
  ];
  if (dialect === 'snowflake') out.push('-- Snowflake records primary and foreign keys but does not enforce them, and has no indexes.');
  for (const note of model.notes) out.push(`-- Note: ${comment(note)}`);

  if (options.dropFirst && model.tables.length) {
    out.push('', '-- Drop in reverse dependency order so the script can be re-run.');
    for (const t of [...facts, ...dims]) out.push(`DROP TABLE IF EXISTS ${t.name};`);
  }

  if (dims.length) out.push('', '-- ═══ Dimensions ═══', ...dims.flatMap((t) => ['', tableSql(t, advice, dialect)]));
  if (facts.length) out.push('', '-- ═══ Facts ═══', ...facts.flatMap((t) => ['', tableSql(t, advice, dialect)]));

  // Grouped by table; consecutive items with the same reason share one comment.
  const section = (title: string, items: IndexAdvice[], commented: boolean) => {
    if (!items.length) return;
    out.push('', title);
    let table = '';
    let why = '';
    for (const a of items) {
      if (a.table !== table) {
        out.push('', `-- ${a.table}`);
        table = a.table;
        why = '';
      }
      if (a.why !== why) out.push(`-- ${comment(a.why)}`);
      why = a.why;
      out.push(commented && !a.sql.startsWith('--') ? `-- ${a.sql}` : a.sql);
    }
  };
  section('-- ═══ Indexes ═══', advice.filter((a) => a.when === 'now'), false);
  section('-- ═══ Recommended later (uncomment when it applies) ═══', advice.filter((a) => a.when === 'later'), true);
  return out.join('\n') + '\n';
}

/** Index recommendations as a Markdown document, grouped by table. */
export function indexAdviceToMarkdown(project: KimballProject, dialect: SqlDialect, model: PhysicalModel = physicalModel(project)): string {
  const advice = indexAdvice(model, dialect);
  const label = optionLabel(SQL_DIALECTS, dialect);
  const out = [
    `# Index and key recommendations: ${displayName(project.meta, 'Untitled project')}`,
    '',
    `For ${label}. *Now* is in the CREATE TABLE script; *later* is commented out there, to apply when the table is large or the grain is confirmed.`,
    '',
  ];
  for (const t of model.tables) {
    const rows = advice.filter((a) => a.table === t.name);
    if (!rows.length) continue;
    out.push(`## ${t.name}`, '', '| When | Columns | Why |', '|---|---|---|');
    for (const a of rows) {
      const when = a.when === 'table' ? 'now (table)' : a.when;
      const cols = a.columns.length ? a.columns.map((c) => `\`${c}\``).join(', ') : '*whole table*';
      out.push(`| ${when} | ${cols} | ${a.why.replace(/\|/g, '\\|')} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
