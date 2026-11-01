import { FACT_TABLE_TYPES, GRAIN_PATTERN, displayName, type FactTableType } from '../../core';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, TextArea } from '../components/ui';
import { goToPhase } from '../store/routing';
import { update, useProject } from '../store/store';

const PLACEHOLDER: Record<FactTableType | 'none', string> = {
  none: 'One row per …',
  transaction: 'One row per order line',
  'periodic-snapshot': 'One row per account per month end',
  'accumulating-snapshot': 'One row per order, updated as it moves through fulfilment',
  factless: 'One row per student attending a class on a day',
};

export function GrainPhase() {
  const project = useProject();
  return (
    <PhaseFrame
      phase="grain"
      lead={
        <div className="callout fact">
          <strong>Step 2: declare the grain.</strong> Say exactly what one fact row represents, in business terms, before you
          pick dimensions or facts. Prefer the most atomic level the source captures.
        </div>
      }
    >
      {project.processes.length === 0 ? (
        <EmptyState
          title="No business processes yet"
          actions={
            <button type="button" className="btn primary" onClick={() => goToPhase('processes')}>
              Add business processes
            </button>
          }
        />
      ) : (
        <div className="stack">
          {project.processes.map((p, i) => {
            const phrased = !p.grain.trim() || GRAIN_PATTERN.test(p.grain);
            return (
              <div className="card accent-fact" key={p.id}>
                <div className="card-head">
                  <h3>{displayName(p, 'Untitled process')}</h3>
                  {p.grain.trim() && p.factTableType ? <span className="badge success">Declared</span> : <span className="badge">To do</span>}
                </div>
                <div className="stack">
                  <div className="field">
                    <span className="field-label">Fact table type</span>
                    <div className="options" role="group" aria-label={`Fact table type for ${displayName(p)}`}>
                      {FACT_TABLE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          className="option"
                          aria-pressed={p.factTableType === t.value}
                          onClick={() => update((d) => void (d.processes[i]!.factTableType = t.value))}
                        >
                          <strong>{t.label}</strong>
                          <span>{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextArea
                    label="Grain statement"
                    mono
                    rows={2}
                    value={p.grain}
                    onChange={(v) => update((d) => void (d.processes[i]!.grain = v), { coalesce: `bp.${p.id}.grain` })}
                    placeholder={PLACEHOLDER[p.factTableType ?? 'none']}
                    help={phrased ? 'Tip: start with "One row per …".' : <span style={{ color: 'var(--kd-warning)' }}>Clearer as "One row per …" — what exactly is one row?</span>}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PhaseFrame>
  );
}
