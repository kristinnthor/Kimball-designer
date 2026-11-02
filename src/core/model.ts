/**
 * Kimball Designer project model (schema v1).
 *
 * A project file (`*.kimball.json`) is the single source of truth shared by the
 * Claude skill, the CLI and the web UI. The bus matrix and the bubble diagrams
 * are derived from `processes[].dimensions[]` and never stored.
 */

export const SCHEMA_VERSION = '1.0' as const;
export const SCHEMA_URL =
  'https://raw.githubusercontent.com/kristinnthor/Kimball-designer/main/plugin/skills/kimball-designer/schema/kimball-project.schema.json';

export type Id = string;

export const PHASE_IDS = [
  'kickoff',
  'stakeholders',
  'requirements',
  'processes',
  'grain',
  'dimensions',
  'facts',
  'bubbles',
  'matrix',
  'review',
  'prototype',
] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export type StakeholderType = 'executive' | 'business' | 'analyst' | 'it' | 'other';
export type InterviewStatus = 'planned' | 'done' | 'skipped';
export type Priority = 'must' | 'should' | 'could' | 'wont';
export type FactTableType = 'transaction' | 'periodic-snapshot' | 'accumulating-snapshot' | 'factless';
export type Additivity = 'additive' | 'semi-additive' | 'non-additive';
export type DimensionKind = 'standard' | 'date' | 'degenerate' | 'junk';
export type ScdType = 0 | 1 | 2 | 3;
export type QuestionStatus = 'open' | 'answered';
/** Logical column type for the physical design; mapped to each SQL dialect's types. */
export type DataType = 'text' | 'integer' | 'decimal' | 'date' | 'boolean';
export type SqlDialect = 'postgres' | 'sqlserver' | 'snowflake';

export interface ProjectMeta {
  id: Id;
  name: string;
  purpose: string;
  sponsor: string;
  scopeIn: string;
  scopeOut: string;
  successCriteria: string[];
  currentPhase: PhaseId;
  createdAt: string;
  updatedAt: string;
}

export interface Stakeholder {
  id: Id;
  name: string;
  role: string;
  department: string;
  type: StakeholderType;
  interviewStatus: InterviewStatus;
  notes: string;
}

export interface Requirement {
  id: Id;
  /** A business question or need, in the stakeholder's words. */
  statement: string;
  kpis: string[];
  priority: Priority;
  stakeholderIds: Id[];
  processIds: Id[];
  notes: string;
}

export interface Measure {
  id: Id;
  name: string;
  description: string;
  additivity: Additivity;
  unit: string;
  /** Physical design (optional): integer or decimal. Inferred from the name and unit when absent. */
  dataType?: DataType;
  /** Range for prototype sample values, [min, max]. Inferred when absent. */
  sampleRange?: [number, number];
}

export interface DimensionUsage {
  dimensionId: Id;
  /** Role names for role-playing dimensions, e.g. ["Order date", "Ship date"]. Empty = single, unnamed role. */
  roles: string[];
}

export interface BusinessProcess {
  id: Id;
  name: string;
  description: string;
  owner: string;
  sourceSystems: string[];
  /** Grain statement, ideally "One row per …". */
  grain: string;
  factTableType: FactTableType | null;
  /** 1–5 */
  businessValue: number | null;
  /** 1–5 */
  feasibility: number | null;
  facts: Measure[];
  dimensions: DimensionUsage[];
}

export interface DimensionAttribute {
  id: Id;
  name: string;
  description: string;
  scdType: ScdType | null;
  /** Physical design (optional). Inferred from the name when absent. */
  dataType?: DataType;
  /** The business (natural) key from the source system, e.g. a customer number. */
  businessKey?: boolean;
  /** Realistic example values for prototype data, e.g. suggested by Claude and confirmed by the user. */
  sampleValues?: string[];
}

export interface Dimension {
  id: Id;
  name: string;
  kind: DimensionKind;
  description: string;
  attributes: DimensionAttribute[];
  hierarchies: string[];
}

export interface Assumption {
  id: Id;
  text: string;
}

export interface OpenQuestion {
  id: Id;
  text: string;
  owner: string;
  status: QuestionStatus;
}

/** Settings for the Prototype phase: the SQL dialect and how the sample data is generated. */
export interface PhysicalSettings {
  dialect: SqlDialect;
  /** Seed for the sample data, so the same settings always give the same rows. */
  seed: number;
  /** First and last day of the sample dates (YYYY-MM-DD). */
  dateFrom: string;
  dateTo: string;
  /** Sample rows per table, keyed by dimension or process id. Missing ids use the default. */
  rows: Record<Id, number>;
}

export interface KimballProject {
  $schema?: string;
  schemaVersion: typeof SCHEMA_VERSION;
  meta: ProjectMeta;
  stakeholders: Stakeholder[];
  requirements: Requirement[];
  processes: BusinessProcess[];
  dimensions: Dimension[];
  assumptions: Assumption[];
  openQuestions: OpenQuestion[];
  /** Prototype settings; absent until the user or Claude changes them. */
  physical?: PhysicalSettings;
}

