import type { Additivity, Aggregate, SqlDialect } from './model';
import type { PhysicalColumn, PhysicalModel, PhysicalTable } from './physical';
import { sqlLiteral, type Cell, type SampleDataset } from './sampledata';

/**
 * A tiny star-join query engine over the sample data: pick a fact table, a
 * measure and up to two dimension attributes to group by, and see the result
 * plus the SQL that would compute it in the warehouse.
 */

export const AGGREGATES: { value: Aggregate; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count', label: 'Count rows' },
];

/** A column to group or filter by: a dimension attribute reached through a fact key, or a degenerate column. */
export interface GroupBy {
  /** Foreign-key or degenerate column on the fact table. */
  column: string;
  /** Column in the dimension table; absent for degenerate columns. */
  attribute?: string;
}

export interface ExploreQuery {
  fact: string;
  /** Measure column, or null to count rows. */
  measure: string | null;
  aggregate: Aggregate;
  groupBy: GroupBy[];
  filter?: { by: GroupBy; value: string } | null;
  limit?: number;
}

export interface ExploreResult {
  headers: string[];
  rows: Cell[][];
  /** Number of groups before the limit. */
  groups: number;
  sql: string;
  /** Additivity warning, e.g. summing a balance across dates. */
  warning: string | null;
}

export interface GroupOption {
  key: string;
  label: string;
  /** Section in a picker, e.g. "Product" or "Order date". */
  section: string;
  by: GroupBy;
}

export const groupKey = (g: GroupBy) => (g.attribute ? `${g.column}.${g.attribute}` : g.column);

export function parseGroupKey(key: string): GroupBy {
  const [column, attribute] = key.split('.');
  return attribute ? { column: column!, attribute } : { column: column! };
}

const dimensionOf = (model: PhysicalModel, fk: PhysicalColumn) => model.tables.find((t) => t.name === fk.references?.table);

/** Every attribute the fact can be grouped by, through each of its keys. */
export function groupOptions(model: PhysicalModel, fact: PhysicalTable): GroupOption[] {
  const out: GroupOption[] = [];
  for (const c of fact.columns) {
    if (c.role === 'degenerate') {
      out.push({ key: c.name, label: c.name, section: c.note.replace(/^Degenerate dimension: /, ''), by: { column: c.name } });
    }
    if (c.role !== 'foreign-key') continue;
    const dim = dimensionOf(model, c);
    if (!dim) continue;
    const section = c.source.kind === 'usage' && c.source.role ? c.source.role : dim.label;
    for (const a of dim.columns) {
      if (a.role === 'surrogate-key' || (a.role === 'history' && a.name !== 'is_current_row')) continue;
      out.push({ key: groupKey({ column: c.name, attribute: a.name }), label: a.name, section, by: { column: c.name, attribute: a.name } });
    }
  }
  return out;
}

const PREFERRED_DATE: string[] = ['year-month', 'month-name', 'quarter', 'year', 'fiscal-period', 'day-of-week'];
const LOW_CARDINALITY = /category|segment|region|type|brand|channel|class|group|tier|department|format|status|country|specialty|plan|edition|industry|band/;

/** A good first attribute to group by: a month for dates, a category-like attribute otherwise. */
export function preferredAttribute(dim: PhysicalTable): string | undefined {
  const attrs = dim.columns.filter((c) => c.role === 'attribute' || c.role === 'business-key');
  if (dim.calendar) {
    for (const part of PREFERRED_DATE) {
      const hit = attrs.find((c) => c.source.kind === 'date-part' && c.source.part === part);
      if (hit) return hit.name;
    }
  }
  return (
    attrs.find((c) => c.role === 'attribute' && c.dataType === 'text' && LOW_CARDINALITY.test(c.name))?.name ??
    attrs.find((c) => c.role === 'attribute' && c.dataType === 'text')?.name ??
    attrs[0]?.name
  );
}

export function defaultAggregate(additivity: Additivity | undefined): Aggregate {
  return additivity === undefined ? 'count' : additivity === 'additive' ? 'sum' : 'avg';
}

/** Headline measures first: net or sales amounts and revenue, then any amount, then anything additive. */
const HEADLINE = [/net_.*amount|sales_amount|revenue|mrr|invoice_amount|billed|paid_amount/, /amount|value/];

