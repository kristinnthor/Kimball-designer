import {
  displayName,
  isDateDimension,
  type Id,
  type KimballProject,
  type PhaseId,
} from './model';

export type Severity = 'error' | 'warning' | 'info';

export type TargetKind = 'project' | 'stakeholder' | 'requirement' | 'process' | 'dimension';

export interface Finding {
  /** Stable rule code, e.g. "KD101". See docs/METHODOLOGY.md. */
  code: string;
  severity: Severity;
  message: string;
  /** How to fix it, in coaching voice. */
  hint: string;
  /** The phase where the user fixes it. */
  phase: PhaseId;
  target: { kind: TargetKind; id?: Id };
}

export interface RuleInfo {
  code: string;
  severity: Severity;
  title: string;
}

export const RULES: RuleInfo[] = [
  { code: 'KD001', severity: 'error', title: 'Project has a name' },
  { code: 'KD002', severity: 'error', title: 'IDs are unique' },
  { code: 'KD003', severity: 'error', title: 'References point to existing items' },
  { code: 'KD101', severity: 'warning', title: 'Every process declares a grain' },
  { code: 'KD102', severity: 'warning', title: 'Every process has at least one dimension' },
  { code: 'KD103', severity: 'warning', title: 'Non-factless processes have at least one fact' },
  { code: 'KD104', severity: 'warning', title: 'Factless processes have no facts' },
  { code: 'KD105', severity: 'warning', title: 'Every dimension is used by a process' },
  { code: 'KD106', severity: 'warning', title: 'Every requirement is linked to a process' },
  { code: 'KD107', severity: 'warning', title: 'Names are unique' },
  { code: 'KD108', severity: 'warning', title: 'Every process has a date dimension' },
  { code: 'KD201', severity: 'info', title: 'Grain is phrased "One row per …"' },
  { code: 'KD202', severity: 'info', title: 'Dimension is used by a single process' },
  { code: 'KD203', severity: 'info', title: 'Accumulating snapshots have several date roles' },
  { code: 'KD204', severity: 'info', title: 'Planned interviews are not done yet' },
  { code: 'KD205', severity: 'info', title: 'Process has no value/feasibility score' },
];

export const GRAIN_PATTERN = /\b(one|a single|each)\s+(row|record|line)\s+(per|for each|for every|for)\b/i;

