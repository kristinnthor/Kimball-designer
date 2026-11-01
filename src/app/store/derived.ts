import { useMemo } from 'react';
import { PHASE_IDS, countBySeverity, phaseStatus, validateProject, type Finding, type PhaseStatus } from '../../core';
import { useProject } from './store';

/** Validation findings for the current project, recomputed only when the project changes. */
export function useFindings(): Finding[] {
  const project = useProject();
  return useMemo(() => validateProject(project), [project]);
}

export function usePhaseStatuses(): PhaseStatus[] {
  const project = useProject();
  const findings = useFindings();
  return useMemo(() => {
    const c = countBySeverity(findings);
    return PHASE_IDS.map((id) => phaseStatus(project, id, c.error, c.warning));
  }, [project, findings]);
}
