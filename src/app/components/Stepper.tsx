import { useEffect, useRef } from 'react';
import { PHASES, STAGES, type PhaseId } from '../../core';
import { usePhaseStatuses } from '../store/derived';
import { goToPhase } from '../store/routing';
import { IconCheck } from './icons';

export function Stepper({ current }: { current: PhaseId }) {
  const statuses = usePhaseStatuses();
  const complete = statuses.filter((s) => s.state === 'complete').length;
  const pct = Math.round((complete / statuses.length) * 100);
  const nav = useRef<HTMLElement>(null);
  // On phones the steps are one scrolling row: keep the current one in view.
  useEffect(() => {
    nav.current?.querySelector('[aria-current="step"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  return (
    <nav className="app-nav" aria-label="Phases" ref={nav}>
      <div className="stepper-progress">
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="label">
          <span>Progress</span>
          <span>
            {complete} of {statuses.length} phases
          </span>
        </div>
      </div>
      <div className="stepper">
        {STAGES.map((stage) => (
          <div key={stage.id} className={`stage stage-${stage.id}`}>
            <div className="stage-title">
              <span className="stage-dot" />
              {stage.title}
            </div>
            {PHASES.filter((p) => p.stage === stage.id).map((p) => {
              const s = statuses.find((x) => x.id === p.id)!;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`step ${s.state}`}
                  aria-current={p.id === current ? 'step' : undefined}
                  onClick={() => goToPhase(p.id)}
                  title={`${p.title}: ${s.detail}`}
                >
                  <span className="step-num" aria-hidden="true">
                    {s.state === 'complete' ? <IconCheck size={13} strokeWidth={3} /> : p.number}
                  </span>
                  <span className="step-text">
                    <span className="step-title">{p.title}</span>
                    <span className="step-detail">{s.detail}</span>
                  </span>
                  <span className="sr-only">({s.state.replace('-', ' ')})</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
