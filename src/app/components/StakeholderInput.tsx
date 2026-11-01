import { useState } from 'react';
import { STAKEHOLDER_TYPES, createStakeholder, optionLabel, type StakeholderType } from '../../core';
import { update, useProject } from '../store/store';
import { ComboInput } from './ui';

/**
 * A person's name, picked from the project's stakeholders or typed freely.
 * Used for process owners, question owners and the sponsor. A typed name that
 * isn't a stakeholder yet can be added to the stakeholder list in one click.
 */
export function StakeholderInput({
  label,
  value,
  onChange,
  placeholder = 'Name and role',
  pickPlaceholder = 'Pick a stakeholder or type a name',
  newType = 'business',
  'aria-label': ariaLabel,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown while the project has no named stakeholders. */
  placeholder?: string;
  /** Shown once there are stakeholders to pick from. */
  pickPlaceholder?: string;
  /** Type given to a stakeholder created from this field. */
  newType?: StakeholderType;
  'aria-label'?: string;
}) {
  const { stakeholders } = useProject();
  const [focused, setFocused] = useState(false);
  const named = stakeholders.filter((s) => s.name.trim());
  const name = value.trim();
  const known = named.some((s) => s.name.trim().toLowerCase() === name.toLowerCase());
  const suggestions = named.map((s) => ({
    value: s.name.trim(),
    detail: [s.role.trim(), optionLabel(STAKEHOLDER_TYPES, s.type)].filter(Boolean).join(' · '),
  }));
  const help =
    name && !known && !focused ? (
      <button
        type="button"
        className="btn link"
        onClick={() => update((d) => void d.stakeholders.push(createStakeholder({ name, type: newType })))}
      >
        + Add “{name}” to stakeholders
      </button>
    ) : undefined;
  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className="field-wrap">
      <ComboInput
        label={label}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        suggestions={suggestions}
        help={help}
        placeholder={named.length ? pickPlaceholder : placeholder}
      />
    </div>
  );
}
