import { PHASE_IDS, displayName, type KimballProject, type PhaseId } from './model';
import { PHASES, phaseStatus, type PhaseStatus } from './phases';
import { countBySeverity, validateProject, type Finding } from './validate';

export interface ProjectProgress {
  phases: PhaseStatus[];
  complete: number;
  percent: number;
  findings: Finding[];
  /** First phase that isn't complete, in order. Null when everything is done. */
  next: PhaseId | null;
}

export function projectProgress(project: KimballProject): ProjectProgress {
  const findings = validateProject(project);
  const counts = countBySeverity(findings);
  const phases = PHASE_IDS.map((id) => phaseStatus(project, id, counts.error, counts.warning));
  const complete = phases.filter((p) => p.state === 'complete').length;
  return {
    phases,
    complete,
    percent: Math.round((complete / phases.length) * 100),
    findings,
    next: phases.find((p) => p.state !== 'complete')?.id ?? null,
  };
}

/**
 * Compact plain-text status for an agent (CLI `summary`) or for pasting into a
 * chat ("Copy summary for Claude" in the UI).
 */
export function projectSummaryText(project: KimballProject, maxFindings = 12): string {
  const pr = projectProgress(project);
  const counts = countBySeverity(pr.findings);
  const icon = { complete: '✓', 'in-progress': '…', 'not-started': '·' } as const;
  const lines = [
    `Kimball Designer project: ${displayName(project.meta, 'Untitled project')}`,
    `Progress: ${pr.complete}/${pr.phases.length} phases complete (${pr.percent}%)`,
    `Model: ${project.stakeholders.length} stakeholders · ${project.requirements.length} requirements · ${project.processes.length} business processes · ${project.dimensions.length} dimensions`,
    '',
    'Phases:',
    ...pr.phases.map((s) => {
      const def = PHASES.find((p) => p.id === s.id)!;
      return `  ${icon[s.state]} ${String(def.number).padStart(2)} ${def.title.padEnd(18)} ${s.detail}${s.id === pr.next ? '   ← next' : ''}`;
    }),
    '',
    `Findings: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} note(s)`,
    ...pr.findings.slice(0, maxFindings).map((f) => `  [${f.severity} ${f.code}] ${f.message}`),
  ];
  if (pr.findings.length > maxFindings) lines.push(`  … and ${pr.findings.length - maxFindings} more`);
  if (pr.next) {
    const def = PHASES.find((p) => p.id === pr.next)!;
    lines.push('', `Suggested next step: phase ${def.number} "${def.title}" — ${def.goal}`);
  } else {
    lines.push('', 'All phases complete. Render the deliverables and review them with the sponsor.');
  }
  return lines.join('\n') + '\n';
}
