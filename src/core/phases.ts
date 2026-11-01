import { PHASE_IDS, type KimballProject, type PhaseId } from './model';
import { countBySeverity, validateProject } from './validate';

export type StageId = 'discover' | 'model' | 'deliver';

export interface StageDef {
  id: StageId;
  title: string;
  description: string;
}

export interface PhaseDef {
  id: PhaseId;
  number: number;
  stage: StageId;
  title: string;
  /** One-line goal shown under the title. */
  goal: string;
}

export const STAGES: StageDef[] = [
  { id: 'discover', title: 'Discover', description: 'Understand the business: scope, people and their questions.' },
  { id: 'model', title: 'Model', description: 'Apply the four-step design: process, grain, dimensions, facts.' },
  { id: 'deliver', title: 'Deliver', description: 'Review the bubble diagrams and bus matrix, then export.' },
];

export const PHASES: PhaseDef[] = [
  { id: 'kickoff', number: 1, stage: 'discover', title: 'Kickoff', goal: 'Agree on purpose, sponsor and scope.' },
  {
    id: 'stakeholders',
    number: 2,
    stage: 'discover',
    title: 'Stakeholders',
    goal: 'List who to interview and track the interviews.',
  },
  {
    id: 'requirements',
    number: 3,
    stage: 'discover',
    title: 'Requirements',
    goal: 'Capture the business questions and KPIs people need answered.',
  },
  {
    id: 'processes',
    number: 4,
    stage: 'model',
    title: 'Business processes',
    goal: 'Identify the business events that produce the measurements.',
  },
  { id: 'grain', number: 5, stage: 'model', title: 'Grain', goal: 'Declare exactly what one fact row represents.' },
  {
    id: 'dimensions',
    number: 6,
    stage: 'model',
    title: 'Dimensions',
    goal: 'Describe the who, what, where, when, why and how — and share them.',
  },
  { id: 'facts', number: 7, stage: 'model', title: 'Facts', goal: 'List the numeric measurements for each process.' },
  {
    id: 'bubbles',
    number: 8,
    stage: 'deliver',
    title: 'Bubble diagrams',
    goal: 'Review the high-level model of each business process.',
  },
  {
    id: 'matrix',
    number: 9,
    stage: 'deliver',
    title: 'Bus matrix',
    goal: 'See every process against the conformed dimensions.',
  },
  {
    id: 'review',
    number: 10,
    stage: 'deliver',
    title: 'Review & export',
    goal: 'Resolve findings and export the deliverables.',
  },
];

export function phaseDef(id: PhaseId): PhaseDef {
  return PHASES.find((p) => p.id === id)!;
}

export function nextPhase(id: PhaseId): PhaseId | null {
  const i = PHASE_IDS.indexOf(id);
  return PHASE_IDS[i + 1] ?? null;
}

export function previousPhase(id: PhaseId): PhaseId | null {
  const i = PHASE_IDS.indexOf(id);
  return i > 0 ? PHASE_IDS[i - 1]! : null;
}

export type PhaseState = 'not-started' | 'in-progress' | 'complete';

export interface PhaseStatus {
  id: PhaseId;
  state: PhaseState;
  done: number;
  total: number;
  /** Human-readable progress, e.g. "2 of 3 processes have a grain". */
  detail: string;
}

const filled = (s: string) => s.trim().length > 0;

function status(
  id: PhaseId,
  done: number,
  total: number,
  detail: string,
  complete = total > 0 && done >= total,
  started = done > 0,
): PhaseStatus {
  const state: PhaseState = complete ? 'complete' : started ? 'in-progress' : 'not-started';
  return { id, state, done, total, detail };
}

/**
 * How far along each phase is. Used by the UI stepper, the CLI `summary`
 * command and the skill to decide what to ask next. Pure and cheap.
 */
export function phaseStatus(project: KimballProject, id: PhaseId, errorCount?: number, warningCount?: number): PhaseStatus {
  const { meta, stakeholders, requirements, processes, dimensions } = project;
  if (id === 'review' && (errorCount === undefined || warningCount === undefined)) {
    const counts = countBySeverity(validateProject(project));
    errorCount = counts.error;
    warningCount = counts.warning;
  }
  const n = processes.length;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

  switch (id) {
    case 'kickoff': {
      const checks = [filled(meta.name), filled(meta.purpose), filled(meta.scopeIn)];
      const done = checks.filter(Boolean).length;
      return status(id, done, checks.length, `${done} of 3 essentials (name, purpose, scope)`);
    }
    case 'stakeholders': {
      const resolved = stakeholders.filter((s) => s.interviewStatus !== 'planned').length;
      const interviewed = stakeholders.filter((s) => s.interviewStatus === 'done').length;
      return status(
        id,
        resolved,
        stakeholders.length,
        stakeholders.length === 0 ? 'No stakeholders yet' : `${plural(stakeholders.length, 'stakeholder')}, ${interviewed} interviewed`,
        stakeholders.length > 0 && resolved === stakeholders.length && interviewed > 0,
        stakeholders.length > 0,
      );
    }
    case 'requirements': {
      const count = requirements.length;
      return status(id, count, Math.max(count, 1), count === 0 ? 'No requirements yet' : plural(count, 'requirement'));
    }
    case 'processes':
      return status(id, n, Math.max(n, 1), n === 0 ? 'No business processes yet' : plural(n, 'business process'));
    case 'grain': {
      const done = processes.filter((p) => filled(p.grain) && p.factTableType).length;
      return status(id, done, n, n === 0 ? 'Add business processes first' : `${done} of ${n} processes have a grain and type`);
    }
    case 'dimensions': {
      const done = processes.filter((p) => p.dimensions.length > 0).length;
      return status(id, done, n, n === 0 ? 'Add business processes first' : `${done} of ${n} processes have dimensions`);
    }
    case 'facts': {
      const done = processes.filter((p) => p.facts.length > 0 || p.factTableType === 'factless').length;
      return status(id, done, n, n === 0 ? 'Add business processes first' : `${done} of ${n} processes have facts`);
    }
    case 'bubbles': {
      const done = processes.filter((p) => p.dimensions.length > 0).length;
      return status(id, done, n, n === 0 ? 'Nothing to draw yet' : `${done} of ${n} diagrams ready`);
    }
    case 'matrix': {
      const used = dimensions.filter((d) => processes.some((p) => p.dimensions.some((u) => u.dimensionId === d.id))).length;
      return status(
        id,
        used,
        dimensions.length,
        dimensions.length === 0 ? 'No dimensions yet' : `${used} of ${dimensions.length} dimensions on the matrix`,
        n > 0 && dimensions.length > 0 && used === dimensions.length,
        dimensions.length > 0,
      );
    }
    case 'review': {
      errorCount ??= 0;
      warningCount ??= 0;
      const issues = errorCount + warningCount;
      return {
        id,
        state: n === 0 ? 'not-started' : issues === 0 ? 'complete' : 'in-progress',
        done: issues === 0 ? 1 : 0,
        total: 1,
        detail:
          n === 0
            ? 'Nothing to review yet'
            : issues === 0
              ? 'No errors or warnings'
              : `${plural(errorCount, 'error')}, ${plural(warningCount, 'warning')}`,
      };
    }
  }
}
