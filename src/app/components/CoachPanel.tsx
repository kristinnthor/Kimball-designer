import { GUIDANCE, phaseDef, type PhaseId } from '../../core';
import { useFindings, usePhaseStatuses } from '../store/derived';
import { helpHref } from '../store/routing';
import { IconClose } from './icons';

export function CoachPanel({ phase, onClose }: { phase: PhaseId; onClose: () => void }) {
  const g = GUIDANCE[phase];
  const def = phaseDef(phase);
  const status = usePhaseStatuses().find((s) => s.id === phase)!;
  const findings = useFindings().filter((f) => f.phase === phase);

  return (
    <aside className="app-coach" aria-label="Coach">
      <div className="coach">
        <div className="coach-head">
          <h2>Coach · {def.title}</h2>
          <button type="button" className="btn ghost icon" aria-label="Hide coach" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <section>
          <h3>Why it matters</h3>
          <p>{g.why}</p>
        </section>

        <section>
          <h3>Checklist</h3>
          <ul className="checklist">
            <li>
              <span className={`mark ${status.state === 'complete' ? 'ok' : 'info'}`} aria-hidden="true">
                {status.state === 'complete' ? '✓' : '…'}
              </span>
              <span>{status.detail}</span>
            </li>
            {findings.slice(0, 8).map((f, i) => (
              <li key={`${f.code}-${f.target.id ?? i}`}>
                <span className={`mark ${f.severity}`} aria-hidden="true">
                  {f.severity === 'error' ? '×' : f.severity === 'warning' ? '!' : 'i'}
                </span>
                <span>
                  {f.message} <span className="sr-only">({f.severity})</span>
                </span>
              </li>
            ))}
            {findings.length === 0 && status.state === 'complete' && (
              <li>
                <span className="mark ok" aria-hidden="true">
                  ✓
                </span>
                <span>No open findings for this phase.</span>
              </li>
            )}
          </ul>
        </section>

        <section>
          <h3>Ask your stakeholders</h3>
          <ul>
            {g.ask.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Tips</h3>
          <ul>
            {g.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Avoid</h3>
          <ul>
            {g.pitfalls.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        {g.examples.length > 0 && (
          <section>
            <h3>Examples</h3>
            <ul>
              {g.examples.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <a href={helpHref('phases')}>All phases, demos and deliverables in Help →</a>
        </section>
      </div>
    </aside>
  );
}
