import {
  displayName,
  isDateDimension,
  type Additivity,
  type BusinessProcess,
  type DataType,
  type Dimension,
  type DimensionAttribute,
  type FactTableType,
  type Id,
  type KimballProject,
  type Measure,
} from './model';

/**
 * Physical star schema derived from the high-level design: one dimension table
 * per dimension (degenerate dimensions become fact columns) and one fact table
 * per business process. It is a starting point for the detailed design, built
 * with common Kimball conventions: integer surrogate keys, the business key kept
 * as an attribute, type 2 history columns, and one foreign key per role.
 */

export type ColumnRole =
  | 'surrogate-key'
  | 'business-key'
  | 'attribute'
  | 'history'
  | 'foreign-key'
  | 'degenerate'
  | 'measure';

/** Where the column's values come from in the design, for sample data and explanations. */
export type ColumnSource =
  | { kind: 'attribute'; attribute: DimensionAttribute }
  | { kind: 'measure'; measure: Measure }
  /** A calendar column; `attributeId` when it comes from an attribute in the design. */
  | { kind: 'date-part'; part: DatePart; attributeId?: Id }
  | { kind: 'usage'; dimensionId: Id; role: string | null }
  | { kind: 'degenerate'; dimensionId: Id }
  | { kind: 'generated'; purpose: 'name' | 'business-key' | 'effective-from' | 'effective-to' | 'current' | 'prior' | 'full-date' };

export type DatePart =
  | 'date'
  | 'day-of-week'
  | 'day-of-month'
  | 'week'
  | 'month-number'
  | 'month-name'
  | 'quarter'
  | 'year'
  | 'year-month'
  | 'weekend'
  | 'holiday'
  | 'fiscal-year'
  | 'fiscal-period';

export interface PhysicalColumn {
  name: string;
  role: ColumnRole;
  dataType: DataType;
  /** Decimal precision and scale, or text length. */
  size?: { precision: number; scale: number } | { length: number };
  nullable: boolean;
  /** Foreign key target. */
  references?: { table: string; column: string };
  source: ColumnSource;
  /** Short note for comments and the UI, e.g. "Order date role of Date". */
  note: string;
  additivity?: Additivity;
  /** Added by the generator (not in the design), e.g. a business key or a default name column. */
  added?: boolean;
}

export interface PhysicalTable {
  name: string;
  kind: 'dimension' | 'fact';
  /** Id of the dimension or business process. */
  sourceId: Id;
  /** Display name of the dimension or process. */
  label: string;
  columns: PhysicalColumn[];
  /** Dimension: the surrogate key column. */
  keyColumn?: string;
  /** Dimension: the business key columns. */
  businessKey?: string[];
  /** Dimension: keeps type 2 history (effective dates and a current-row flag). */
  scd2?: boolean;
  /** Dimension: a calendar dimension keyed by a yyyymmdd integer. */
  calendar?: boolean;
  /** Dimension: a junk dimension, one row per combination of its flags and codes. */
  junk?: boolean;
  /** Fact: grain statement and type. */
  grain?: string;
  factTableType?: FactTableType | null;
  description: string;
}

export interface PhysicalModel {
  tables: PhysicalTable[];
  /** Things the user should know, e.g. a process skipped because it has no dimensions. */
  notes: string[];
}

// ─── Naming ───

const TRANSLITERATE: Record<string, string> = { þ: 'th', ð: 'd', æ: 'ae', ø: 'o', ß: 'ss', œ: 'oe', ł: 'l', đ: 'd' };

/**
 * Words reserved in at least one supported dialect. Columns with these names
 * are prefixed with the table's subject (`group` → `customer_group`) instead of quoted.
 */