/** A sensible first question for a fact table: its headline measure by its most useful attribute. */
export function defaultQuery(model: PhysicalModel, fact: PhysicalTable): ExploreQuery {
  const measures = fact.columns.filter((c) => c.role === 'measure');
  const additive = measures.filter((m) => m.additivity === 'additive');
  const measure = HEADLINE.map((re) => additive.find((m) => re.test(m.name))).find(Boolean) ?? additive[0] ?? measures[0];
  const fks = fact.columns.filter((c) => c.role === 'foreign-key');
  const nonDate = fks.find((c) => !dimensionOf(model, c)?.calendar) ?? fks[0];
  const groupBy: GroupBy[] = [];
  const dim = nonDate && dimensionOf(model, nonDate);
  const attribute = dim && preferredAttribute(dim);
  if (nonDate && attribute) groupBy.push({ column: nonDate.name, attribute });
  return { fact: fact.name, measure: measure?.name ?? null, aggregate: defaultAggregate(measure?.additivity), groupBy, limit: 20 };
}

function additivityWarning(model: PhysicalModel, fact: PhysicalTable, measure: PhysicalColumn | undefined, query: ExploreQuery): string | null {
  if (!measure || query.aggregate !== 'sum') return null;
  if (measure.additivity === 'non-additive') {
    return `${measure.name} is non-additive (a price, ratio or level), so a sum means nothing. Use average, minimum or maximum.`;
  }
  if (measure.additivity === 'semi-additive') {
    const byDate = query.groupBy.some((g) => {
      const fk = fact.columns.find((c) => c.name === g.column);
      return fk && dimensionOf(model, fk)?.calendar;
    });
    if (!byDate) {
      return `${measure.name} is semi-additive: adding it up across dates overstates it. Group by a date attribute, or use the average.`;
    }
  }
  return null;
}

const RESERVED_ALIASES = new Set(['as', 'at', 'by', 'do', 'f', 'if', 'in', 'is', 'of', 'on', 'or', 'to']);

function aliasFor(column: string, used: Set<string>): string {
  const base = column.replace(/_key$/, '').split('_').filter(Boolean).map((w) => w[0]).join('') || 'd';
  let alias = base;
  for (let n = 2; used.has(alias) || RESERVED_ALIASES.has(alias); n++) alias = `${base}${n}`;
  used.add(alias);
  return alias;
}

/** The SQL that computes the query in the warehouse. */
export function querySql(model: PhysicalModel, query: ExploreQuery, dialect: SqlDialect): string {
  const fact = model.tables.find((t) => t.name === query.fact);
  if (!fact) return '';
  const used = new Set<string>(['f']);
  const joins = new Map<string, { alias: string; dim: PhysicalTable; fk: PhysicalColumn }>();
  const ref = (g: GroupBy): string => {
    if (!g.attribute) return `f.${g.column}`;
    let j = joins.get(g.column);
    if (!j) {
      const fk = fact.columns.find((c) => c.name === g.column)!;
      j = { alias: aliasFor(g.column, used), dim: dimensionOf(model, fk)!, fk };
      joins.set(g.column, j);
    }
    return `${j.alias}.${g.attribute}`;
  };
  const groups = query.groupBy.map(ref);
  const filter = query.filter ? `${ref(query.filter.by)} = ${sqlLiteral(query.filter.value, dialect)}` : null;
  const measure = fact.columns.find((c) => c.name === query.measure);
  const valueAlias = measure && query.aggregate !== 'count' ? `${query.aggregate}_${measure.name}` : 'row_count';
  let value = 'COUNT(*)';
  if (measure && query.aggregate !== 'count') {
    const arg = dialect === 'sqlserver' && query.aggregate === 'avg' && measure.dataType === 'integer' ? `CAST(f.${measure.name} AS decimal(18,4))` : `f.${measure.name}`;
    value = `${query.aggregate.toUpperCase()}(${arg})`;
  }
  const limit = query.limit ?? 20;
  const select = [...groups, `${value} AS ${valueAlias}`];
  const lines = [`SELECT${dialect === 'sqlserver' ? ` TOP (${limit})` : ''}`, `  ${select.join(',\n  ')}`, `FROM ${fact.name} AS f`];
  for (const j of joins.values()) lines.push(`JOIN ${j.dim.name} AS ${j.alias} ON ${j.alias}.${j.dim.keyColumn} = f.${j.fk.name}`);
  if (filter) lines.push(`WHERE ${filter}`);
  if (groups.length) lines.push(`GROUP BY ${groups.join(', ')}`);
  lines.push(`ORDER BY ${valueAlias} DESC`);
  if (dialect !== 'sqlserver') lines.push(`LIMIT ${limit}`);
  return lines.join('\n') + ';';
}

