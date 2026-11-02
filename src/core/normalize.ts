import {
  ID_PREFIX,
  PHASE_IDS,
  SAMPLE_ROWS_MAX,
  SCHEMA_URL,
  defaultPhysicalSettings,
  SCHEMA_VERSION,
  newId,
  type Additivity,
  type Aggregate,
  type Assumption,
  type BusinessProcess,
  type DataType,
  type Dimension,
  type DimensionAttribute,
  type DimensionKind,
  type DimensionUsage,
  type FactTableType,
  type InterviewStatus,
  type KimballProject,
  type Measure,
  type OpenQuestion,
  type PhaseId,
  type PhysicalSettings,
  type Priority,
  type QueryColumn,
  type Requirement,
  type RequirementQuery,
  type ScdType,
  type SqlDialect,
  type Stakeholder,
  type StakeholderType,
} from './model';

export class ProjectParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectParseError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Control characters other than tab and newlines are never meaningful and break SVG/XML exports. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(CONTROL, '') : typeof v === 'number' ? String(v) : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s) => s.trim() !== '') : typeof v === 'string' && v.trim() ? [v] : [];
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const nullableOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(v as T) ? (v as T) : null;
/** 1–5, or null when missing or below 1 (blank and 0 mean "not scored"). */
const score = (v: unknown): number | null => {
  const n = typeof v === 'string' ? (v.trim() ? Number(v) : NaN) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(5, Math.round(n)) : null;
};
/** Makes an id schema-safe deterministically, so references to it stay consistent. */
const safeId = (v: unknown): string => str(v).trim().replace(/[^A-Za-z0-9_.-]+/g, '_');
const id = (v: unknown, prefix: string): string => safeId(v) || newId(prefix);
const idList = (v: unknown): string[] => strList(v).map(safeId).filter(Boolean);

const STAKEHOLDER_TYPES = ['executive', 'business', 'analyst', 'it', 'other'] as const satisfies readonly StakeholderType[];
const INTERVIEW = ['planned', 'done', 'skipped'] as const satisfies readonly InterviewStatus[];
const PRIORITY = ['must', 'should', 'could', 'wont'] as const satisfies readonly Priority[];
const FACT_TYPES = [
  'transaction',
  'periodic-snapshot',
  'accumulating-snapshot',
  'factless',
] as const satisfies readonly FactTableType[];
const ADDITIVITY = ['additive', 'semi-additive', 'non-additive'] as const satisfies readonly Additivity[];
const DIM_KINDS = ['standard', 'date', 'degenerate', 'junk'] as const satisfies readonly DimensionKind[];
const DATA_TYPES = ['text', 'integer', 'decimal', 'date', 'boolean'] as const satisfies readonly DataType[];
const DIALECTS = ['postgres', 'sqlserver', 'snowflake'] as const satisfies readonly SqlDialect[];
const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count'] as const satisfies readonly Aggregate[];
/** The explorer groups by at most two columns. */
const QUERY_GROUPS_MAX = 2;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = (v: unknown): string | null => {
  const s = str(v).trim();
  return ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s) ? s : null;
};

/** Optional physical-design fields: copied only when valid, so files without them stay unchanged. */
function physicalAttributeFields(o: Obj): Pick<DimensionAttribute, 'dataType' | 'businessKey' | 'sampleValues'> {
  const out: Pick<DimensionAttribute, 'dataType' | 'businessKey' | 'sampleValues'> = {};
  const dataType = nullableOneOf(o.dataType, DATA_TYPES);
  if (dataType) out.dataType = dataType;
  if (o.businessKey === true) out.businessKey = true;
  const samples = [...new Set(strList(o.sampleValues))].slice(0, 500);
  if (samples.length) out.sampleValues = samples;
  return out;
}

function sampleRange(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [a, b] = v.map((x) => (typeof x === 'string' && x.trim() ? Number(x) : x));
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

function normalizePhysical(v: unknown, createdAt: string): PhysicalSettings | undefined {
  if (!isObj(v)) return undefined;
  const defaults = defaultPhysicalSettings(createdAt);
  const seed = typeof v.seed === 'number' && Number.isFinite(v.seed) ? Math.abs(Math.trunc(v.seed)) % 2 ** 31 : defaults.seed;
  let dateFrom = isoDate(v.dateFrom) ?? defaults.dateFrom;
  let dateTo = isoDate(v.dateTo) ?? defaults.dateTo;
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];
  const rows: Record<string, number> = {};
  if (isObj(v.rows)) {
    for (const [key, n] of Object.entries(v.rows)) {
      const k = safeId(key);
      const count = typeof n === 'string' && n.trim() ? Number(n) : n;
      if (k && typeof count === 'number' && Number.isFinite(count) && count >= 1) rows[k] = Math.min(SAMPLE_ROWS_MAX, Math.round(count));
    }
  }
  return { dialect: oneOf(v.dialect, DIALECTS, 'postgres'), seed, dateFrom, dateTo, rows };
}

