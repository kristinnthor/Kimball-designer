import { useState } from 'react';
import {
  INTERVIEW_QUESTIONS,
  INTERVIEW_STATUSES,
  STAKEHOLDER_TYPES,
  createStakeholder,
  displayName,
  optionLabel,
  type StakeholderType,
} from '../../core';
import { IconPlus } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, RemoveButton, SectionHead, Segmented, Select, TextArea, TextInput } from '../components/ui';
import { stakeholderDepartment, stakeholderRole } from '../lib/placeholders';
import { update, useProject } from '../store/store';

const TYPICAL: { role: string; type: StakeholderType }[] = [
  { role: 'Executive sponsor', type: 'executive' },
  { role: 'Business manager', type: 'business' },
  { role: 'Analyst / power user', type: 'analyst' },
  { role: 'Source system owner', type: 'it' },
];

export function StakeholdersPhase() {
  const project = useProject();
  const [guideType, setGuideType] = useState<StakeholderType>('executive');
  const add = (init: Parameters<typeof createStakeholder>[0] = {}) =>
    update((d) => void d.stakeholders.push(createStakeholder(init)));

  return (
    <PhaseFrame phase="stakeholders">
      {project.stakeholders.length === 0 ? (
        <EmptyState
          title="Who should you interview?"
          actions={
            <>
              <button type="button" className="btn primary" onClick={() => add()}>
                <IconPlus /> Add stakeholder
              </button>
              <button type="button" className="btn" onClick={() => TYPICAL.forEach((t) => add({ role: t.role, type: t.type }))}>
                Add the four typical roles
              </button>
            </>
          }
        >
          Balance business and IT: an executive, the managers who make decisions, the analysts who build reports today, and the
          owners of the source systems.
        </EmptyState>
      ) : (
        <div className="stack">
          {project.stakeholders.map((s, i) => {
            const set = (key: 'name' | 'role' | 'department' | 'notes') => (v: string) =>
              update((d) => void (d.stakeholders[i]![key] = v), { coalesce: `sh.${s.id}.${key}` });
            const sameName = (owner: string) => !!s.name.trim() && owner.trim().toLowerCase() === s.name.trim().toLowerCase();
            const owns = [
              ...project.processes.filter((p) => sameName(p.owner)).map((p) => displayName(p, 'Untitled process')),
              ...(sameName(project.meta.sponsor) ? ['Sponsor'] : []),
            ];
            const questions = project.openQuestions.filter((q) => q.status === 'open' && sameName(q.owner)).length;
            return (
              <div className="card" key={s.id}>
                <div className="card-head">
                  <h3>{displayName(s, 'New stakeholder')}</h3>
                  <span className="badge">{optionLabel(STAKEHOLDER_TYPES, s.type)}</span>
                  <RemoveButton label={`Remove ${displayName(s, 'stakeholder')}`} onClick={() => update((d) => void d.stakeholders.splice(i, 1))} />
                </div>
                <div className="grid-3">
                  <TextInput label="Name" value={s.name} onChange={set('name')} placeholder="Full name" autoFocus={!s.name && i === project.stakeholders.length - 1} />
                  <TextInput label="Role" value={s.role} onChange={set('role')} placeholder={stakeholderRole(s.type, i)} />
                  <TextInput label="Department" value={s.department} onChange={set('department')} placeholder={stakeholderDepartment(s.type, i)} />
                </div>
                {(owns.length > 0 || questions > 0) && (
                  <p className="hint" style={{ marginTop: 10 }}>
                    {owns.length > 0 && <>Owns: {owns.join(', ')}. </>}
                    {questions > 0 && <>{questions} open question{questions === 1 ? '' : 's'} to answer.</>}
                  </p>
                )}
                <div className="row" style={{ marginTop: 16, gap: 24, alignItems: 'flex-end' }}>
                  <Select
                    label="Type"
                    value={s.type}
                    options={STAKEHOLDER_TYPES}
                    onChange={(v) => update((d) => void (d.stakeholders[i]!.type = v ?? 'other'))}
                  />
                  <div className="field">
                    <span className="field-label">Interview</span>
                    <Segmented
                      label="Interview status"
                      value={s.interviewStatus}
                      options={INTERVIEW_STATUSES}
                      onChange={(v) => update((d) => void (d.stakeholders[i]!.interviewStatus = v))}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <TextArea label="Interview notes" value={s.notes} onChange={set('notes')} placeholder="Key decisions, pain points, measures mentioned…" />
                </div>
              </div>
            );
          })}
          <div>
            <button type="button" className="btn" onClick={() => add()}>
              <IconPlus /> Add stakeholder
            </button>
          </div>
        </div>
      )}

      <section className="section">
        <SectionHead title="Interview guide">Questions that work well for each kind of stakeholder.</SectionHead>
        <div className="card">
          <Segmented label="Stakeholder type" value={guideType} options={STAKEHOLDER_TYPES} onChange={setGuideType} />
          <ol style={{ marginTop: 16, paddingLeft: 20 }}>
            {INTERVIEW_QUESTIONS[guideType].map((q) => (
              <li key={q} style={{ marginBottom: 6 }}>
                {q}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </PhaseFrame>
  );
}
