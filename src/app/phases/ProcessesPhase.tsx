import { createProcess, displayName, priorityScore } from '../../core';
import { IconPlus } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { PriorityGrid } from '../components/PriorityGrid';
import { StakeholderInput } from '../components/StakeholderInput';
import { EmptyState, RemoveButton, ScoreInput, SectionHead, TagInput, TextArea, TextInput, ToggleChip } from '../components/ui';
import { PROCESS_DESCRIPTION_EXAMPLES, SOURCE_EXAMPLES, pick } from '../lib/placeholders';
import { removeWithUndo } from '../actions';
import { markAdded, wasJustAdded } from '../lib/justAdded';
import { update, useProject } from '../store/store';

const COMMON = ['Sales', 'Orders', 'Shipments', 'Inventory snapshot', 'Invoices', 'Payments', 'Returns', 'Web sessions', 'Support tickets'];

export function ProcessesPhase() {
  const project = useProject();
  const names = new Set(project.processes.map((p) => p.name.trim().toLowerCase()));
  const add = (name = '') => {
    const p = createProcess({ name });
    markAdded(p.id);
    update((d) => void d.processes.push(p));
  };

  return (
    <PhaseFrame
      phase="processes"
      lead={
        <div className="callout fact">
          <strong>Step 1 of the four-step design.</strong> Name each process as a business <em>event</em> that produces
          measurements — "Retail sales", "Claims submitted" — not a department or a report.
        </div>
      }
    >
      {project.processes.length === 0 ? (
        <EmptyState
          title="Which business events produce your numbers?"
          actions={
            <button type="button" className="btn primary" onClick={() => add()}>
              <IconPlus /> Add business process
            </button>
          }
        >
          Look at each requirement and ask which operational activity captures the data behind it.
        </EmptyState>
      ) : (
        <div className="stack">
          {project.processes.map((p, i) => {
            const set = (key: 'name' | 'description' | 'owner') => (v: string) =>
              update((d) => void (d.processes[i]![key] = v), { coalesce: `bp.${p.id}.${key}` });
            const score = priorityScore(p);
            return (
              <div className="card accent-fact" key={p.id}>
                <div className="card-head">
                  <h3>{displayName(p, 'New business process')}</h3>
                  {score != null && <span className="badge fact">Priority {score}/25</span>}
                  <RemoveButton
                    label={`Remove ${displayName(p, 'process')}`}
                    onClick={() =>
                      removeWithUndo(displayName(p, 'the process'), (d) => {
                        d.processes = d.processes.filter((x) => x.id !== p.id);
                        for (const r of d.requirements) r.processIds = r.processIds.filter((x) => x !== p.id);
                        if (d.physical) delete d.physical.rows[p.id];
                      })
                    }
                  />
                </div>
                <div className="stack">
                  <div className="grid-2">
                    <TextInput label="Name" value={p.name} onChange={set('name')} className="title" placeholder="e.g. Retail sales" autoFocus={wasJustAdded(p.id)} />
                    <StakeholderInput label="Business owner" value={p.owner} onChange={set('owner')} />
                  </div>
                  <TextArea label="Description" rows={2} value={p.description} onChange={set('description')} placeholder={pick(PROCESS_DESCRIPTION_EXAMPLES, i)} />
                  <TagInput
                    label="Source systems"
                    values={p.sourceSystems}
                    onChange={(v) => update((d) => void (d.processes[i]!.sourceSystems = v))}
                    placeholder={pick(SOURCE_EXAMPLES, i)}
                  />
                  {project.requirements.length > 0 && (
                    <div className="field" role="group" aria-label={`${displayName(p, 'This process')} answers requirements`}>
                      <span className="field-label">Answers requirements</span>
                      <div className="chips">
                        {project.requirements.map((r, ri) => {
                          const on = r.processIds.includes(p.id);
                          return (
                            <ToggleChip
                              key={r.id}
                              tone="fact"
                              pressed={on}
                              title={r.statement}
                              onClick={() =>
                                update((d) => {
                                  const req = d.requirements[ri]!;
                                  req.processIds = on ? req.processIds.filter((x) => x !== p.id) : [...req.processIds, p.id];
                                })
                              }
                            >
                              R{ri + 1} · {r.statement.trim().slice(0, 48) || 'untitled'}
                              {r.statement.trim().length > 48 ? '…' : ''}
                            </ToggleChip>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="row" style={{ gap: 32 }}>
                    <ScoreInput label="Business value" value={p.businessValue} onChange={(v) => update((d) => void (d.processes[i]!.businessValue = v))} />
                    <ScoreInput label="Feasibility" value={p.feasibility} onChange={(v) => update((d) => void (d.processes[i]!.feasibility = v))} />
                  </div>
                </div>
              </div>
            );
          })}
          <div>
            <button type="button" className="btn" onClick={() => add()}>
              <IconPlus /> Add business process
            </button>
          </div>
        </div>
      )}

      <section className="section">
        <SectionHead title="Quick add">Common business processes — rename them to match your business.</SectionHead>
        <div className="chips">
          {COMMON.filter((c) => !names.has(c.toLowerCase())).map((c) => (
            <button key={c} type="button" className="chip add" onClick={() => add(c)}>
              <IconPlus size={14} /> {c}
            </button>
          ))}
        </div>
      </section>

      {project.processes.length > 0 && (
        <section className="section">
          <SectionHead title="Prioritisation grid">Score value and feasibility to see which process to build first.</SectionHead>
          <div className="card">
            <PriorityGrid processes={project.processes} />
          </div>
        </section>
      )}
    </PhaseFrame>
  );
}