const RESERVED = new Set(
  (
    'all alter and any array as asc authorization between both by case cast check collate column constraint create cross ' +
    'current current_date current_time current_timestamp current_user default delete desc distinct do drop else end ' +
    'except exists false fetch for foreign from full grant group having ilike in index inner insert intersect into is ' +
    'join key lateral leading left like limit localtime localtimestamp natural not null of offset on only or order ' +
    'outer percent plan primary qualify references regexp right rlike row rows sample select session_user set some ' +
    'table tablesample then to top trailing trigger true union unique update user using values view when where ' +
    'window with ' +
    // SQL Server
    'add backup begin break browse bulk cascade checkpoint close clustered coalesce commit compute contains continue convert ' +
    'cursor database dbcc deallocate declare deny disk distributed double dump errlvl escape exec execute exit external file ' +
    'fillfactor function goto holdlock identity identitycol if kill lineno load merge national nocheck nonclustered nullif ' +
    'off offsets open option over pivot precision print proc procedure public raiserror read readtext reconfigure ' +
    'replication restore restrict return revert revoke rollback rowcount rowguidcol rule save schema securityaudit setuser ' +
    'shutdown statistics system_user textsize tran transaction truncate try_convert tsequal unpivot updatetext use varying ' +
    'waitfor while writetext ' +
    // Snowflake and PostgreSQL
    'account connect connection following gscluster increment issue minus organization start try_cast whenever ' +
    'analyse analyze asymmetric deferrable initially placing returning symmetric variadic'
  ).split(' '),
);