const key = (v: Cell) => (v === null ? '\u0000' : String(v));

/** Runs the query over the sample data. */
export function runQuery(model: PhysicalModel, dataset: SampleDataset, query: ExploreQuery, dialect: SqlDialect): ExploreResult {
  const fact = model.tables.find((t) => t.name === query.fact);
  const data = dataset.tables[query.fact];
  const empty: ExploreResult = { headers: [], rows: [], groups: 0, sql: '', warning: null };
  if (!fact || !data) return empty;
  const col = (name: string) => data.columns.indexOf(name);

  // Lookup from each referenced dimension's surrogate key to its row.
  const lookups = new Map<string, { index: Map<Cell, Cell[]>; columns: string[] }>();
  const accessor = (g: GroupBy): ((row: Cell[]) => Cell) => {
    const fi = col(g.column);
    if (fi < 0) return () => null;
    if (!g.attribute) return (row) => row[fi] ?? null;
    const fk = fact.columns.find((c) => c.name === g.column);
    const dim = fk && dimensionOf(model, fk);
    const dimData = dim && dataset.tables[dim.name];
    if (!dim || !dimData) return () => null;
    let lookup = lookups.get(dim.name);
    if (!lookup) {
      const ki = dimData.columns.indexOf(dim.keyColumn!);
      lookup = { index: new Map(dimData.rows.map((r) => [r[ki] ?? null, r])), columns: dimData.columns };
      lookups.set(dim.name, lookup);
    }
    const ai = lookup.columns.indexOf(g.attribute);
    const index = lookup.index;
    return (row) => index.get(row[fi] ?? null)?.[ai] ?? null;
  };

  const groupers = query.groupBy.map(accessor);
  const filterGet = query.filter ? accessor(query.filter.by) : null;
  const measure = fact.columns.find((c) => c.name === query.measure);
  const mi = measure ? col(measure.name) : -1;
  const aggregate = measure ? query.aggregate : 'count';

  const acc = new Map<string, { values: Cell[]; sum: number; count: number; n: number; min: number; max: number }>();
  for (const row of data.rows) {
    if (filterGet && key(filterGet(row)) !== query.filter!.value) continue;
    const values = groupers.map((g) => g(row));
    const k = values.map(key).join('\u0001');
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { values, sum: 0, count: 0, n: 0, min: Infinity, max: -Infinity }));
    a.count += 1;
    const v = mi >= 0 ? row[mi] : null;
    if (typeof v === 'number') {
      a.sum += v;
      a.n += 1;
      a.min = Math.min(a.min, v);
      a.max = Math.max(a.max, v);
    }
  }

  const value = (a: { sum: number; count: number; n: number; min: number; max: number }): number | null => {
    switch (aggregate) {
      case 'count':
        return a.count;
      case 'sum':
        return Math.round(a.sum * 100) / 100;
      case 'avg':
        return a.n ? Math.round((a.sum / a.n) * 100) / 100 : null;
      case 'min':
        return a.n ? a.min : null;
      case 'max':
        return a.n ? a.max : null;
    }
  };
  const all = [...acc.values()].map((a) => [...a.values, value(a)] as Cell[]);
  all.sort((x, y) => Number(y[y.length - 1] ?? -Infinity) - Number(x[x.length - 1] ?? -Infinity) || key(x[0] ?? null).localeCompare(key(y[0] ?? null)));
  const limit = query.limit ?? 20;
  const valueHeader = measure && aggregate !== 'count' ? `${AGGREGATES.find((x) => x.value === aggregate)!.label} of ${measure.name}` : 'Rows';
  return {
    headers: [...query.groupBy.map((g) => g.attribute ?? g.column), valueHeader],
    rows: all.slice(0, limit),
    groups: all.length,
    sql: querySql(model, { ...query, aggregate }, dialect),
    warning: additivityWarning(model, fact, measure, query),
  };
}

/** Distinct values of a group-by column in the sample data, for a filter picker. */
export function distinctValues(model: PhysicalModel, dataset: SampleDataset, fact: string, by: GroupBy, max = 200): string[] {
  const result = runQuery(model, dataset, { fact, measure: null, aggregate: 'count', groupBy: [by], limit: max }, 'postgres');
  return result.rows.map((r) => (r[0] === null ? '' : String(r[0]))).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