// ─── Vocabularies (labels + explanations shared by UI, docs and exporters) ───

export interface Option<T extends string | number> {
  value: T;
  label: string;
  description: string;
}

export const STAKEHOLDER_TYPES: Option<StakeholderType>[] = [
  { value: 'executive', label: 'Executive', description: 'Sets direction and success measures; sponsors the program.' },
  { value: 'business', label: 'Business manager', description: 'Owns a business area and its decisions.' },
  { value: 'analyst', label: 'Analyst / power user', description: 'Builds reports and analyses today; knows the pain points.' },
  { value: 'it', label: 'IT / source owner', description: 'Knows the source systems, data quality and feasibility.' },
  { value: 'other', label: 'Other', description: 'Anyone else with useful context.' },
];

export const INTERVIEW_STATUSES: Option<InterviewStatus>[] = [
  { value: 'planned', label: 'Planned', description: 'Interview not held yet.' },
  { value: 'done', label: 'Done', description: 'Interview held and notes captured.' },
  { value: 'skipped', label: 'Skipped', description: 'Not needed or not possible.' },
];

export const PRIORITIES: Option<Priority>[] = [
  { value: 'must', label: 'Must', description: 'Required for the first release.' },
  { value: 'should', label: 'Should', description: 'Important but not critical for the first release.' },
  { value: 'could', label: 'Could', description: 'Desirable if time allows.' },
  { value: 'wont', label: "Won't (now)", description: 'Explicitly out of scope for now.' },
];

export const FACT_TABLE_TYPES: Option<FactTableType>[] = [
  {
    value: 'transaction',
    label: 'Transaction',
    description: 'One row per event at a point in time (an order line, a payment). The most common and most atomic type.',
  },
  {
    value: 'periodic-snapshot',
    label: 'Periodic snapshot',
    description: 'One row per entity per period (balance per account per month). Use for levels and status over time.',
  },
  {
    value: 'accumulating-snapshot',
    label: 'Accumulating snapshot',
    description:
      'One row per process instance, updated as milestones happen (order → ship → deliver). Has several date roles.',
  },
  {
    value: 'factless',
    label: 'Factless',
    description: 'Records that an event or coverage happened, with no numeric measure (attendance, promotion coverage).',
  },
];

export const ADDITIVITY: Option<Additivity>[] = [
  { value: 'additive', label: 'Additive', description: 'Can be summed across every dimension (amount, quantity).' },
  {
    value: 'semi-additive',
    label: 'Semi-additive',
    description: 'Can be summed across some dimensions but not time (balance, inventory on hand).',
  },
  {
    value: 'non-additive',
    label: 'Non-additive',
    description: 'Cannot be summed (unit price, ratio, percentage). Store the additive parts instead.',
  },
];

export const DIMENSION_KINDS: Option<DimensionKind>[] = [
  { value: 'standard', label: 'Standard', description: 'A regular descriptive dimension (Customer, Product).' },
  { value: 'date', label: 'Date / time', description: 'Calendar dimension; often role-playing (order date, ship date).' },
  {
    value: 'degenerate',
    label: 'Degenerate',
    description: 'A dimension key with no attributes kept in the fact table (order number, invoice number).',
  },
  { value: 'junk', label: 'Junk', description: 'A grouping of low-cardinality flags and indicators.' },
];

export const DATA_TYPES: Option<DataType>[] = [
  { value: 'text', label: 'Text', description: 'Names, codes and descriptions.' },
  { value: 'integer', label: 'Whole number', description: 'Counts, quantities, years.' },
  { value: 'decimal', label: 'Decimal', description: 'Amounts, rates and other numbers with decimals.' },
  { value: 'date', label: 'Date', description: 'A calendar date.' },
  { value: 'boolean', label: 'Yes / no', description: 'A flag or indicator.' },
];

export const SQL_DIALECTS: Option<SqlDialect>[] = [
  { value: 'postgres', label: 'PostgreSQL', description: 'PostgreSQL 13 or later. Also used by the Docker sandbox.' },
  { value: 'sqlserver', label: 'SQL Server', description: 'SQL Server 2016 or later, or Azure SQL.' },
  { value: 'snowflake', label: 'Snowflake', description: 'Snowflake. Constraints are informational; no indexes.' },
];

export const SCD_TYPES: Option<ScdType>[] = [
  { value: 0, label: 'Type 0', description: 'Retain original value; never changes.' },
  { value: 1, label: 'Type 1', description: 'Overwrite; no history kept.' },
  { value: 2, label: 'Type 2', description: 'Add a new row; full history kept.' },
  { value: 3, label: 'Type 3', description: 'Add a column for the prior value; limited history.' },
];

