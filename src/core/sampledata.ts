import { displayName, physicalSettings, type KimballProject, type PhysicalSettings, type SqlDialect } from './model';
import { physicalModel, type DatePart, type PhysicalColumn, type PhysicalModel, type PhysicalTable } from './physical';
import { csvCell } from './text';

/**
 * Made-up sample rows for the physical star schema, so the design can be explored
 * with data before anything is built. Deterministic: the same project and settings
 * always give the same rows. Values come from the attributes' `sampleValues` when
 * given (for example suggested by Claude), otherwise from name-based guesses.
 */

export type Cell = string | number | boolean | null;

export interface SampleTable {
  name: string;
  columns: string[];
  rows: Cell[][];
}

export interface SampleDataset {
  settings: PhysicalSettings;
  tables: Record<string, SampleTable>;
}

export const DEFAULT_FACT_ROWS = 1000;
export const MAX_SAMPLE_DAYS = 3660;
const FAR_FUTURE = '9999-12-31';

// ─── Random numbers ───

function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast and good enough for sample data. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const choose = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
const round = (n: number, decimals: number) => Number(n.toFixed(decimals));
/** Skewed towards the start of the range: a few customers and products account for many rows. */
const skewed = (rng: Rng, n: number) => Math.min(n - 1, Math.floor(Math.pow(rng(), 1.6) * n));

// ─── Dates ───

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const dateKey = (iso: string) => Number(iso.replace(/-/g, ''));

export function sampleDates(settings: PhysicalSettings): string[] {
  const from = toTime(settings.dateFrom);
  const to = Math.min(toTime(settings.dateTo), from + (MAX_SAMPLE_DAYS - 1) * DAY);
  const out: string[] = [];
  for (let t = from; t <= to; t += DAY) out.push(toIso(t));
  return out.length ? out : [settings.dateFrom];
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7);
}

/** Fixed-date public holidays common in Europe; enough to make a holiday flag interesting. */
const HOLIDAYS = new Set(['01-01', '05-01', '12-24', '12-25', '12-26', '12-31']);

