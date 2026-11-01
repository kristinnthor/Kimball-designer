import { ADDITIVITY, createMeasure, displayName } from '../../core';
import { IconPlus } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, RemoveButton, Select, TextArea, TextInput } from '../components/ui';
import { factPlaceholder } from '../lib/placeholders';
import { goToPhase } from '../store/routing';
import { update, useProject } from '../store/store';

export function FactsPhase() {
  const project = useProject();
  return (
    <PhaseFrame
      phase="facts"
      lead={
        <div className="callout fact">
          <strong>Step 4: identify the facts.</strong> List the numbers each event produces at its grain. Mark how they add up:
          additive (sum anywhere), semi-additive (not over time) or non-additive (ratios, prices).
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
          {project.processes.map((p, pi) => {
            const addFact = () => update((d) => void d.processes[pi]!.facts.push(createMeasure()));
            return (
              <div className="card accent-fact" key={p.id}>
                <div className="card-head">
                  <h3>{displayName(p, 'Untitled process')}</h3>
                  {p.factTableType === 'factless' ? <span className="badge">Factless</span> : <span className="badge fact">{p.facts.length} facts</span>}
                </div>
                {p.grain && (
                  <p className="hint mono" style={{ marginTop: -8, marginBottom: 12 }}>
                    {p.grain}
                  </p>
                )}
                {p.factTableType === 'factless' && p.facts.length === 0 ? (
                  <p className="hint">This is a factless fact table: each row records that an event or coverage happened. Count rows instead of summing facts.</p>
                ) : (
                  <>
                    {p.facts.length > 0 && (
                      <div className="table-wrap" style={{ marginBottom: 12 }}>
                        <table className="data">
                          <thead>
                            <tr>
                              <th>Fact</th>
                              <th style={{ width: 170 }}>Additivity</th>
                              <th style={{ width: 120 }}>Unit</th>
                              <th>Description</th>
                              <th style={{ width: 48 }}>
                                <span className="sr-only">Remove</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.facts.map((f, fi) => {
                              const set = (key: 'name' | 'unit' | 'description') => (v: string) =>
                                update((d) => void (d.processes[pi]!.facts[fi]![key] = v), { coalesce: `ms.${f.id}.${key}` });
                              const example = factPlaceholder(`${p.name} ${p.grain}`, fi);
                              return (
                                <tr key={f.id}>
                                  <td>
                                    <TextInput aria-label="Fact name" value={f.name} onChange={set('name')} placeholder={example.name} autoFocus={!f.name} />
                                  </td>
                                  <td>
                                    <Select
                                      aria-label="Additivity"
                                      value={f.additivity}
                                      options={ADDITIVITY}
                                      onChange={(v) => update((d) => void (d.processes[pi]!.facts[fi]!.additivity = v ?? 'additive'))}
                                    />
                                  </td>
                                  <td>
                                    <TextInput aria-label="Unit" value={f.unit} onChange={set('unit')} placeholder={example.unit} />
                                  </td>
                                  <td>
                                    <TextArea rows={1} aria-label="Description" value={f.description} onChange={set('description')} placeholder="How it is measured" />
                                  </td>
                                  <td>
                                    <RemoveButton label="Remove fact" onClick={() => update((d) => void d.processes[pi]!.facts.splice(fi, 1))} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <button type="button" className="btn sm" onClick={addFact}>
                      <IconPlus /> Add fact
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PhaseFrame>
  );
}