export function validateProject(project: KimballProject): Finding[] {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const { meta, stakeholders, requirements, processes, dimensions } = project;

  // KD001 — name
  if (!meta.name.trim()) {
    add({
      code: 'KD001',
      severity: 'error',
      message: 'The project has no name.',
      hint: 'Give the project a short name the sponsor would recognise, e.g. "Retail analytics".',
      phase: 'kickoff',
      target: { kind: 'project' },
    });
  }

  // KD002 — unique ids across the whole file
  const seen = new Map<string, number>();
  const allIds: string[] = [
    meta.id,
    ...stakeholders.map((s) => s.id),
    ...requirements.map((r) => r.id),
    ...processes.map((p) => p.id),
    ...processes.flatMap((p) => p.facts.map((f) => f.id)),
    ...dimensions.map((d) => d.id),
    ...dimensions.flatMap((d) => d.attributes.map((a) => a.id)),
    ...project.assumptions.map((a) => a.id),
    ...project.openQuestions.map((q) => q.id),
  ];
  for (const x of allIds) seen.set(x, (seen.get(x) ?? 0) + 1);
  for (const [dup, count] of seen) {
    if (count > 1) {
      add({
        code: 'KD002',
        severity: 'error',
        message: `The id "${dup}" is used ${count} times.`,
        hint: 'Every item needs its own id. Rename one of them (ids are internal and never shown in deliverables).',
        phase: 'review',
        target: { kind: 'project' },
      });
    }
  }

  // KD003 — dangling references
  const stakeholderIds = new Set(stakeholders.map((s) => s.id));
  const processIds = new Set(processes.map((p) => p.id));
  const dimensionIds = new Set(dimensions.map((d) => d.id));
  for (const r of requirements) {
    for (const sid of r.stakeholderIds.filter((x) => !stakeholderIds.has(x))) {
      add({
        code: 'KD003',
        severity: 'error',
        message: `Requirement "${short(r.statement)}" refers to a missing stakeholder (${sid}).`,
        hint: 'Remove the link or add the stakeholder.',
        phase: 'requirements',
        target: { kind: 'requirement', id: r.id },
      });
    }
    for (const pid of r.processIds.filter((x) => !processIds.has(x))) {
      add({
        code: 'KD003',
        severity: 'error',
        message: `Requirement "${short(r.statement)}" refers to a missing business process (${pid}).`,
        hint: 'Remove the link or add the business process.',
        phase: 'processes',
        target: { kind: 'requirement', id: r.id },
      });
    }
  }
  for (const p of processes) {
    for (const u of p.dimensions.filter((x) => !dimensionIds.has(x.dimensionId))) {
      add({
        code: 'KD003',
        severity: 'error',
        message: `Process "${displayName(p)}" uses a missing dimension (${u.dimensionId}).`,
        hint: 'Remove the usage or add the dimension to the catalogue.',
        phase: 'dimensions',
        target: { kind: 'process', id: p.id },
      });
    }
  }

  // Per-process methodology checks
  for (const p of processes) {
    const name = displayName(p);
    if (!p.grain.trim()) {
      add({
        code: 'KD101',
        severity: 'warning',
        message: `"${name}" has no grain.`,
        hint: 'State what one fact row represents before choosing dimensions and facts, e.g. "One row per order line".',
        phase: 'grain',
        target: { kind: 'process', id: p.id },
      });
    } else if (!GRAIN_PATTERN.test(p.grain)) {
      add({
        code: 'KD201',
        severity: 'info',
        message: `The grain of "${name}" isn't phrased as "One row per …".`,
        hint: 'Grain statements are clearest in the form "One row per <business event or entity>".',
        phase: 'grain',
        target: { kind: 'process', id: p.id },
      });
    }

    if (p.dimensions.length === 0) {
      add({
        code: 'KD102',
        severity: 'warning',
        message: `"${name}" has no dimensions.`,
        hint: 'Ask "who, what, where, when, why and how" about one row at the declared grain.',
        phase: 'dimensions',
        target: { kind: 'process', id: p.id },
      });
    } else {
      const dateUsages = p.dimensions.filter((u) => {
        const d = dimensions.find((x) => x.id === u.dimensionId);
        return d ? isDateDimension(d) : false;
      });
      if (dateUsages.length === 0) {
        add({
          code: 'KD108',
          severity: 'warning',
          message: `"${name}" has no date dimension.`,
          hint: 'Nearly every fact table needs at least one date. Add a Date dimension (as a role if needed).',
          phase: 'dimensions',
          target: { kind: 'process', id: p.id },
        });
      }
      if (p.factTableType === 'accumulating-snapshot') {
        // Count distinct roles per date dimension, so a dimension listed twice without roles is still one.
        const roleSets = new Map<string, Set<string>>();
        for (const u of dateUsages) {
          const set = roleSets.get(u.dimensionId) ?? new Set<string>();
          for (const r of u.roles.length ? u.roles : ['']) set.add(r.trim().toLowerCase());
          roleSets.set(u.dimensionId, set);
        }
        const roles = [...roleSets.values()].reduce((sum, set) => sum + set.size, 0);
        if (roles < 2) {
          add({
            code: 'KD203',
            severity: 'info',
            message: `Accumulating snapshot "${name}" has fewer than two date roles.`,
            hint: 'Accumulating snapshots track milestones; add a date role per milestone (e.g. Order date, Ship date).',
            phase: 'dimensions',
            target: { kind: 'process', id: p.id },
          });
        }
      }
    }

    if (p.factTableType === 'factless') {
      if (p.facts.length > 0) {
        add({
          code: 'KD104',
          severity: 'warning',
          message: `"${name}" is marked factless but has ${p.facts.length} fact(s).`,
          hint: 'Either change the fact table type or remove the facts.',
          phase: 'facts',
          target: { kind: 'process', id: p.id },
        });
      }
    } else if (p.facts.length === 0) {
      add({
        code: 'KD103',
        severity: 'warning',
        message: `"${name}" has no facts.`,
        hint: 'List the numeric measurements captured at this grain, or mark the process as factless.',
        phase: 'facts',
        target: { kind: 'process', id: p.id },
      });
    }

    if (p.businessValue == null || p.feasibility == null) {
      add({
        code: 'KD205',
        severity: 'info',
        message: `"${name}" has no business value / feasibility score.`,
        hint: 'Score both from 1 to 5 to prioritise which process to build first.',
        phase: 'processes',
        target: { kind: 'process', id: p.id },
      });
    }
  }

  // Dimension usage
  for (const d of dimensions) {
    const users = processes.filter((p) => p.dimensions.some((u) => u.dimensionId === d.id));
    if (users.length === 0) {
      add({
        code: 'KD105',
        severity: 'warning',
        message: `Dimension "${displayName(d)}" isn't used by any business process.`,
        hint: 'Assign it to the processes it describes, or remove it.',
        phase: 'dimensions',
        target: { kind: 'dimension', id: d.id },
      });
    } else if (users.length === 1 && processes.length > 1 && d.kind !== 'degenerate' && d.kind !== 'junk') {
      add({
        code: 'KD202',
        severity: 'info',
        message: `Dimension "${displayName(d)}" is only used by "${displayName(users[0]!)}".`,
        hint: 'Check whether other processes share it — conformed dimensions are what let you drill across processes.',
        phase: 'matrix',
        target: { kind: 'dimension', id: d.id },
      });
    }
  }

  // KD106 — requirements traceability
  if (processes.length > 0) {
    for (const r of requirements.filter((x) => x.processIds.length === 0 && x.priority !== 'wont')) {
      add({
        code: 'KD106',
        severity: 'warning',
        message: `Requirement "${short(r.statement)}" isn't linked to a business process.`,
        hint: 'Which business event produces the data to answer it? Link it, or add that process.',
        phase: 'processes',
        target: { kind: 'requirement', id: r.id },
      });
    }
  }

  // KD107 — duplicate names
  const dupNames = (items: { id: string; name: string }[], kind: TargetKind, phase: PhaseId, label: string) => {
    const byName = new Map<string, string[]>();
    for (const it of items) {
      const key = it.name.trim().toLowerCase();
      if (key) byName.set(key, [...(byName.get(key) ?? []), it.id]);
    }
    for (const ids of byName.values()) {
      if (ids.length > 1) {
        const item = items.find((x) => x.id === ids[0])!;
        add({
          code: 'KD107',
          severity: 'warning',
          message: `${ids.length} ${label}s are named "${item.name.trim()}".`,
          hint: `Give each ${label} a distinct name, or merge them.`,
          phase,
          target: { kind, id: ids[0] },
        });
      }
    }
  };
  dupNames(processes, 'process', 'processes', 'business process');
  dupNames(dimensions, 'dimension', 'dimensions', 'dimension');

  // KD204 — interviews
  const planned = stakeholders.filter((s) => s.interviewStatus === 'planned');
  if (planned.length > 0) {
    add({
      code: 'KD204',
      severity: 'info',
      message: `${planned.length} planned interview(s) not done yet: ${planned.map((s) => displayName(s, 'unnamed')).join(', ')}.`,
      hint: 'Requirements are only as good as the interviews behind them. Mark interviews done or skipped.',
      phase: 'stakeholders',
      target: { kind: 'stakeholder', id: planned[0]!.id },
    });
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code));
}

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return {
    error: findings.filter((f) => f.severity === 'error').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
}

function short(text: string, max = 48): string {
  const t = text.trim() || 'untitled';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