function normalizeStakeholder(o: Obj): Stakeholder {
  return {
    id: id(o.id, ID_PREFIX.stakeholder),
    name: str(o.name),
    role: str(o.role),
    department: str(o.department),
    type: oneOf(o.type, STAKEHOLDER_TYPES, 'business'),
    interviewStatus: oneOf(o.interviewStatus, INTERVIEW, 'planned'),
    notes: str(o.notes),
  };
}

function queryColumn(v: unknown): QueryColumn | null {
  if (!isObj(v) || !safeId(v.dimensionId)) return null;
  const out: QueryColumn = { dimensionId: safeId(v.dimensionId) };
  const role = str(v.role).trim();
  if (role) out.role = role;
  if (safeId(v.attributeId)) out.attributeId = safeId(v.attributeId);
  else if (str(v.column).trim()) out.column = str(v.column).trim();
  return out;
}

/** A saved query, kept even when it no longer matches the design (validation reports that). */
function normalizeQuery(v: unknown): RequirementQuery | undefined {
  if (!isObj(v) || !safeId(v.processId)) return undefined;
  const measureId = safeId(v.measureId);
  const aggregate = oneOf(v.aggregate, AGGREGATES, measureId ? 'sum' : 'count');
  const query: RequirementQuery = {
    processId: safeId(v.processId),
    ...(measureId && aggregate !== 'count' ? { measureId } : {}),
    aggregate: measureId ? aggregate : 'count',
    groupBy: (Array.isArray(v.groupBy) ? v.groupBy : []).map(queryColumn).filter((c): c is QueryColumn => c !== null).slice(0, QUERY_GROUPS_MAX),
  };
  const filter = isObj(v.filter) ? queryColumn(v.filter.column) : null;
  if (filter && isObj(v.filter)) query.filter = { column: filter, value: str(v.filter.value) };
  return query;
}

function normalizeRequirement(o: Obj): Requirement {
  const requirement: Requirement = {
    id: id(o.id, ID_PREFIX.requirement),
    statement: str(o.statement),
    kpis: strList(o.kpis),
    priority: oneOf(o.priority, PRIORITY, 'should'),
    stakeholderIds: idList(o.stakeholderIds),
    processIds: idList(o.processIds),
    notes: str(o.notes),
  };
  const query = normalizeQuery(o.query);
  if (query) requirement.query = query;
  return requirement;
}

function normalizeMeasure(o: Obj): Measure {
  const measure: Measure = {
    id: id(o.id, ID_PREFIX.measure),
    name: str(o.name),
    description: str(o.description),
    additivity: oneOf(o.additivity, ADDITIVITY, 'additive'),
    unit: str(o.unit),
  };
  const dataType = nullableOneOf(o.dataType, ['integer', 'decimal'] as const);
  if (dataType) measure.dataType = dataType;
  const range = sampleRange(o.sampleRange);
  if (range) measure.sampleRange = range;
  return measure;
}

function normalizeUsage(v: unknown): DimensionUsage | null {
  // Accept a bare dimension id as shorthand.
  if (typeof v === 'string' && safeId(v)) return { dimensionId: safeId(v), roles: [] };
  if (!isObj(v)) return null;
  const dimensionId = safeId(v.dimensionId);
  return dimensionId ? { dimensionId, roles: strList(v.roles) } : null;
}

function normalizeProcess(o: Obj): BusinessProcess {
  return {
    id: id(o.id, ID_PREFIX.process),
    name: str(o.name),
    description: str(o.description),
    owner: str(o.owner),
    sourceSystems: strList(o.sourceSystems),
    grain: str(o.grain),
    factTableType: nullableOneOf(o.factTableType, FACT_TYPES),
    businessValue: score(o.businessValue),
    feasibility: score(o.feasibility),
    facts: list(o.facts).map(normalizeMeasure),
    dimensions: (Array.isArray(o.dimensions) ? o.dimensions : [])
      .map(normalizeUsage)
      .filter((u): u is DimensionUsage => u !== null),
  };
}