/** snake_case identifier: ASCII letters, digits and underscores, starting with a letter. */
export function sqlName(text: string, fallback = 'item'): string {
  const ascii = text
    .toLowerCase()
    .replace(/[þðæøßœłđ]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  let name = ascii
    .replace(/%/g, ' pct ')
    .replace(/#/g, ' number ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
    .replace(/_+$/, '');
  if (!name) name = fallback;
  if (/^[0-9]/.test(name)) name = `n_${name}`;
  return name;
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  for (let n = 2; used.has(candidate); n++) candidate = `${name}_${n}`;
  used.add(candidate);
  return candidate;
}

/** A column name that is unique in its table and never a reserved word. */
function columnName(text: string, subject: string, used: Set<string>, fallback = 'value'): string {
  let name = sqlName(text, fallback);
  if (RESERVED.has(name)) name = `${subject}_${name}`;
  return uniqueName(name, used);
}

// ─── Type inference ───

const BUSINESS_KEY = /(^|\b|_)(id|code|number|no|nr|num|key|sku|ean|upc|gtin|isbn|iban|ssn|kennitala)$/i;

/** Names ending in these words describe something, whatever else they mention ("Price reduction type"). */
const TEXT_SUFFIX = /\b(type|name|code|category|group|class|status|description|reason|band|tier|segment|method|mode|label|level)$/i;

export function inferAttributeType(name: string): DataType {
  if (TEXT_SUFFIX.test(name.trim())) return 'text';
  if (/\b(date|dob|birthday|since|opened|closed|hired|started|ended)\b/i.test(name) && !/\b(key|id|name|type)\b/i.test(name)) {
    return 'date';
  }
  if (/^(is|has|can|was)\b|\b(flag|indicator|yes\/no)\b/i.test(name)) return 'boolean';
  if (/\b(price|amount|rate|ratio|weight|percent|pct|share|latitude|longitude|lat|lng|cost|margin)\b|%/i.test(name)) return 'decimal';
  if (/\b(year|age|count|number of|quantity|size in|seats|floors|rank|level number|week number|day number)\b/i.test(name)) {
    return 'integer';
  }
  return 'text';
}

const INTEGER_UNIT =
  /\b(count|counts|units?|items?|pieces?|pcs|qty|quantity|number|seats|visits|views|clicks|sessions|people|users|members|events|orders|lines|tickets|transactions|days|nights|months)\b|#/i;
const DURATION = /\b(hours?|minutes?|mins?|seconds?|secs?|lag|duration|time to)\b/i;
const PERCENT = /%|\b(percent|pct|ratio|rate|share)\b/i;

export function inferMeasureType(measure: Measure): { dataType: DataType; precision: number; scale: number } {
  const text = `${measure.name} ${measure.unit}`;
  if (measure.dataType === 'integer') return { dataType: 'integer', precision: 0, scale: 0 };
  if (PERCENT.test(text)) return { dataType: 'decimal', precision: 9, scale: 4 };
  if (measure.dataType !== 'decimal' && INTEGER_UNIT.test(text) && !/\b(amount|value|cost|price|hours|minutes)\b/i.test(text)) {
    return { dataType: 'integer', precision: 0, scale: 0 };
  }
  if (/\b(currency|amount|price|cost|revenue|value|balance|fee|eur|usd|isk|gbp|dkk|sek|nok|\$|€|£)\b|[$€£]/i.test(text)) {
    return { dataType: 'decimal', precision: 18, scale: 2 };
  }
  if (DURATION.test(text)) return { dataType: 'decimal', precision: 12, scale: 2 };
  return { dataType: 'decimal', precision: 18, scale: 4 };
}

const DATE_PARTS: { match: RegExp; part: DatePart; dataType: DataType }[] = [
  { match: /^(the )?(calendar |full |actual )?date$/i, part: 'date', dataType: 'date' },
  { match: /fiscal.*(year)/i, part: 'fiscal-year', dataType: 'integer' },
  { match: /fiscal.*(period|month|week|quarter)/i, part: 'fiscal-period', dataType: 'text' },
  { match: /holiday/i, part: 'holiday', dataType: 'boolean' },
  { match: /weekend|weekday flag/i, part: 'weekend', dataType: 'boolean' },
  { match: /day.*week|weekday|day name/i, part: 'day-of-week', dataType: 'text' },
  { match: /day.*month|day number|^day$/i, part: 'day-of-month', dataType: 'integer' },
  { match: /week/i, part: 'week', dataType: 'integer' },
  { match: /year.?month|month.?year|period/i, part: 'year-month', dataType: 'text' },
  { match: /month.*(number|no)/i, part: 'month-number', dataType: 'integer' },
  { match: /month/i, part: 'month-name', dataType: 'text' },
  { match: /quarter/i, part: 'quarter', dataType: 'text' },
  { match: /year/i, part: 'year', dataType: 'integer' },
];

/** The calendar columns a date dimension gets when the design lists no attributes. */
const DEFAULT_DATE_PARTS: { name: string; part: DatePart; dataType: DataType }[] = [
  { name: 'day_of_week', part: 'day-of-week', dataType: 'text' },
  { name: 'day_of_month', part: 'day-of-month', dataType: 'integer' },
  { name: 'week_of_year', part: 'week', dataType: 'integer' },
  { name: 'month_number', part: 'month-number', dataType: 'integer' },
  { name: 'month_name', part: 'month-name', dataType: 'text' },
  { name: 'year_month', part: 'year-month', dataType: 'text' },
  { name: 'calendar_quarter', part: 'quarter', dataType: 'text' },
  { name: 'calendar_year', part: 'year', dataType: 'integer' },
  { name: 'is_weekend', part: 'weekend', dataType: 'boolean' },
];

const TEXT = (length: number) => ({ length });

// ─── Tables ───

function dimensionTable(dim: Dimension, tableName: string): PhysicalTable {
  const subject = sqlName(displayName(dim, 'dimension'), 'dimension');
  const used = new Set<string>();
  const columns: PhysicalColumn[] = [];
  const label = displayName(dim, 'Untitled dimension');
  const calendar = isDateDimension(dim) && dim.kind !== 'junk';
  const keyColumn = uniqueName(`${subject}_key`, used);
  columns.push({
    name: keyColumn,
    role: 'surrogate-key',
    dataType: 'integer',
    nullable: false,
    source: { kind: 'generated', purpose: 'business-key' },
    note: calendar ? 'Surrogate key in yyyymmdd form, e.g. 20250131' : 'Surrogate key: a meaningless integer the facts join on',
  });

  const attributes = dim.attributes.filter((a) => a.name.trim());
  const businessKey: string[] = [];
  let scd2 = false;

  if (calendar) {
    columns.push({
      name: uniqueName('full_date', used),
      role: 'business-key',
      dataType: 'date',
      nullable: false,
      source: { kind: 'generated', purpose: 'full-date' },
      note: 'The calendar date',
      added: true,
    });
    businessKey.push('full_date');
    if (attributes.length === 0) {
      for (const d of DEFAULT_DATE_PARTS) {
        columns.push({
          name: uniqueName(d.name, used),
          role: 'attribute',
          dataType: d.dataType,
          size: d.dataType === 'text' ? TEXT(20) : undefined,
          nullable: false,
          source: { kind: 'date-part', part: d.part },
          note: 'Standard calendar attribute',
          added: true,
        });
      }
    }
  } else {
    const explicit = attributes.filter((a) => a.businessKey);
    // Explicit business keys win; otherwise a name like "SKU number" or "Account id", or a
    // first attribute that never changes (type 0), such as an NPI.
    const byName = attributes.find((a) => BUSINESS_KEY.test(a.name.trim()));
    const byScd = attributes[0]?.scdType === 0 && inferAttributeType(attributes[0].name) === 'text' ? attributes[0] : undefined;
    const inferred = byName ?? byScd;
    const keys = explicit.length ? explicit : inferred ? [inferred] : [];
    if (keys.length === 0 && dim.kind !== 'junk') {
      const name = uniqueName(`${subject}_code`, used);
      columns.push({
        name,
        role: 'business-key',
        dataType: 'text',
        size: TEXT(50),
        nullable: false,
        source: { kind: 'generated', purpose: 'business-key' },
        note: 'Business key from the source system (added: the design lists none)',
        added: true,
      });
      businessKey.push(name);
    }
    for (const a of keys) {
      const name = columnName(a.name, subject, used);
      columns.push({
        name,
        role: 'business-key',
        dataType: a.dataType ?? 'text',
        size: (a.dataType ?? 'text') === 'text' ? TEXT(50) : undefined,
        nullable: false,
        source: { kind: 'attribute', attribute: a },
        note: a.description.trim() || 'Business key from the source system',
      });
      businessKey.push(name);
    }
    if (attributes.length === 0) {
      columns.push({
        name: uniqueName(`${subject}_name`, used),
        role: 'attribute',
        dataType: 'text',
        size: TEXT(100),
        nullable: false,
        source: { kind: 'generated', purpose: 'name' },
        note: 'Descriptive name (added: the design lists no attributes yet)',
        added: true,
      });
    }
  }

  for (const a of attributes) {
    if (columns.some((c) => c.source.kind === 'attribute' && c.source.attribute.id === a.id)) continue;
    const part = calendar ? DATE_PARTS.find((d) => d.match.test(a.name)) : undefined;
    // "Calendar date" in a date dimension is the full_date column already.
    if (part?.part === 'date') continue;
    const dataType = a.dataType ?? part?.dataType ?? inferAttributeType(a.name);
    const name = columnName(a.name, subject, used);
    columns.push({
      name,
      role: 'attribute',
      dataType,
      size: dataType === 'text' ? TEXT(part ? 20 : 100) : dataType === 'decimal' ? { precision: 18, scale: 4 } : undefined,
      nullable: !part,
      source: part && !a.sampleValues?.length ? { kind: 'date-part', part: part.part, attributeId: a.id } : { kind: 'attribute', attribute: a },
      note:
        [a.description.trim(), a.scdType != null && !calendar ? `SCD type ${a.scdType}` : ''].filter(Boolean).join(' · ') ||
        (part ? 'Calendar attribute' : ''),
    });
    if (a.scdType === 2) scd2 = true;
    if (a.scdType === 3) {
      columns.push({
        name: uniqueName(`prior_${name}`, used),
        role: 'history',
        dataType,
        size: dataType === 'text' ? TEXT(100) : undefined,
        nullable: true,
        source: { kind: 'generated', purpose: 'prior' },
        note: `Previous value of ${name} (SCD type 3)`,
        added: true,
      });
    }
  }

  if (scd2) {
    const history: [string, DataType, 'effective-from' | 'effective-to' | 'current', string][] = [
      ['row_effective_date', 'date', 'effective-from', 'First day this version of the row is valid (SCD type 2)'],
      ['row_expiration_date', 'date', 'effective-to', 'Last day this version is valid; 9999-12-31 while current'],
      ['is_current_row', 'boolean', 'current', 'True for the current version of each business key'],
    ];
    for (const [name, dataType, purpose, note] of history) {
      columns.push({ name: uniqueName(name, used), role: 'history', dataType, nullable: false, source: { kind: 'generated', purpose }, note, added: true });
    }
  }

  return {
    name: tableName,
    kind: 'dimension',
    sourceId: dim.id,
    label,
    columns,
    keyColumn,
    businessKey,
    scd2,
    calendar,
    junk: dim.kind === 'junk',
    description: dim.description.trim() || `${label} dimension`,
  };
}

/** Foreign key column name for a dimension role: "Order date" → order_date_key, "Bill-to" + Customer → bill_to_customer_key. */
function roleKeyName(role: string | null, subject: string): string {
  if (!role) return `${subject}_key`;
  const r = sqlName(role, subject);
  return `_${r}_`.includes(`_${subject}_`) ? `${r}_key` : `${r}_${subject}_key`;
}

function factTable(
  process: BusinessProcess,
  tableName: string,
  dims: Map<Id, { dimension: Dimension; table: PhysicalTable | null }>,
): PhysicalTable {
  const used = new Set<string>();
  const columns: PhysicalColumn[] = [];
  const subject = sqlName(displayName(process, 'fact'), 'fact');
  for (const usage of process.dimensions) {
    const entry = dims.get(usage.dimensionId);
    if (!entry) continue;
    const { dimension, table } = entry;
    const dimSubject = sqlName(displayName(dimension, 'dimension'), 'dimension');
    if (!table) {
      // Degenerate dimension: the identifier lives in the fact table itself.
      columns.push({
        name: columnName(displayName(dimension, 'reference'), subject, used),
        role: 'degenerate',
        dataType: 'text',
        size: TEXT(50),
        nullable: false,
        source: { kind: 'degenerate', dimensionId: dimension.id },
        note: `Degenerate dimension: ${displayName(dimension)}`,
      });
      continue;
    }
    const roles = usage.roles.length ? usage.roles : [null];
    for (const role of roles) {
      columns.push({
        name: uniqueName(roleKeyName(role, dimSubject), used),
        role: 'foreign-key',
        dataType: 'integer',
        nullable: false,
        references: { table: table.name, column: table.keyColumn! },
        source: { kind: 'usage', dimensionId: dimension.id, role },
        note: role ? `${role} (role of ${table.label})` : table.label,
      });
    }
  }
  for (const m of process.facts.filter((f) => f.name.trim())) {
    const t = inferMeasureType(m);
    columns.push({
      name: columnName(m.name, subject, used),
      role: 'measure',
      dataType: t.dataType,
      size: t.dataType === 'decimal' ? { precision: t.precision, scale: t.scale } : undefined,
      nullable: true,
      source: { kind: 'measure', measure: m },
      note: [m.additivity, m.unit.trim(), m.description.trim()].filter(Boolean).join(' · '),
      additivity: m.additivity,
    });
  }
  const label = displayName(process, 'Untitled process');
  return {
    name: tableName,
    kind: 'fact',
    sourceId: process.id,
    label,
    columns,
    grain: process.grain.trim(),
    factTableType: process.factTableType,
    description: process.description.trim() || `${label} fact table`,
  };
}

/** Derives the physical star schema. Pure: the same project always gives the same tables. */
export function physicalModel(project: KimballProject): PhysicalModel {
  const tableNames = new Set<string>();
  const notes: string[] = [];
  const dims = new Map<Id, { dimension: Dimension; table: PhysicalTable | null }>();
  const tables: PhysicalTable[] = [];

  for (const dim of project.dimensions) {
    if (dim.kind === 'degenerate') {
      dims.set(dim.id, { dimension: dim, table: null });
      continue;
    }
    const table = dimensionTable(dim, uniqueName(`dim_${sqlName(displayName(dim, 'dimension'), 'dimension')}`, tableNames));
    dims.set(dim.id, { dimension: dim, table });
    tables.push(table);
  }

  for (const p of project.processes) {
    const name = uniqueName(`fact_${sqlName(displayName(p, 'process'), 'process')}`, tableNames);
    const table = factTable(p, name, dims);
    if (!table.columns.some((c) => c.role === 'foreign-key' || c.role === 'degenerate')) {
      notes.push(`${table.label} has no dimensions yet, so its fact table has no keys. Add dimensions in phase 6.`);
    }
    tables.push(table);
  }

  if (project.processes.length === 0) notes.push('Add business processes to get fact tables.');
  return { tables, notes };
}

/** The design attribute a column was made from, if any. */
export function attributeIdOf(column: PhysicalColumn): Id | undefined {
  if (column.source.kind === 'attribute') return column.source.attribute.id;
  if (column.source.kind === 'date-part') return column.source.attributeId;
  return undefined;
}

export function factTables(model: PhysicalModel): PhysicalTable[] {
  return model.tables.filter((t) => t.kind === 'fact');
}

export function dimensionTables(model: PhysicalModel): PhysicalTable[] {
  return model.tables.filter((t) => t.kind === 'dimension');
}

export function tableByName(model: PhysicalModel, name: string): PhysicalTable | undefined {
  return model.tables.find((t) => t.name === name);
}

/** A process is ready to prototype when it has a grain, at least one dimension, and facts (or is factless). */
export function isReadyToBuild(process: BusinessProcess): boolean {
  return (
    process.grain.trim().length > 0 &&
    process.dimensions.length > 0 &&
    (process.facts.length > 0 || process.factTableType === 'factless')
  );
}
