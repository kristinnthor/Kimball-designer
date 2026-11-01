import {
  ID_PREFIX,
  PHASE_IDS,
  SCHEMA_URL,
  SCHEMA_VERSION,
  newId,
  type Additivity,
  type Assumption,
  type BusinessProcess,
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
  type Priority,
  type Requirement,
  type ScdType,
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
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s) => s.trim() !== '') : typeof v === 'string' && v.trim() ? [v] : [];
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const nullableOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(v as T) ? (v as T) : null;
const score = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
};
const id = (v: unknown, prefix: string): string => {
  const s = str(v).trim();
  return /^[A-Za-z0-9_.-]+$/.test(s) ? s : newId(prefix);
};

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

function normalizeRequirement(o: Obj): Requirement {
  return {
    id: id(o.id, ID_PREFIX.requirement),
    statement: str(o.statement),
    kpis: strList(o.kpis),
    priority: oneOf(o.priority, PRIORITY, 'should'),
    stakeholderIds: strList(o.stakeholderIds),
    processIds: strList(o.processIds),
    notes: str(o.notes),
  };
}

function normalizeMeasure(o: Obj): Measure {
  return {
    id: id(o.id, ID_PREFIX.measure),
    name: str(o.name),
    description: str(o.description),
    additivity: oneOf(o.additivity, ADDITIVITY, 'additive'),
    unit: str(o.unit),
  };
}

function normalizeUsage(v: unknown): DimensionUsage | null {
  // Accept a bare dimension id as shorthand.
  if (typeof v === 'string' && v.trim()) return { dimensionId: v.trim(), roles: [] };
  if (!isObj(v)) return null;
  const dimensionId = str(v.dimensionId).trim();
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
  return { id: id(v.id, ID_PREFIX.attribute), name: str(v.name), description: str(v.description), scdType: scd };
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
  return {
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
      createdAt: str(meta.createdAt) || now,
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