function normalizeAttribute(v: unknown): DimensionAttribute | null {
  if (typeof v === 'string' && v.trim()) return { id: newId(ID_PREFIX.attribute), name: v.trim(), description: '', scdType: null };
  if (!isObj(v)) return null;
  const scd = typeof v.scdType === 'number' && [0, 1, 2, 3].includes(v.scdType) ? (v.scdType as ScdType) : null;
  return { id: id(v.id, ID_PREFIX.attribute), name: str(v.name), description: str(v.description), scdType: scd, ...physicalAttributeFields(v) };
}

function normalizeDimension(o: Obj): Dimension {
  return {
    id: id(o.id, ID_PREFIX.dimension),
    name: str(o.name),
    kind: oneOf(o.kind, DIM_KINDS, 'standard'),
    description: str(o.description),
    attributes: (Array.isArray(o.attributes) ? o.attributes : [])
      .map(normalizeAttribute)
      .filter((a): a is DimensionAttribute => a !== null),
    hierarchies: strList(o.hierarchies),
  };
}

function normalizeAssumption(v: unknown): Assumption | null {
  if (typeof v === 'string') return v.trim() ? { id: newId(ID_PREFIX.assumption), text: v } : null;
  return isObj(v) ? { id: id(v.id, ID_PREFIX.assumption), text: str(v.text) } : null;
}

function normalizeQuestion(v: unknown): OpenQuestion | null {
  if (typeof v === 'string') return v.trim() ? { id: newId(ID_PREFIX.question), text: v, owner: '', status: 'open' } : null;
  if (!isObj(v)) return null;
  return {
    id: id(v.id, ID_PREFIX.question),
    text: str(v.text),
    owner: str(v.owner),
    status: v.status === 'answered' ? 'answered' : 'open',
  };
}

/**
 * Turns any parsed JSON value into a well-formed project, filling defaults and
 * dropping malformed entries. Unknown fields are not preserved.
 * Throws {@link ProjectParseError} when the input cannot be a project at all.
 */
export function normalizeProject(input: unknown, now: string = new Date().toISOString()): KimballProject {
  if (!isObj(input)) throw new ProjectParseError('A project file must contain a JSON object.');
  const version = str(input.schemaVersion);
  if (version && version.split('.')[0] !== SCHEMA_VERSION.split('.')[0]) {
    throw new ProjectParseError(
      `Unsupported schemaVersion "${version}". This version of Kimball Designer reads ${SCHEMA_VERSION}.`,
    );
  }
  const meta = isObj(input.meta) ? input.meta : {};
  const createdAt = str(meta.createdAt) || now;
  const physical = normalizePhysical(input.physical, createdAt);
  const project: KimballProject = {
    $schema: SCHEMA_URL,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: id(meta.id, ID_PREFIX.project),
      name: str(meta.name),
      purpose: str(meta.purpose),
      sponsor: str(meta.sponsor),
      scopeIn: str(meta.scopeIn),
      scopeOut: str(meta.scopeOut),
      successCriteria: strList(meta.successCriteria),
      currentPhase: oneOf<PhaseId>(meta.currentPhase, PHASE_IDS, 'kickoff'),
      createdAt,
      updatedAt: str(meta.updatedAt) || now,
    },
    stakeholders: list(input.stakeholders).map(normalizeStakeholder),
    requirements: list(input.requirements).map(normalizeRequirement),
    processes: list(input.processes).map(normalizeProcess),
    dimensions: list(input.dimensions).map(normalizeDimension),
    assumptions: (Array.isArray(input.assumptions) ? input.assumptions : [])
      .map(normalizeAssumption)
      .filter((a): a is Assumption => a !== null),
    openQuestions: (Array.isArray(input.openQuestions) ? input.openQuestions : [])
      .map(normalizeQuestion)
      .filter((q): q is OpenQuestion => q !== null),
  };
  if (physical) project.physical = physical;
  return project;
}

/** Parses project file text. Throws {@link ProjectParseError} with a readable message. */
export function parseProject(text: string): KimballProject {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new ProjectParseError(`The file is not valid JSON: ${(e as Error).message}`);
  }
  return normalizeProject(data);
}

/** Serialises a project with stable formatting (2-space indent, trailing newline). */
export function serializeProject(project: KimballProject): string {
  return JSON.stringify(project, null, 2) + '\n';
}

/** Returns a copy with `meta.updatedAt` set to now. */
export function touch(project: KimballProject, now: string = new Date().toISOString()): KimballProject {
  return { ...project, meta: { ...project.meta, updatedAt: now } };
}
