import {
  DIMENSION_KINDS,
  SCD_TYPES,
  createAttribute,
  createDimension,
  displayName,
  isConformed,
  isConformedUsage,
  isDateDimension,
  processesUsing,
  type DimensionKind,
} from '../../core';
import { IconPlus } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, RemoveButton, SectionHead, Select, TagInput, TextArea, TextInput, ToggleChip } from '../components/ui';
import { DIMENSION_DESCRIPTION_EXAMPLES, attributePlaceholder, hierarchyPlaceholder, pick, rolePlaceholder } from '../lib/placeholders';
import { goToPhase } from '../store/routing';
import { removeWithUndo } from '../actions';
import { markAdded, wasJustAdded } from '../lib/justAdded';
import { update, useProject } from '../store/store';

const COMMON: { name: string; kind: DimensionKind }[] = [
  { name: 'Date', kind: 'date' },
  { name: 'Customer', kind: 'standard' },
  { name: 'Product', kind: 'standard' },
  { name: 'Employee', kind: 'standard' },
  { name: 'Location', kind: 'standard' },
  { name: 'Supplier', kind: 'standard' },
  { name: 'Account', kind: 'standard' },
  { name: 'Channel', kind: 'standard' },
  { name: 'Promotion', kind: 'standard' },
];

export function DimensionsPhase() {
  const project = useProject();
  const names = new Set(project.dimensions.map((d) => d.name.trim().toLowerCase()));
  const add = (name = '', kind: DimensionKind = 'standard') => {
    const dim = createDimension({ name, kind });
    if (!name) markAdded(dim.id);
    update((d) => void d.dimensions.push(dim));
  };

  return (
    <PhaseFrame
      phase="dimensions"
      lead={
        <div className="callout dim">
          <strong>Step 3: identify the dimensions.</strong> For one row at the declared grain, ask <em>who, what, where, when,
          why and how</em>. Reuse the same dimension across processes whenever it means the same thing — that makes it{' '}
          <strong>conformed</strong>.
        </div>
      }
    >
      <section>
        <SectionHead
          title="Dimension catalogue"
          actions={
            <button type="button" className="btn sm" onClick={() => add()}>
              <IconPlus /> New dimension
            </button>
          }
        >
          Every dimension once. Amber = conformed (used by two or more processes).
        </SectionHead>
        <div className="chips" style={{ marginBottom: 16 }}>
          {COMMON.filter((c) => !names.has(c.name.toLowerCase())).map((c) => (
            <button key={c.name} type="button" className="chip add" onClick={() => add(c.name, c.kind)}>
              <IconPlus size={14} /> {c.name}
            </button>
          ))}
        </div>
        {project.dimensions.length === 0 ? (
          <EmptyState title="No dimensions yet">Quick-add the common ones above, or create your own.</EmptyState>
        ) : (
          <div className="stack">
            {project.dimensions.map((dim, i) => {
              const users = processesUsing(project, dim.id);
              const conformed = isConformedUsage(dim.kind, users.length);
              return (
                <div className={`card ${conformed ? 'accent-conformed' : 'accent-dim'}`} key={dim.id}>
                  <div className="card-head">
                    <h3>{displayName(dim, 'New dimension')}</h3>
                    {conformed ? (
                      <span className="badge conformed">Conformed · {users.length} processes</span>
                    ) : users.length > 0 ? (
                      <span className="badge dim">
                        {users.length} process{users.length === 1 ? '' : 'es'}
                      </span>
                    ) : (
                      <span className="badge warning">Not used yet</span>
                    )}
                    <RemoveButton
                      label={`Remove ${displayName(dim, 'dimension')}`}
                      onClick={() =>
                        removeWithUndo(displayName(dim, 'the dimension'), (d) => {
                          d.dimensions = d.dimensions.filter((x) => x.id !== dim.id);
                          for (const p of d.processes) p.dimensions = p.dimensions.filter((u) => u.dimensionId !== dim.id);
                          if (d.physical) delete d.physical.rows[dim.id];
                        })
                      }
                    />
                  </div>
                  <div className="grid-3">
                    <TextInput
                      label="Name"
                      value={dim.name}
                      autoFocus={wasJustAdded(dim.id)}
                      onChange={(v) => update((d) => void (d.dimensions[i]!.name = v), { coalesce: `dm.${dim.id}.name` })}
                    />
                    <Select label="Kind" value={dim.kind} options={DIMENSION_KINDS} onChange={(v) => update((d) => void (d.dimensions[i]!.kind = v ?? 'standard'))} />
                    <TextArea
                      rows={1}
                      label="Description"
                      placeholder={pick(DIMENSION_DESCRIPTION_EXAMPLES, i)}
                      value={dim.description}
                      onChange={(v) => update((d) => void (d.dimensions[i]!.description = v), { coalesce: `dm.${dim.id}.desc` })}
                    />
                  </div>
                  {dim.kind !== 'degenerate' && (
                    <details style={{ marginTop: 12 }}>
                      <summary className="hint" style={{ cursor: 'pointer' }}>
                        Attributes ({dim.attributes.length}) and hierarchies ({dim.hierarchies.length})
                      </summary>
                      <div className="stack" style={{ marginTop: 12 }}>
                        {dim.attributes.length > 0 && (
                          <div className="table-wrap">
                            <table className="data">
                              <thead>
                                <tr>
                                  <th>Attribute</th>
                                  <th style={{ width: 180 }}>History (SCD)</th>
                                  <th style={{ width: 48 }}>
                                    <span className="sr-only">Remove</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {dim.attributes.map((a, ai) => (
                                  <tr key={a.id}>
                                    <td>
                                      <TextInput
                                        aria-label="Attribute name"
                                        placeholder={attributePlaceholder(dim.name, ai)}
                                        autoFocus={wasJustAdded(a.id)}
                                        value={a.name}
                                        onChange={(v) => update((d) => void (d.dimensions[i]!.attributes[ai]!.name = v), { coalesce: `at.${a.id}` })}
                                      />
                                    </td>
                                    <td>
                                      <Select
                                        aria-label="SCD type"
                                        value={a.scdType}
                                        options={SCD_TYPES}
                                        placeholder="Not decided"
                                        onChange={(v) => update((d) => void (d.dimensions[i]!.attributes[ai]!.scdType = v))}
                                      />
                                    </td>
                                    <td>
                                      <RemoveButton label="Remove attribute" onClick={() => update((d) => void d.dimensions[i]!.attributes.splice(ai, 1))} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div>
                          <button type="button" className="btn sm" onClick={() => {
                              const a = createAttribute();
                              markAdded(a.id);
                              update((d) => void d.dimensions[i]!.attributes.push(a));
                            }}
                          >
                            <IconPlus /> Add attribute
                          </button>
                        </div>
                        <TagInput
                          label="Hierarchies"
                          values={dim.hierarchies}
                          onChange={(v) => update((d) => void (d.dimensions[i]!.hierarchies = v))}
                          placeholder={hierarchyPlaceholder(dim.name)}
                        />
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <SectionHead title="Dimensions per business process">
          Pick the dimensions that describe one row of each process. Add role names when a dimension plays several roles
          (Order date, Ship date).
        </SectionHead>
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
            {project.processes.map((p, pi) => (
              <div className="card accent-fact" key={p.id}>
                <div className="card-head">
                  <h3>{displayName(p, 'Untitled process')}</h3>
                  <span className="badge">{p.dimensions.length} dimensions</span>
                </div>
                {p.grain && (
                  <p className="hint mono" style={{ marginTop: -8, marginBottom: 12 }}>
                    {p.grain}
                  </p>
                )}
                <div className="chips" role="group" aria-label={`Dimensions used by ${displayName(p, 'this process')}`}>
                  {project.dimensions.map((dim) => {
                    const on = p.dimensions.some((u) => u.dimensionId === dim.id);
                    return (
                      <ToggleChip
                        key={dim.id}
                        pressed={on}
                        tone={isConformed(project, dim.id) ? 'conformed' : undefined}
                        onClick={() =>
                          update((d) => {
                            const proc = d.processes[pi]!;
                            proc.dimensions = on
                              ? proc.dimensions.filter((u) => u.dimensionId !== dim.id)
                              : [...proc.dimensions, { dimensionId: dim.id, roles: [] }];
                          })
                        }
                      >
                        {displayName(dim, 'Unnamed')}
                      </ToggleChip>
                    );
                  })}
                  {project.dimensions.length === 0 && <span className="hint">Add dimensions to the catalogue first.</span>}
                </div>
                {p.dimensions.length > 0 && (
                  <div className="grid-2" style={{ marginTop: 16 }}>
                    {p.dimensions.map((u, ui) => {
                      const dim = project.dimensions.find((x) => x.id === u.dimensionId);
                      if (!dim) {
                        // A reference left by a hand-edited file: show it so it can be removed (KD003).
                        return (
                          <div className="field" key={`${u.dimensionId}-${ui}`}>
                            <span className="field-label">Missing dimension</span>
                            <button
                              type="button"
                              className="chip missing"
                              title="No dimension has this id. Click to remove it from the process."
                              onClick={() => update((d) => void d.processes[pi]!.dimensions.splice(ui, 1))}
                            >
                              {u.dimensionId} ×
                            </button>
                          </div>
                        );
                      }
                      return (
                        <TagInput
                          key={`${u.dimensionId}-${ui}`}
                          label={`${displayName(dim)} — roles (optional)`}
                          values={u.roles}
                          onChange={(v) => update((d) => void (d.processes[pi]!.dimensions[ui]!.roles = v))}
                          placeholder={rolePlaceholder(isDateDimension(dim), ui)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </PhaseFrame>
  );
}
