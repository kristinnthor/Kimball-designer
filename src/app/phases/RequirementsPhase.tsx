import {
  PRIORITIES,
  createAssumption,
  createOpenQuestion,
  createRequirement,
  displayName,
} from '../../core';
import { IconPlus } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, RemoveButton, SectionHead, Segmented, TagInput, TextArea, TextInput, ToggleChip } from '../components/ui';
import { update, useProject } from '../store/store';

export function RequirementsPhase() {
  const project = useProject();
  const add = () => update((d) => void d.requirements.push(createRequirement()));

  return (
    <PhaseFrame phase="requirements">
      {project.requirements.length === 0 ? (
        <EmptyState
          title="What do people need to know?"
          actions={
            <button type="button" className="btn primary" onClick={add}>
              <IconPlus /> Add requirement
            </button>
          }
        >
          Write each requirement as a business question in the stakeholder's words, e.g. "Which promotions actually increased
          margin?"
        </EmptyState>
      ) : (
        <div className="stack">
          {project.requirements.map((r, i) => (
            <div className="card" key={r.id}>
              <div className="card-head">
                <h3>R{i + 1}</h3>
                <Segmented
                  label="Priority"
                  value={r.priority}
                  options={PRIORITIES}
                  onChange={(v) => update((d) => void (d.requirements[i]!.priority = v))}
                />
                <RemoveButton label={`Remove requirement R${i + 1}`} onClick={() => update((d) => void d.requirements.splice(i, 1))} />
              </div>
              <div className="stack">
                <TextArea
                  label="Business question or need"
                  value={r.statement}
                  rows={2}
                  onChange={(v) => update((d) => void (d.requirements[i]!.statement = v), { coalesce: `rq.${r.id}.statement` })}
                  placeholder="e.g. Where and when are we out of stock?"
                />
                <TagInput
                  label="KPIs and measures"
                  values={r.kpis}
                  onChange={(v) => update((d) => void (d.requirements[i]!.kpis = v))}
                  placeholder="e.g. Out-of-stock rate"
                />
                {project.stakeholders.length > 0 && (
                  <div className="field">
                    <span className="field-label">Raised by</span>
                    <div className="chips">
                      {project.stakeholders.map((s) => {
                        const on = r.stakeholderIds.includes(s.id);
                        return (
                          <ToggleChip
                            key={s.id}
                            pressed={on}
                            onClick={() =>
                              update((d) => {
                                const ids = d.requirements[i]!.stakeholderIds;
                                d.requirements[i]!.stakeholderIds = on ? ids.filter((x) => x !== s.id) : [...ids, s.id];
                              })
                            }
                          >
                            {displayName(s, 'Unnamed')}
                          </ToggleChip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="btn" onClick={add}>
              <IconPlus /> Add requirement
            </button>
          </div>
        </div>
      )}

      <section className="section grid-2">
        <div>
          <SectionHead
            title="Assumptions"
            actions={
              <button type="button" className="btn sm" onClick={() => update((d) => void d.assumptions.push(createAssumption()))}>
                <IconPlus /> Add
              </button>
            }
          >
            Things you are taking as true for now.
          </SectionHead>
          <div className="stack" style={{ gap: 8 }}>
            {project.assumptions.map((a, i) => (
              <div className="row" key={a.id} style={{ flexWrap: 'nowrap' }}>
                <TextInput
                  aria-label={`Assumption ${i + 1}`}
                  value={a.text}
                  onChange={(v) => update((d) => void (d.assumptions[i]!.text = v), { coalesce: `as.${a.id}` })}
                  placeholder="e.g. The fiscal calendar is 4-4-5"
                />
                <RemoveButton label="Remove assumption" onClick={() => update((d) => void d.assumptions.splice(i, 1))} />
              </div>
            ))}
            {project.assumptions.length === 0 && <p className="hint">None yet.</p>}
          </div>
        </div>
        <div>
          <SectionHead
            title="Open questions"
            actions={
              <button type="button" className="btn sm" onClick={() => update((d) => void d.openQuestions.push(createOpenQuestion()))}>
                <IconPlus /> Add
              </button>
            }
          >
            Don't guess — park it here with an owner.
          </SectionHead>
          <div className="stack" style={{ gap: 8 }}>
            {project.openQuestions.map((q, i) => (
              <div className="row" key={q.id} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  aria-label="Answered"
                  title="Answered"
                  checked={q.status === 'answered'}
                  style={{ marginTop: 12 }}
                  onChange={(e) => update((d) => void (d.openQuestions[i]!.status = e.target.checked ? 'answered' : 'open'))}
                />
                <div className="stack" style={{ gap: 6, flex: 1 }}>
                  <TextInput
                    aria-label={`Open question ${i + 1}`}
                    value={q.text}
                    onChange={(v) => update((d) => void (d.openQuestions[i]!.text = v), { coalesce: `oq.${q.id}.text` })}
                    placeholder="e.g. Who owns returns data?"
                  />
                  <TextInput
                    aria-label="Owner"
                    value={q.owner}
                    onChange={(v) => update((d) => void (d.openQuestions[i]!.owner = v), { coalesce: `oq.${q.id}.owner` })}
                    placeholder="Owner"
                  />
                </div>
                <RemoveButton label="Remove question" onClick={() => update((d) => void d.openQuestions.splice(i, 1))} />
              </div>
            ))}
            {project.openQuestions.length === 0 && <p className="hint">None yet.</p>}
          </div>
        </div>
      </section>
    </PhaseFrame>
  );
}
