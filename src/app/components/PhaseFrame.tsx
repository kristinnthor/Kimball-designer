import type { ReactNode } from 'react';
import { nextPhase, phaseDef, previousPhase, STAGES, type PhaseId } from '../../core';
import { goToPhase } from '../store/routing';
import { IconArrowLeft, IconArrowRight } from './icons';

export function PhaseFrame({ phase, children, lead }: { phase: PhaseId; children: ReactNode; lead?: ReactNode }) {
  const def = phaseDef(phase);
  const stage = STAGES.find((s) => s.id === def.stage)!;
  const prev = previousPhase(phase);
  const next = nextPhase(phase);
  return (
    <div className="page">
      <header className="phase-head">
        <div className="phase-kicker">
          <span className={`stage-chip ${stage.id}`}>{stage.title}</span>
          <span>Phase {def.number} of 10</span>
        </div>
        <h1>{def.title}</h1>
        <p className="phase-goal">{def.goal}</p>
        {lead && <div style={{ marginTop: 16 }}>{lead}</div>}
      </header>
      {children}
      <footer className="phase-foot">
        {prev ? (
          <button type="button" className="btn" onClick={() => goToPhase(prev)}>
            <IconArrowLeft /> {phaseDef(prev).title}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" className="btn primary" onClick={() => goToPhase(next)}>
            Next: {phaseDef(next).title} <IconArrowRight />
          </button>
        )}
      </footer>
    </div>
  );
}