function datePart(iso: string, part: DatePart, attributeName: string): Cell {
  const d = new Date(`${iso}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const q = Math.floor(m / 3) + 1;
  switch (part) {
    case 'date':
      return iso;
    case 'day-of-week':
      return WEEKDAYS[d.getUTCDay()]!;
    case 'day-of-month':
      return d.getUTCDate();
    case 'week':
      return isoWeek(d);
    case 'month-number':
      return m + 1;
    case 'month-name':
      return MONTHS[m]!;
    case 'quarter':
      return `Q${q}`;
    case 'year':
      return y;
    case 'year-month':
      return iso.slice(0, 7);
    case 'weekend':
      return d.getUTCDay() === 0 || d.getUTCDay() === 6;
    case 'holiday':
      return HOLIDAYS.has(iso.slice(5));
    case 'fiscal-year':
      return y;
    case 'fiscal-period': {
      const fy = `FY${String(y).slice(2)}`;
      if (/week/i.test(attributeName)) return `${fy} W${String(isoWeek(d)).padStart(2, '0')}`;
      if (/quarter/i.test(attributeName)) return `${fy} Q${q}`;
      return `${fy} P${String(m + 1).padStart(2, '0')}`;
    }
  }
}

// ─── Value pools ───

const FIRST = ['Anna', 'Jón', 'Sara', 'Ólafur', 'Maria', 'David', 'Emma', 'Lukas', 'Sofia', 'Noah', 'Elena', 'Omar', 'Ingrid', 'Kenji', 'Chloe', 'Mateo', 'Aisha', 'Henrik', 'Lea', 'Tomas'];
const LAST = ['Jónsdóttir', 'Smith', 'García', 'Müller', 'Hansen', 'Rossi', 'Novak', 'Kim', 'Silva', 'Dubois', 'Larsen', 'Nowak', 'Okafor', 'Sato', 'Stefánsson', 'Brown', 'Costa', 'Berg', 'Ali', 'Moreau'];
const CITIES = ['Reykjavík', 'Akureyri', 'Oslo', 'Copenhagen', 'Stockholm', 'Berlin', 'Amsterdam', 'Dublin', 'London', 'Lisbon', 'Madrid', 'Paris', 'Vienna', 'Warsaw', 'Prague', 'Helsinki'];
const COUNTRIES = ['Iceland', 'Norway', 'Denmark', 'Sweden', 'Germany', 'Netherlands', 'Ireland', 'United Kingdom', 'Portugal', 'Spain', 'France', 'Austria'];

/** Pools for common attribute words; the first match on the attribute name wins. */
const POOLS: [RegExp, string[]][] = [
  [/\bcity|town\b/i, CITIES],
  [/\bcountry|nation\b/i, COUNTRIES],
  [/\bregion|district|territory|area\b/i, ['North', 'South', 'East', 'West', 'Central']],
  [/\bsegment\b/i, ['Consumer', 'Small business', 'Mid-market', 'Enterprise']],
  [/\bstatus\b/i, ['Active', 'Inactive', 'Pending', 'Closed']],
  [/\btier|level|band\b/i, ['Gold', 'Silver', 'Bronze']],
  [/\bchannel\b/i, ['Store', 'Online', 'Mobile app', 'Partner', 'Phone']],
  [/\bcolou?r\b/i, ['Black', 'White', 'Red', 'Blue', 'Green', 'Grey']],
  [/\bsize\b/i, ['XS', 'S', 'M', 'L', 'XL']],
  [/\bpriority|urgency\b/i, ['Low', 'Medium', 'High', 'Urgent']],
  [/\bbrand\b/i, ['Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Litware', 'Proseware', 'Wingtip', 'Adventure Works']],
  [/\bcategory|class|group|family\b/i, ['Grocery', 'Household', 'Personal care', 'Beverages', 'Snacks', 'Frozen', 'Bakery', 'Dairy']],
  [/\bdepartment|division|team|unit\b/i, ['Fresh', 'Ambient', 'Non-food', 'Electronics', 'Home']],
  [/\bformat\b/i, ['Hypermarket', 'Supermarket', 'Convenience', 'Online']],
  [/\bindustry|sector\b/i, ['Retail', 'Manufacturing', 'Healthcare', 'Finance', 'Education', 'Technology', 'Logistics']],
  [/\bage\b/i, ['18–24', '25–34', '35–44', '45–54', '55–64', '65+']],
  [/\bjob|title|role|position|specialty\b/i, ['Cashier', 'Store manager', 'Shift lead', 'Stock clerk', 'Sales associate']],
  [/\bcurrency\b/i, ['EUR', 'USD', 'ISK', 'GBP', 'DKK']],
  [/\bcarrier|courier\b/i, ['Póstur', 'DHL', 'UPS', 'FedEx', 'Local courier']],
  [/\bmode|method\b/i, ['Standard', 'Express', 'Collect', 'Card', 'Cash', 'Mobile pay']],
  [/\bedition|plan\b/i, ['Free', 'Starter', 'Team', 'Business', 'Enterprise']],
  [/\bperiod|frequency|billing\b/i, ['Monthly', 'Quarterly', 'Yearly']],
  [/\bdecision|outcome|result\b/i, ['Approved', 'Denied', 'Pending']],
  [/\breason|cause\b/i, ['Price', 'Quality', 'No longer needed', 'Moved', 'Other']],
  [/\btype|kind\b/i, ['Type A', 'Type B', 'Type C', 'Type D']],
  [/\bgender|sex\b/i, ['Female', 'Male', 'Other', 'Unknown']],
];

const PRODUCT_ADJ = ['Classic', 'Organic', 'Fresh', 'Premium', 'Everyday', 'Mini', 'Family', 'Light'];
const PRODUCT_NOUN = ['Coffee', 'Yoghurt', 'Bread', 'Pasta', 'Shampoo', 'Detergent', 'Juice', 'Cheese', 'Crisps', 'Tea', 'Apples', 'Chocolate'];
const COMPANY_A = ['Nordic', 'Atlantic', 'Blue', 'Summit', 'Arctic', 'Green', 'Silver', 'Prime'];
const COMPANY_B = ['Foods', 'Supply', 'Trading', 'Logistics', 'Partners', 'Systems', 'Group', 'Labs'];
const SITE_SUFFIX = ['Centre', 'Mall', 'Harbour', 'North', 'South', 'Airport'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter', 'Weekend', 'Holiday', 'Back to school', 'Flash'];
const OFFERS = ['sale', 'deal', 'offer', 'discount', 'bundle'];

const PEOPLE = /customer|client|member|patient|subscriber|employee|staff|agent|cashier|person|user|provider|doctor|manager|contact|buyer|seller|rep\b/i;
const COMPANIES = /supplier|vendor|employer|company|organi[sz]ation|account|partner|carrier|manufacturer|payer|pharmacy/i;
const SITES = /store|location|branch|site|warehouse|shop|outlet|office|clinic|hospital/i;
const PRODUCTS = /product|item|sku|article|goods|drug|feature/i;
const PROMOS = /promotion|campaign|offer|coupon/i;

/** A distinct, readable name for row `i` of a dimension. */
function entityName(subject: string, i: number, rng: Rng): string {
  if (PEOPLE.test(subject) && !COMPANIES.test(subject)) return `${FIRST[(i * 7 + int(rng, 0, 19)) % 20]} ${LAST[(i * 3 + Math.floor(i / 20)) % 20]}`;
  if (COMPANIES.test(subject)) return `${COMPANY_A[i % 8]} ${COMPANY_B[Math.floor(i / 8) % 8]}${i >= 64 ? ` ${Math.floor(i / 64) + 1}` : ''}`;
  if (SITES.test(subject)) return `${CITIES[i % CITIES.length]} ${SITE_SUFFIX[Math.floor(i / CITIES.length) % SITE_SUFFIX.length]}${i >= 96 ? ` ${Math.floor(i / 96) + 1}` : ''}`;
  // Nouns change fastest so neighbouring rows differ; (5q + n) mod 8 keeps all 96 pairs distinct.
  if (PRODUCTS.test(subject)) return `${PRODUCT_ADJ[(5 * Math.floor(i / 12) + i) % 8]} ${PRODUCT_NOUN[i % 12]}${i >= 96 ? ` ${Math.floor(i / 96) + 1}` : ''}`;
  if (PROMOS.test(subject)) return `${SEASONS[i % 8]} ${OFFERS[Math.floor(i / 8) % 5]}${i >= 40 ? ` ${Math.floor(i / 40) + 1}` : ''}`;
  return `${subject.replace(/\b\w/g, (c) => c.toUpperCase())} ${i + 1}`;
}

function codePrefix(name: string): string {
  const word = name.split(/[_\s-]+/).find((w) => /[a-z]/i.test(w) && !/^(the|a|an)$/i.test(w)) ?? 'ID';
  return word.slice(0, 3).toUpperCase();
}

const pad = (n: number, width = 5) => String(n).padStart(width, '0');

function poolFor(attributeName: string): string[] | undefined {
  return POOLS.find(([re]) => re.test(attributeName))?.[1];
}

/** Value for an attribute column of row `i`. `level` is the row's index in a hierarchy, when the column is part of one. */
function attributeValue(col: PhysicalColumn, table: PhysicalTable, i: number, rng: Rng, level?: number): Cell {
  const attribute = col.source.kind === 'attribute' ? col.source.attribute : undefined;
  const name = attribute?.name ?? col.name.replace(/_/g, ' ');
  const samples = attribute?.sampleValues;
  if (samples?.length) {
    const nameLike = /name|description|title/i.test(name);
    const raw = level !== undefined ? samples[level % samples.length]! : nameLike ? samples[i % samples.length]! : choose(rng, samples);
    return typed(raw, col.dataType);
  }
  switch (col.dataType) {
    case 'boolean':
      return rng() < 0.3;
    case 'date':
      return toIso(toTime('2015-01-01') + int(rng, 0, 3650) * DAY);
    case 'integer':
      return /year/i.test(name) ? int(rng, 2010, 2025) : /age/i.test(name) ? int(rng, 18, 90) : int(rng, 1, 100);
    case 'decimal':
      return /lat/i.test(name) ? round(40 + rng() * 25, 5) : /lon|lng/i.test(name) ? round(-25 + rng() * 45, 5) : round(rng() * 100, 2);
    case 'text':
      break;
  }
  if (/e-?mail/i.test(name)) return `${FIRST[i % 20]!.toLowerCase()}.${pad(i + 1, 4)}@example.com`.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  if (/phone|mobile/i.test(name)) return `+354 555 ${pad(int(rng, 0, 9999), 4)}`;
  if (/(^|\s)(name|description|title)$/i.test(name) || name.toLowerCase() === table.label.toLowerCase()) {
    return entityName(`${table.label} ${name}`, i, rng);
  }
  if (/\b(id|code|number|no|sku|npi|ndc)\b/i.test(name)) return `${codePrefix(name)}-${pad(i + 1)}`;
  const pool = poolFor(name);
  if (pool) {
    if (level === undefined) return choose(rng, pool);
    return level < pool.length ? pool[level]! : `${pool[level % pool.length]} ${Math.floor(level / pool.length) + 1}`;
  }
  const letter = level ?? int(rng, 0, 4);
  return `${name.replace(/\b\w/, (c) => c.toUpperCase())} ${String.fromCharCode(65 + (letter % 26))}${letter >= 26 ? Math.floor(letter / 26) : ''}`;
}

function typed(raw: string, dataType: PhysicalColumn['dataType']): Cell {
  if (dataType === 'integer' || dataType === 'decimal') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (dataType === 'boolean') return /^(true|yes|y|1|ja|já)$/i.test(raw.trim());
  return raw;
}

// ─── Hierarchies ───

/**
 * Maps hierarchy levels to columns, so a drill-down stays consistent: every
 * brand belongs to one category. Levels are listed bottom first ("Product → Brand → Category").
 */
function hierarchyLevels(table: PhysicalTable, project: KimballProject): PhysicalColumn[][] {
  const dim = project.dimensions.find((d) => d.id === table.sourceId);
  if (!dim) return [];
  const out: PhysicalColumn[][] = [];
  for (const h of dim.hierarchies) {
    const levels = h
      .split(/\s*(?:→|->|>|\/|\|)\s*/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const cols = levels
      .map((level) =>
        table.columns.find(
          (c) =>
            c.role === 'attribute' &&
            c.source.kind === 'attribute' &&
            !c.source.attribute.sampleValues?.length &&
            (c.source.attribute.name.trim().toLowerCase() === level || c.name === level.replace(/\s+/g, '_')),
        ),
      )
      .filter((c): c is PhysicalColumn => !!c);
    if (cols.length >= 2) out.push(cols);
  }
  return out;
}

interface HierarchyPlan {
  cols: PhysicalColumn[];
  /** Members at the bottom level. */
  leaves: number;
  /** Children per parent at each level (bottom first). */
  fanout: number[];
}

/**
 * Sizes each level to its value pool: with 8 brands and 4 categories every
 * category gets two brands, so no level needs made-up suffixes.
 */
function planHierarchy(cols: PhysicalColumn[]): HierarchyPlan {
  const poolSize = (c: PhysicalColumn) => poolFor(c.source.kind === 'attribute' ? c.source.attribute.name : c.name)?.length;
  const top = cols.length - 1;
  let size = Math.min(4, poolSize(cols[top]!) ?? 4);
  const fanout = new Array<number>(cols.length).fill(1);
  for (let li = top - 1; li >= 0; li--) {
    fanout[li] = Math.max(1, Math.floor((poolSize(cols[li]!) ?? size * 3) / size));
    size *= fanout[li]!;
  }
  return { cols, leaves: size, fanout };
}

/** Position of a random member at every level of each hierarchy. */
function hierarchyPositions(plans: HierarchyPlan[], rng: Rng): Map<string, number> {
  const out = new Map<string, number>();
  for (const plan of plans) {
    let index = int(rng, 0, plan.leaves - 1);
    plan.cols.forEach((c, li) => {
      out.set(c.name, index);
      index = Math.floor(index / plan.fanout[li]!);
    });
  }
  return out;
}

// ─── Tables ───

interface Version {
  key: number;
  from: string;
  to: string;
}

interface DimData {
  table: SampleTable;
  /** Surrogate-key versions per member (one unless type 2 history). */
  members: Version[][];
}

export function defaultRows(table: PhysicalTable): number {
  if (table.kind === 'fact') {
    return table.factTableType === 'accumulating-snapshot' ? 500 : DEFAULT_FACT_ROWS;
  }
  const subject = `${table.label}`;
  if (PEOPLE.test(subject)) return 200;
  if (PRODUCTS.test(subject)) return 120;
  if (SITES.test(subject) || COMPANIES.test(subject)) return 30;
  if (table.columns.length <= 3) return 8;
  return 25;
}

export function rowCount(table: PhysicalTable, settings: PhysicalSettings): number {
  return settings.rows[table.sourceId] ?? defaultRows(table);
}

function calendarTable(table: PhysicalTable, dates: string[]): DimData {
  const rows = dates.map((iso) =>
    table.columns.map((c): Cell => {
      if (c.role === 'surrogate-key') return dateKey(iso);
      if (c.source.kind === 'generated' && c.source.purpose === 'full-date') return iso;
      if (c.source.kind === 'date-part') return datePart(iso, c.source.part, c.name);
      if (c.source.kind === 'attribute') {
        const a = c.source.attribute;
        if (a.sampleValues?.length) return typed(a.sampleValues[dateKey(iso) % a.sampleValues.length]!, c.dataType);
        return c.dataType === 'date' ? iso : c.dataType === 'boolean' ? false : `${a.name} ${iso.slice(0, 7)}`;
      }
      return null;
    }),
  );
  return { table: { name: table.name, columns: table.columns.map((c) => c.name), rows }, members: dates.map((iso) => [{ key: dateKey(iso), from: iso, to: iso }]) };
}

function memberTable(table: PhysicalTable, project: KimballProject, settings: PhysicalSettings, dates: string[]): DimData {
  const rng = random(hash32(`${settings.seed}:${table.name}`));
  const n = rowCount(table, settings);
  const hierarchies = hierarchyLevels(table, project);
  const historyCols = new Set(
    table.columns.filter((c) => c.source.kind === 'attribute' && c.source.attribute.scdType === 2).map((c) => c.name),
  );
  const rows: Cell[][] = [];
  const members: Version[][] = [];
  let key = 0;
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  const plans = hierarchies.map(planHierarchy);
  // Hierarchy columns change together when any of their levels keeps type 2 history.
  const movesWithHistory = new Set(hierarchies.filter((cols) => cols.some((c) => historyCols.has(c.name))).flat().map((c) => c.name));
  for (let i = 0; i < n; i++) {
    const levelOf = hierarchyPositions(plans, rng);
    const base: Cell[] = table.columns.map((c) => {
      if (c.role === 'business-key') {
        if (c.source.kind === 'attribute' && c.source.attribute.sampleValues?.length && n <= c.source.attribute.sampleValues.length) {
          return c.source.attribute.sampleValues[i]!;
        }
        return `${codePrefix(c.source.kind === 'attribute' ? c.source.attribute.name : table.label)}-${pad(i + 1)}`;
      }
      if (c.role === 'attribute') {
        if (c.source.kind === 'generated') return entityName(table.label, i, rng);
        return attributeValue(c, table, i, rng, levelOf.get(c.name));
      }
      return null;
    });
    const versions: Version[] = [];
    // A quarter of the members change once during the sample period (type 2 history).
    const changes = table.scd2 && historyCols.size > 0 && dates.length > 2 && rng() < 0.25;
    const changeAt = changes ? dates[int(rng, 1, dates.length - 1)]! : null;
    const spans: [string, string, boolean][] = changeAt
      ? [
          [first, toIso(toTime(changeAt) - DAY), false],
          [changeAt, FAR_FUTURE, true],
        ]
      : [[first, FAR_FUTURE, true]];
    spans.forEach(([from, to, current], vi) => {
      key += 1;
      // A changed member moves within its hierarchies as a whole (new brand → that brand's category).
      const moved = vi > 0 ? hierarchyPositions(plans, rng) : null;
      const row = table.columns.map((c, ci): Cell => {
        if (moved && movesWithHistory.has(c.name)) return attributeValue(c, table, i, rng, moved.get(c.name));
        if (c.role === 'surrogate-key') return key;
        if (c.source.kind === 'generated' && c.source.purpose === 'effective-from') return from;
        if (c.source.kind === 'generated' && c.source.purpose === 'effective-to') return to;
        if (c.source.kind === 'generated' && c.source.purpose === 'current') return current;
        if (c.source.kind === 'generated' && c.source.purpose === 'prior') return null;
        if (vi > 0 && historyCols.has(c.name)) {
          // The new version gets a different value for the attributes that keep history.
          let v = attributeValue(c, table, i, rng);
          for (let tries = 0; tries < 4 && v === base[ci]; tries++) v = attributeValue(c, table, i, rng);
          return v;
        }
        return base[ci] ?? null;
      });
      rows.push(row);
      versions.push({ key, from, to: to === FAR_FUTURE ? last : to });
    });
    members.push(versions);
  }
  return { table: { name: table.name, columns: table.columns.map((c) => c.name), rows }, members };
}

/** The version of a member that was valid on `iso`. */
function versionAt(versions: Version[], iso: string): number {
  return (versions.find((v) => v.from <= iso && iso <= v.to) ?? versions[versions.length - 1]!).key;
}

function measureValue(col: PhysicalColumn, rng: Rng, quantity: number, price: number): Cell {
  const m = col.source.kind === 'measure' ? col.source.measure : undefined;
  const name = `${m?.name ?? col.name} ${m?.unit ?? ''}`.toLowerCase();
  const integer = col.dataType === 'integer';
  if (m?.sampleRange) {
    const [lo, hi] = m.sampleRange;
    return integer ? int(rng, Math.ceil(lo), Math.floor(hi)) : round(lo + rng() * (hi - lo), 2);
  }
  const semi = col.additivity === 'semi-additive';
  if (/%|percent|pct|ratio|rate|share/.test(name)) return round(rng(), 4);
  if (/lag|duration|time to|hours|minutes|seconds/.test(name)) return integer ? int(rng, 1, 120) : round(0.5 + rng() * 72, 2);
  if (integer) {
    if (/quantity|units|qty/.test(name)) return semi ? int(rng, 0, 500) : quantity;
    if (/days/.test(name)) return int(rng, 0, 30);
    if (/seats|users|members|months/.test(name)) return semi ? int(rng, 1, 250) : int(rng, -3, 12);
    if (/count|events|views|clicks|sessions/.test(name)) return int(rng, 0, 50);
    return int(rng, 1, 20);
  }
  if (semi || /balance|mrr|premium|value at|on hand/.test(name)) return round(200 + rng() * 20_000, 2);
  const base = quantity * price;
  const share = (lo: number, hi: number) => round(base * (lo + rng() * (hi - lo)), 2);
  if (/discount|rebate|reduction|markdown/.test(name)) return rng() < 0.6 ? 0 : share(0.05, 0.25);
  if (/tax|vat/.test(name)) return share(0.1, 0.24);
  if (/cost/.test(name)) return share(0.55, 0.75);
  if (/margin|profit/.test(name)) return share(0.15, 0.4);
  if (/unit price|price/.test(name)) return round(price, 2);
  if (/allowed/.test(name)) return share(0.7, 0.95);
  if (/paid/.test(name)) return share(0.5, 0.85);
  if (/responsibility|copay|deductible/.test(name)) return share(0.05, 0.2);
  if (/change/.test(name)) return round((rng() < 0.3 ? -1 : 1) * (10 + rng() * 300), 2);
  return round(base, 2);
}

function factData(table: PhysicalTable, model: PhysicalModel, dims: Map<string, DimData>, settings: PhysicalSettings, dates: string[]): SampleTable {
  const rng = random(hash32(`${settings.seed}:${table.name}`));
  const n = rowCount(table, settings);
  const calendar = new Set(model.tables.filter((t) => t.calendar).map((t) => t.name));
  const monthEnds = dates.filter((iso, i) => i === dates.length - 1 || dates[i + 1]!.slice(5, 7) !== iso.slice(5, 7));
  const rows: Cell[][] = [];
  let group = 0;
  for (let r = 0; r < n; r++) {
    const snapshot = table.factTableType === 'periodic-snapshot';
    let dayIndex = snapshot ? dates.indexOf(choose(rng, monthEnds)) : int(rng, 0, dates.length - 1);
    const baseDate = dates[dayIndex]!;
    const quantity = 1 + Math.floor(Math.pow(rng(), 2) * 8);
    const price = 2 + Math.pow(rng(), 2) * 150;
    if (r === 0 || rng() < 0.4) group += 1;
    let firstDate = true;
    const row = table.columns.map((c): Cell => {
      if (c.role === 'foreign-key' && c.references) {
        if (calendar.has(c.references.table)) {
          // Later date roles (ship date after order date) follow the first one by a few days.
          if (!firstDate) dayIndex = Math.min(dates.length - 1, dayIndex + int(rng, 0, 6));
          firstDate = false;
          return dateKey(dates[dayIndex]!);
        }
        const dim = dims.get(c.references.table);
        if (!dim || dim.members.length === 0) return null;
        return versionAt(dim.members[skewed(rng, dim.members.length)]!, baseDate);
      }
      if (c.role === 'degenerate') {
        const id = table.factTableType === 'transaction' ? group : r + 1;
        return `${codePrefix(c.name)}-${pad(id, 6)}`;
      }
      if (c.role === 'measure') return measureValue(c, rng, quantity, price);
      return null;
    });
    rows.push(row);
  }
  return { name: table.name, columns: table.columns.map((c) => c.name), rows };
}

/** Generates sample rows for every table of the physical model. */
export function generateSampleData(project: KimballProject, model: PhysicalModel = physicalModel(project), settings: PhysicalSettings = physicalSettings(project)): SampleDataset {
  const dates = sampleDates(settings);
  const dims = new Map<string, DimData>();
  for (const t of model.tables.filter((x) => x.kind === 'dimension')) {
    dims.set(t.name, t.calendar ? calendarTable(t, dates) : memberTable(t, project, settings, dates));
  }
  const tables: Record<string, SampleTable> = {};
  for (const [name, d] of dims) tables[name] = d.table;
  for (const t of model.tables.filter((x) => x.kind === 'fact')) tables[t.name] = factData(t, model, dims, settings, dates);
  return { settings, tables };
}

// ─── Output ───

export function sqlLiteral(value: Cell, dialect: SqlDialect): string {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return dialect === 'sqlserver' ? (value ? '1' : '0') : value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  const text = value.replace(/'/g, "''");
  return dialect === 'sqlserver' ? `N'${text}'` : `'${text}'`;
}

/** INSERT statements for the sample data, in dependency order (dimensions first). */
export function seedScript(project: KimballProject, dataset: SampleDataset, dialect: SqlDialect, model: PhysicalModel = physicalModel(project)): string {
  const out = [
    `-- ${displayName(project.meta, 'Untitled project')}: sample data (made up, not real) for ${dialect === 'postgres' ? 'PostgreSQL' : dialect === 'sqlserver' ? 'SQL Server' : 'Snowflake'}`,
    `-- Seed ${dataset.settings.seed}, dates ${dataset.settings.dateFrom} to ${dataset.settings.dateTo}. Run after the CREATE TABLE script.`,
  ];
  const batch = 500;
  for (const t of [...model.tables.filter((x) => x.kind === 'dimension'), ...model.tables.filter((x) => x.kind === 'fact')]) {
    const data = dataset.tables[t.name];
    if (!data || data.rows.length === 0) continue;
    const identity = t.kind === 'dimension' && !t.calendar;
    out.push('', `-- ${t.name}: ${data.rows.length} rows`);
    if (identity && dialect === 'sqlserver') out.push(`SET IDENTITY_INSERT ${t.name} ON;`);
    for (let i = 0; i < data.rows.length; i += batch) {
      const rows = data.rows.slice(i, i + batch).map((row) => `  (${row.map((v) => sqlLiteral(v, dialect)).join(', ')})`);
      out.push(`INSERT INTO ${t.name} (${data.columns.join(', ')}) VALUES\n${rows.join(',\n')};`);
    }
    if (identity && dialect === 'sqlserver') out.push(`SET IDENTITY_INSERT ${t.name} OFF;`);
    if (identity && dialect === 'postgres' && t.keyColumn) {
      out.push(`SELECT setval(pg_get_serial_sequence('${t.name}', '${t.keyColumn}'), (SELECT max(${t.keyColumn}) FROM ${t.name}));`);
    }
  }
  return out.join('\n') + '\n';
}

export function tableToCsv(table: SampleTable): string {
  const cell = (v: Cell) => (v === null ? '' : typeof v === 'string' ? csvCell(v) : String(v));
  return '﻿' + [table.columns.join(','), ...table.rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}