export function optionLabel<T extends string | number>(options: Option<T>[], value: T | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

// ─── Factories ───

let idCounter = 0;

/** Short, readable, collision-resistant id such as `bp_k3j9x2a1`. */
export function newId(prefix: string): Id {
  idCounter = (idCounter + 1) % 1296;
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `${prefix}_${rand}${idCounter.toString(36).padStart(2, '0')}`;
}

export const ID_PREFIX = {
  project: 'prj',
  stakeholder: 'sh',
  requirement: 'rq',
  process: 'bp',
  dimension: 'dm',
  measure: 'ms',
  attribute: 'at',
  assumption: 'as',
  question: 'oq',
} as const;

export function createProject(name = '', now: string = new Date().toISOString()): KimballProject {
  return {
    $schema: SCHEMA_URL,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: newId(ID_PREFIX.project),
      name,
      purpose: '',
      sponsor: '',
      scopeIn: '',
      scopeOut: '',
      successCriteria: [],
      currentPhase: 'kickoff',
      createdAt: now,
      updatedAt: now,
    },
    stakeholders: [],
    requirements: [],
    processes: [],
    dimensions: [],
    assumptions: [],
    openQuestions: [],
  };
}

export function createStakeholder(init: Partial<Stakeholder> = {}): Stakeholder {
  return {
    id: newId(ID_PREFIX.stakeholder),
    name: '',
    role: '',
    department: '',
    type: 'business',
    interviewStatus: 'planned',
    notes: '',
    ...init,
  };
}

export function createRequirement(init: Partial<Requirement> = {}): Requirement {
  return {
    id: newId(ID_PREFIX.requirement),
    statement: '',
    kpis: [],
    priority: 'should',
    stakeholderIds: [],
    processIds: [],
    notes: '',
    ...init,
  };
}

export function createProcess(init: Partial<BusinessProcess> = {}): BusinessProcess {
  return {
    id: newId(ID_PREFIX.process),
    name: '',
    description: '',
    owner: '',
    sourceSystems: [],
    grain: '',
    factTableType: null,
    businessValue: null,
    feasibility: null,
    facts: [],
    dimensions: [],
    ...init,
  };
}

export function createDimension(init: Partial<Dimension> = {}): Dimension {
  return {
    id: newId(ID_PREFIX.dimension),
    name: '',
    kind: 'standard',
    description: '',
    attributes: [],
    hierarchies: [],
    ...init,
  };
}

export function createMeasure(init: Partial<Measure> = {}): Measure {
  return { id: newId(ID_PREFIX.measure), name: '', description: '', additivity: 'additive', unit: '', ...init };
}

export function createAttribute(init: Partial<DimensionAttribute> = {}): DimensionAttribute {
  return { id: newId(ID_PREFIX.attribute), name: '', description: '', scdType: null, ...init };
}

export function createAssumption(text = ''): Assumption {
  return { id: newId(ID_PREFIX.assumption), text };
}

export function createOpenQuestion(init: Partial<OpenQuestion> = {}): OpenQuestion {
  return { id: newId(ID_PREFIX.question), text: '', owner: '', status: 'open', ...init };
}

export const SAMPLE_ROWS_MAX = 100_000;

/**
 * Default prototype settings: PostgreSQL and a full calendar year of sample dates,
 * the year before the project was created (so they never change by themselves).
 */
export function defaultPhysicalSettings(createdAt: string): PhysicalSettings {
  const created = Number(createdAt.slice(0, 4));
  const year = Number.isInteger(created) && created > 1900 ? created - 1 : 2025;
  return { dialect: 'postgres', seed: 1, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, rows: {} };
}

/** The project's prototype settings, or the defaults when it has none yet. */
export function physicalSettings(project: KimballProject): PhysicalSettings {
  return project.physical ?? defaultPhysicalSettings(project.meta.createdAt);
}

// ─── Lookups ───

export function dimensionById(project: KimballProject, id: Id): Dimension | undefined {
  return project.dimensions.find((d) => d.id === id);
}

export function processById(project: KimballProject, id: Id): BusinessProcess | undefined {
  return project.processes.find((p) => p.id === id);
}

/** Processes that use the given dimension. */
export function processesUsing(project: KimballProject, dimensionId: Id): BusinessProcess[] {
  return project.processes.filter((p) => p.dimensions.some((u) => u.dimensionId === dimensionId));
}

/**
 * A dimension is conformed (shared) when two or more business processes use it.
 * Degenerate dimensions live in the fact table itself, so they are never conformed.
 */
export function isConformedUsage(kind: DimensionKind | undefined, usageCount: number): boolean {
  return usageCount >= 2 && kind !== 'degenerate';
}

export function isConformed(project: KimballProject, dimensionId: Id): boolean {
  return isConformedUsage(dimensionById(project, dimensionId)?.kind, processesUsing(project, dimensionId).length);
}

export function isDateDimension(dimension: Dimension): boolean {
  return dimension.kind === 'date' || /\b(date|time|calendar|day|period|month)\b/i.test(dimension.name);
}

/** Business value × feasibility (1–25), or null when either score is missing. */
export function priorityScore(process: BusinessProcess): number | null {
  return process.businessValue != null && process.feasibility != null
    ? process.businessValue * process.feasibility
    : null;
}

/** Display name with a fallback for unnamed items. */
export function displayName(item: { name: string }, fallback = 'Untitled'): string {
  return item.name.trim() || fallback;
}
