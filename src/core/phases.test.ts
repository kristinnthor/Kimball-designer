import { describe, expect, it } from 'vitest';
import { createProject, PHASE_IDS } from './model';
import { nextPhase, PHASES, phaseStatus, previousPhase } from './phases';
import { projectProgress, projectSummaryText } from './summary';
import { tinyProject } from './test-helpers';
import { loadExample } from './examples';

describe('phases', () => {
  it('defines every phase once, in order, numbered 1–10', () => {
    expect(PHASES.map((p) => p.id)).toEqual([...PHASE_IDS]);
    expect(PHASES.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(nextPhase('kickoff')).toBe('stakeholders');
    expect(nextPhase('review')).toBeNull();
    expect(previousPhase('kickoff')).toBeNull();
    expect(previousPhase('grain')).toBe('processes');
  });

  it('reports a new project as not started', () => {
    const p = createProject();
    for (const id of PHASE_IDS) expect(phaseStatus(p, id).state).toBe('not-started');
  });

  it('tracks partial progress', () => {
    const p = tinyProject();
    p.processes[1]!.grain = '';
    expect(phaseStatus(p, 'grain')).toMatchObject({ state: 'in-progress', done: 1, total: 2 });
    expect(phaseStatus(p, 'dimensions').state).toBe('complete');
    expect(phaseStatus(p, 'kickoff')).toMatchObject({ state: 'in-progress', done: 1 });
  });

  it('marks every phase complete for the bundled examples', () => {
    for (const id of ['retail', 'saas', 'healthcare'] as const) {
      const pr = projectProgress(loadExample(id));
      expect(pr.phases.filter((s) => s.state !== 'complete').map((s) => s.id)).toEqual([]);
      expect(pr.percent).toBe(100);
      expect(pr.next).toBeNull();
    }
  });

  it('summarises progress as plain text with a next step', () => {
    const text = projectSummaryText(createProject('New'));
    expect(text).toContain('Kimball Designer project: New');
    expect(text).toContain('← next');
    expect(text).toMatch(/Suggested next step: phase 1 "Kickoff"/);
  });
});
