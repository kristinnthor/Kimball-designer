import { PhaseFrame } from '../components/PhaseFrame';
import { StakeholderInput } from '../components/StakeholderInput';
import { TagInput, TextArea, TextInput } from '../components/ui';
import { update, useProject } from '../store/store';

export function KickoffPhase() {
  const { meta } = useProject();
  const set = (key: 'name' | 'purpose' | 'sponsor' | 'scopeIn' | 'scopeOut') => (value: string) =>
    update((d) => void (d.meta[key] = value), { coalesce: `meta.${key}` });

  return (
    <PhaseFrame phase="kickoff">
      <div className="card accent-fact stack">
        <div className="grid-2">
          <TextInput label="Project name" value={meta.name} onChange={set('name')} placeholder="e.g. Retail analytics" className="title" />
          <StakeholderInput label="Sponsor" value={meta.sponsor} onChange={set('sponsor')} newType="executive" placeholder="Name and role of the business sponsor" />
        </div>
        <TextArea
          label="Purpose"
          help="The business outcome this warehouse should enable — not the technology."
          value={meta.purpose}
          onChange={set('purpose')}
          placeholder="e.g. Give merchandising one trusted view of sales and margin by category, store and week."
        />
        <div className="grid-2">
          <TextArea
            label="In scope"
            value={meta.scopeIn}
            onChange={set('scopeIn')}
            placeholder="Business areas, processes and sources included in this release"
          />
          <TextArea
            label="Out of scope"
            value={meta.scopeOut}
            onChange={set('scopeOut')}
            placeholder="What is explicitly not included (yet)"
          />
        </div>
        <TagInput
          label="Success criteria"
          help="Two or three measurable outcomes. Press Enter after each."
          values={meta.successCriteria}
          onChange={(v) => update((d) => void (d.meta.successCriteria = v))}
          placeholder="e.g. Weekly sales pack produced without manual work"
        />
      </div>
    </PhaseFrame>
  );
}
