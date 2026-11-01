import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Option } from '../../core';
import { IconTrash } from './icons';

export function Field({
  label,
  help,
  children,
  htmlFor,
  hideLabel,
}: {
  label: string;
  help?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  hideLabel?: boolean;
}) {
  const cls = hideLabel ? 'sr-only' : undefined;
  return (
    <div className="field">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cls}>
          {label}
        </label>
      ) : (
        <span className={hideLabel ? 'sr-only' : 'field-label'}>{label}</span>
      )}
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

interface TextProps {
  label?: string;
  help?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

export function TextInput({ label, help, value, onChange, placeholder, mono, className, autoFocus, ...rest }: TextProps) {
  const id = useId();
  const input = (
    <input
      id={id}
      className={`input ${mono ? 'mono' : ''} ${className ?? ''}`}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={label ? undefined : rest['aria-label']}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return label ? (
    <Field label={label} help={help} htmlFor={id}>
      {input}
    </Field>
  ) : (
    input
  );
}

/** Grows a textarea to fit its content, so long text is never hidden behind a scrollbar. */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    // Re-fit when the width changes (window resize, coach panel toggled).
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, value]);
}

/** Multi-line text that grows with its content. `rows` is the minimum height. */
export function TextArea({ label, help, value, onChange, placeholder, mono, rows = 3, className, ...rest }: TextProps & { rows?: number }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value);
  const area = (
    <textarea
      id={id}
      ref={ref}
      className={`textarea auto ${rows === 1 ? 'single' : ''} ${mono ? 'mono' : ''} ${className ?? ''}`}
      value={value}
      rows={rows}
      placeholder={placeholder}
      aria-label={label ? undefined : rest['aria-label']}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return label ? (
    <Field label={label} help={help} htmlFor={id}>
      {area}
    </Field>
  ) : (
    area
  );
}

export interface Suggestion {
  value: string;
  /** Secondary text, e.g. the person's role. */
  detail?: string;
}

/**
 * Free-text input with a list of suggestions (WAI-ARIA combobox). Typing filters the list;
 * Arrow keys, Enter and Escape work as expected, and any text is still allowed.
 */
export function ComboInput({
  label,
  help,
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: Omit<TextProps, 'mono' | 'autoFocus'> & { suggestions: Suggestion[] }) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim().toLowerCase();
  // An exact match shows everything, so the user can switch to someone else.
  const exact = suggestions.some((s) => s.value.toLowerCase() === q);
  const matches =
    !q || exact ? suggestions : suggestions.filter((s) => `${s.value} ${s.detail ?? ''}`.toLowerCase().includes(q));
  const expanded = open && matches.length > 0;
  const choose = (s: Suggestion) => {
    onChange(s.value);
    setOpen(false);
    setActive(-1);
  };
  const input = (
    <div className={`combo ${suggestions.length ? 'has-list' : ''}`}>
      <input
        id={id}
        className={`input ${className ?? ''}`}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-label={label ? undefined : ariaLabel}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!expanded) {
              setOpen(true);
              setActive(e.key === 'ArrowDown' ? 0 : matches.length - 1);
              return;
            }
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((a) => (a + step + matches.length) % matches.length);
          } else if (e.key === 'Enter' && expanded && active >= 0 && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === 'Escape' && expanded) {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {suggestions.length > 0 && (
        <button
          type="button"
          className="combo-toggle"
          tabIndex={-1}
          aria-label="Show suggestions"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            document.getElementById(id)?.focus();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {expanded && (
        <ul className="combo-list" role="listbox" id={listId} aria-label={label ?? ariaLabel}>
          {matches.map((s, i) => (
            <li
              key={`${s.value}-${i}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
            >
              <span>{s.value}</span>
              {s.detail && <span className="combo-detail">{s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return label ? (
    <Field label={label} help={help} htmlFor={id}>
      {input}
    </Field>
  ) : (
    <>
      {input}
      {help && <span className="help">{help}</span>}
    </>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
}: {
  label?: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const id = useId();
  const select = (
    <select
      id={id}
      className="select"
      value={value === null ? '' : String(value)}
      aria-label={label ? undefined : ariaLabel}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find((o) => String(o.value) === raw);
        onChange(match ? match.value : null);
      }}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)} title={o.description}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return label ? (
    <Field label={label} htmlFor={id}>
      {select}
    </Field>
  ) : (
    select
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.description} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Free-text list editor: Enter or comma adds a tag, Backspace on empty removes the last. */
export function TagInput({
  label,
  help,
  values,
  onChange,
  placeholder = 'Type and press Enter',
  hideLabel,
}: {
  label: string;
  help?: ReactNode;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Keep the label for screen readers only (e.g. inside a table with a column header). */
  hideLabel?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const commit = () => {
    const parts = draft
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !values.includes(s));
    if (parts.length) onChange([...values, ...parts]);
    setDraft('');
  };
  return (
    <Field label={label} help={help} htmlFor={id} hideLabel={hideLabel}>
      <div className="tag-input">
        {values.map((v) => (
          <span className="tag" key={v}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
        />
      </div>
    </Field>
  );
}

export function ScoreInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field label={label}>
      <div className="score" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ToggleChip({
  pressed,
  onClick,
  children,
  tone,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'fact' | 'conformed';
  title?: string;
}) {
  return (
    <button type="button" className={`chip ${tone ?? ''}`} aria-pressed={pressed} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn ghost icon danger" aria-label={label} title={label} onClick={onClick}>
      <IconTrash />
    </button>
  );
}

export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function SectionHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Dropdown menu with outside-click and Escape handling. */
export function Menu({ label, icon, children }: { label: string; icon?: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
        <span>{label}</span>
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
