import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AGGREGATES,
  DATA_TYPES,
  PRIORITIES,
  SAMPLE_ROWS_MAX,
  SQL_DIALECTS,
  dbtProjectFiles,
  ddlScript,
  defaultQuery,
  defaultRows,
  describeRequirementQuery,
  displayName,
  distinctValues,
  generateSampleData,
  groupAdvice,
  groupKey,
  groupOptions,
  indexAdvice,
  indexAdviceToMarkdown,
  isReadyToBuild,
  parseGroupKey,
  physicalModel,
  physicalSettings,
  prototypeFiles,
  requirementAnswers,
  rowCount,
  runQuery,
  seedScript,
  slugify,
  sqlType,
  toRequirementQuery,
  type Aggregate,
  type Cell,
  type DataType,
  type ExploreQuery,
  type GroupOption,
  type KimballProject,
  type PhysicalColumn,
  type PhysicalModel,
  type PhysicalSettings,
  type PhysicalTable,
  type RequirementAnswer,
  type SampleDataset,
  type SqlDialect,
} from '../../core';
import { IconCopy, IconDownload, IconSparkle } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, SectionHead, Segmented, TagInput } from '../components/ui';
import { copyWithToast, downloadBlob, downloadText } from '../lib/files';
import { createZip } from '../lib/zip';
import { removeWithUndo } from '../actions';
import { goToPhase } from '../store/routing';
import { update, useProject } from '../store/store';
import { useSyncStatus } from '../store/sync';
import { pushToast } from '../store/toasts';

const ROLE_LABEL: Record<PhysicalColumn['role'], string> = {
  'surrogate-key': 'PK',
  'business-key': 'Business key',
  attribute: '',
  history: 'History',
  'foreign-key': 'FK',
  degenerate: 'Degenerate',
  measure: 'Fact',
};

/** Writes prototype settings, creating them from the defaults on the first change. */
function setPhysical(recipe: (s: PhysicalSettings) => void) {
  update((d) => {
    const next: PhysicalSettings = JSON.parse(JSON.stringify(physicalSettings(d as KimballProject)));
    recipe(next);
    d.physical = next;
  });
}

/** Sample cells as a database shows them; `pretty` adds thousands separators for aggregated values. */
const formatCell = (v: Cell, pretty = false) =>
  v === null ? '–' : typeof v === 'boolean' ? (v ? 'true' : 'false') : typeof v === 'number' && pretty ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);

const copy = (text: string, what: string) => copyWithToast(text, `${what} copied.`);

// ─── Settings ───

function Settings({ settings, model }: { settings: PhysicalSettings; model: PhysicalModel }) {
  const facts = model.tables.filter((t) => t.kind === 'fact');
  return (
    <div className="card proto-settings">
      <div className="field">
        <span className="field-label">SQL dialect</span>
        <Segmented label="SQL dialect" value={settings.dialect} options={SQL_DIALECTS} onChange={(v) => setPhysical((s) => void (s.dialect = v))} />
      </div>
      <div className="field">
        <span className="field-label">Sample dates</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            type="date"
            className="input"
            aria-label="First sample date"
            value={settings.dateFrom}
            max={settings.dateTo}
            onChange={(e) => e.target.value && setPhysical((s) => void (s.dateFrom = e.target.value <= s.dateTo ? e.target.value : s.dateTo))}
          />
          <span className="hint">to</span>
          <input
            type="date"
            className="input"
            aria-label="Last sample date"
            value={settings.dateTo}
            min={settings.dateFrom}
            onChange={(e) => e.target.value && setPhysical((s) => void (s.dateTo = e.target.value >= s.dateFrom ? e.target.value : s.dateFrom))}
          />
        </div>
      </div>
      <div className="field">
        <span className="field-label">Sample rows</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button type="button" className="btn" onClick={() => setPhysical((s) => void (s.seed = (s.seed + 1) % 2 ** 31))} title="Generate a different set of random rows">
            <IconSparkle /> New sample
          </button>
          <span className="hint">
            Seed {settings.seed} · {facts.reduce((n, t) => n + rowCount(t, settings), 0).toLocaleString()} fact rows
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Explorer ───

function GroupSelect({ label, value, options, onChange, allowNone }: { label: string; value: string; options: GroupOption[]; onChange: (key: string) => void; allowNone?: string }) {
  const sections = [...new Set(options.map((o) => o.section))];
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone !== undefined && <option value="">{allowNone}</option>}
        {sections.map((s) => (
          <optgroup key={s} label={s}>
            {options
              .filter((o) => o.section === s)
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Fact tables with at least one dimension key: the ones the explorer can group. */
const explorableFacts = (model: PhysicalModel) =>
  model.tables.filter((t) => t.kind === 'fact' && t.columns.some((c) => c.role === 'foreign-key' || c.role === 'degenerate'));

/** The explorer's question: the draft while it still fits the design, otherwise a sensible default. */
function currentQuery(model: PhysicalModel, draft: ExploreQuery | null): ExploreQuery | null {
  const facts = explorableFacts(model);
  const fact = facts.find((f) => f.name === draft?.fact) ?? facts[0];
  if (!fact) return null;
  const keys = new Set(groupOptions(model, fact).map((o) => o.key));
  const measures = fact.columns.filter((c) => c.role === 'measure');
  const valid =
    draft &&
    draft.fact === fact.name &&
    (draft.measure === null || measures.some((m) => m.name === draft.measure)) &&
    draft.groupBy.every((g) => keys.has(groupKey(g))) &&
    (!draft.filter || keys.has(groupKey(draft.filter.by)));
  return valid ? draft : defaultQuery(model, fact);
}

const EXPLORE_ID = 'prototype-explore';

function Explorer({
  project,
  model,
  data,
  dialect,
  query,
  setDraft,
}: {
  project: KimballProject;
  model: PhysicalModel;
  data: SampleDataset;
  dialect: SqlDialect;
  query: ExploreQuery | null;
  setDraft: (q: ExploreQuery) => void;
}) {
  const facts = explorableFacts(model);
  const fact = facts.find((f) => f.name === query?.fact);
  if (!fact || !query) {
    return <p className="hint">Give a business process at least one dimension to explore it.</p>;
  }
  const options = groupOptions(model, fact);
  const measures = fact.columns.filter((c) => c.role === 'measure');
  const set = (patch: Partial<ExploreQuery>) => setDraft({ ...query, ...patch });
  const result = runQuery(model, data, query, dialect);
  const max = Math.max(1, ...result.rows.map((r) => Math.abs(Number(r[r.length - 1]) || 0)));
  const filterValues = query.filter ? distinctValues(model, data, fact.name, query.filter.by) : [];
  // A saved value may not occur in the made-up rows; show it rather than another value.
  const missingValue = query.filter && !filterValues.includes(query.filter.value) ? query.filter.value : null;
  const process = project.processes.find((p) => p.id === fact.sourceId);
  const answers = requirementAnswers(project, model);
  const linked = answers.filter((a) => process && a.requirement.processIds.includes(process.id) && a.requirement.statement.trim());
  const answerNote = (a: RequirementAnswer) =>
    a.status === 'outdated' ? ' (saved query no longer matches)' : a.status === 'answered' && a.query?.fact === fact.name ? ' (answered)' : '';
  const [first, second] = query.groupBy;

  return (
    <div className="card stack" id={EXPLORE_ID} tabIndex={-1}>
      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Fact table</span>
          <select className="select" value={fact.name} onChange={(e) => setDraft(defaultQuery(model, facts.find((f) => f.name === e.target.value)!))}>
            {facts.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label} ({f.name})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Measure</span>
          <select
            className="select"
            value={query.measure ?? ''}
            onChange={(e) => {
              const m = measures.find((x) => x.name === e.target.value);
              set({ measure: m?.name ?? null, aggregate: !m ? 'count' : m.additivity === 'additive' ? 'sum' : 'avg' });
            }}
          >
            <option value="">Count rows</option>
            {measures.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} ({m.additivity})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Aggregate</span>
          <select className="select" value={query.measure ? query.aggregate : 'count'} disabled={!query.measure} onChange={(e) => set({ aggregate: e.target.value as Aggregate })}>
            {AGGREGATES.filter((a) => (query.measure ? a.value !== 'count' : a.value === 'count')).map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <GroupSelect
          label="Group by"
          value={first ? groupKey(first) : ''}
          options={options}
          allowNone="Nothing (grand total)"
          onChange={(k) => set({ groupBy: k ? [parseGroupKey(k), ...(second ? [second] : [])] : [] })}
        />
        {first && (
          <GroupSelect
            label="Then by"
            value={second ? groupKey(second) : ''}
            options={options}
            allowNone="—"
            onChange={(k) => set({ groupBy: k ? [first, parseGroupKey(k)] : [first] })}
          />
        )}
        <GroupSelect
          label="Filter on"
          value={query.filter ? groupKey(query.filter.by) : ''}
          options={options}
          allowNone="No filter"
          onChange={(k) => {
            if (!k) return set({ filter: null });
            const by = parseGroupKey(k);
            set({ filter: { by, value: distinctValues(model, data, fact.name, by)[0] ?? '' } });
          }}
        />
        {query.filter && (
          <label className="field">
            <span className="field-label">equals</span>
            <select className="select" value={query.filter.value} onChange={(e) => set({ filter: { ...query.filter!, value: e.target.value } })}>
              {missingValue !== null && <option value={missingValue}>{missingValue} (not in the sample data)</option>}
              {filterValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {linked.length > 0 && (
        <p className="hint">
          Questions this process should answer:{' '}
          {linked.map((a) => `${a.label} “${a.requirement.statement.trim()}”${answerNote(a)}`).join(' · ')}
        </p>
      )}
      {result.warning && <div className="callout warning">{result.warning}</div>}

      <div className="table-wrap explore-result">
        <table className="data">
          <thead>
            <tr>
              {result.headers.map((h, i) => (
                <th key={`${h}-${i}`} className={i === result.headers.length - 1 ? 'num' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((v, ci) =>
                  ci === r.length - 1 ? (
                    <td key={ci} className="num bar-cell">
                      <span className="bar" style={{ width: `${Math.round((Math.abs(Number(v) || 0) / max) * 100)}%` }} aria-hidden="true" />
                      <span>{formatCell(v, true)}</span>
                    </td>
                  ) : (
                    <td key={ci}>{formatCell(v)}</td>
                  ),
                )}
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={result.headers.length} className="hint">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="hint">
        {result.groups > result.rows.length ? `Top ${result.rows.length} of ${result.groups} groups. ` : ''}
        Computed from {data.tables[fact.name]?.rows.length.toLocaleString()} made-up rows. The SQL below gives the same answer in the warehouse.
      </p>
      <div className="code-block">
        <pre className="code" aria-label="SQL for this question" tabIndex={0}>
          {result.sql}
        </pre>
        <button type="button" className="btn sm ghost" onClick={() => void copy(result.sql, 'SQL')}>
          <IconCopy /> Copy SQL
        </button>
      </div>
    </div>
  );
}

// ─── Requirements ───

const PRIORITY_ORDER = PRIORITIES.map((p) => p.value);

function RequirementCoverage({
  project,
  model,
  current,
  onShow,
}: {
  project: KimballProject;
  model: PhysicalModel;
  current: ExploreQuery | null;
  onShow: (q: ExploreQuery) => void;
}) {
  // Saving or removing replaces the clicked button, so focus moves to the row's first
  // remaining button (or the row) instead of falling back to the page.
  const table = useRef<HTMLTableElement>(null);
  const [refocus, setRefocus] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!refocus) return;
    const row = table.current?.querySelector<HTMLElement>(`tr[data-id="${refocus}"]`);
    (row?.querySelector<HTMLElement>('button:not(:disabled)') ?? row)?.focus();
    setRefocus(null);
  }, [refocus]);
  const answers = requirementAnswers(project, model)
    .filter((a) => a.requirement.statement.trim() && a.requirement.priority !== 'wont')
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.requirement.priority) - PRIORITY_ORDER.indexOf(b.requirement.priority));
  if (answers.length === 0) {
    return (
      <p className="hint">
        No requirements to check yet. Add them in phase 3 <em>Requirements</em>, then save the question that answers each one.
      </p>
    );
  }
  const saved = current ? toRequirementQuery(model, current) : null;
  const savedText = saved ? describeRequirementQuery(project, saved) : null;
  const must = answers.filter((a) => a.requirement.priority === 'must');
  const isCurrent = (a: RequirementAnswer) => !!saved && JSON.stringify(saved) === JSON.stringify(a.requirement.query);
  const save = (a: RequirementAnswer) => {
    if (!saved) return;
    const process = project.processes.find((p) => p.id === saved.processId);
    const linked = a.requirement.processIds.includes(saved.processId);
    update((d) => {
      const r = d.requirements.find((x) => x.id === a.requirement.id);
      if (!r) return;
      r.query = saved;
      if (!r.processIds.includes(saved.processId)) r.processIds.push(saved.processId);
    });
    setRefocus(a.requirement.id);
    pushToast(
      `${a.label} is answered by the question above.${linked || !process ? '' : ` It is now also linked to ${displayName(process)}.`}`,
      'success',
    );
  };
  const remove = (a: RequirementAnswer) => {
    removeWithUndo(`the answer to ${a.label}`, (d) => {
      const r = d.requirements.find((x) => x.id === a.requirement.id);
      if (r) delete r.query;
    });
    setRefocus(a.requirement.id);
  };

  return (
    <div className="card stack">
      <p>
        <strong>
          {must.filter((a) => a.status === 'answered').length} of {must.length} must-have requirements
        </strong>{' '}
        are answered by a query{answers.length > must.length ? `, and ${answers.filter((a) => a.status === 'answered' && a.requirement.priority !== 'must').length} of ${answers.length - must.length} others` : ''}.
        {answers.some((a) => a.status === 'outdated') && ' Some saved queries no longer match the design: save them again.'}
      </p>
      <p className="hint">
        {savedText ? (
          <>
            The question above: <strong>{savedText}</strong>
          </>
        ) : (
          'Build a question in the explorer above, then save it for the requirement it answers.'
        )}
      </p>
      <div className="table-wrap">
        <table className="data coverage" ref={table}>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th style={{ width: 90 }}>Priority</th>
              <th>Requirement</th>
              <th>Answered by</th>
              <th style={{ width: 1 }}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a) => (
              <tr key={a.requirement.id} data-id={a.requirement.id} tabIndex={-1}>
                <td>{a.label}</td>
                <td>
                  <span className={`badge ${a.requirement.priority === 'must' ? 'fact' : ''}`}>{PRIORITIES.find((p) => p.value === a.requirement.priority)!.label}</span>
                </td>
                <td>{a.requirement.statement.trim()}</td>
                <td>
                  {a.status === 'unanswered' ? (
                    <span className="hint">Not answered yet</span>
                  ) : (
                    <>
                      {a.description}
                      {a.status === 'outdated' && (
                        <>
                          {' '}
                          <span className="badge warning">No longer matches the design</span>
                        </>
                      )}
                    </>
                  )}
                </td>
                <td>
                  <div className="row coverage-actions">
                    {a.query && (
                      <button type="button" className="btn sm" aria-label={`Show the query for ${a.label}`} onClick={() => onShow(a.query!)}>
                        Show
                      </button>
                    )}
                    {isCurrent(a) ? (
                      <span className="hint">Shown above</span>
                    ) : (
                      <button
                        type="button"
                        className="btn sm"
                        disabled={!saved}
                        aria-label={a.status === 'unanswered' ? `Use the question above for ${a.label}` : `Replace the answer to ${a.label} with the question above`}
                        onClick={() => save(a)}
                      >
                        {a.status === 'unanswered' ? 'Use the question above' : 'Replace'}
                      </button>
                    )}
                    {a.status !== 'unanswered' && (
                      <button type="button" className="btn sm ghost" aria-label={`Remove the answer to ${a.label}`} onClick={() => remove(a)}>
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tables ───

function AttributeEditor({ table, project }: { table: PhysicalTable; project: KimballProject }) {
  const dim = project.dimensions.find((d) => d.id === table.sourceId);
  if (!dim) return null;
  const attrs = dim.attributes.filter((a) => a.name.trim());
  if (attrs.length === 0) return null;
  const edit = (attrId: string, recipe: (a: (typeof attrs)[number]) => void) =>
    update((d) => {
      const a = d.dimensions.find((x) => x.id === dim.id)?.attributes.find((x) => x.id === attrId);
      if (a) recipe(a);
    });
  return (
    <details className="attr-editor">
      <summary>Make the data look real: types, business key and sample values</summary>
      <p className="hint" style={{ margin: '8px 0 12px' }}>
        Sample values replace the generated ones, so the rows look like your business. Ask Claude to suggest them, or type a few and press Enter.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Attribute</th>
              <th style={{ width: 150 }}>Data type</th>
              <th style={{ width: 110 }}>Business key</th>
              <th>Sample values</th>
            </tr>
          </thead>
          <tbody>
            {attrs.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <select
                    className="select"
                    aria-label={`Data type of ${a.name}`}
                    value={a.dataType ?? ''}
                    onChange={(e) =>
                      edit(a.id, (x) => {
                        if (e.target.value) x.dataType = e.target.value as DataType;
                        else delete x.dataType;
                      })
                    }
                  >
                    <option value="">Automatic</option>
                    {DATA_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${a.name} is the business key`}
                    checked={!!a.businessKey}
                    onChange={(e) =>
                      edit(a.id, (x) => {
                        if (e.target.checked) x.businessKey = true;
                        else delete x.businessKey;
                      })
                    }
                  />
                </td>
                <td>
                  <TagInput
                    label={`Sample values for ${a.name}`}
                    hideLabel
                    values={a.sampleValues ?? []}
                    placeholder="e.g. a few real-looking values"
                    onChange={(v) =>
                      edit(a.id, (x) => {
                        if (v.length) x.sampleValues = v;
                        else delete x.sampleValues;
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Number of sample rows; applied on Enter or when leaving the field, so typing doesn't regenerate on every key. */
function RowCountField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 1) onCommit(Math.min(SAMPLE_ROWS_MAX, n));
    else setDraft(String(value));
  };
  return (
    <label className="row" style={{ gap: 8 }}>
      <span className="field-label">Sample rows</span>
      <input
        type="number"
        className="input"
        style={{ width: 120 }}
        min={1}
        max={SAMPLE_ROWS_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  );
}

function TableCard({ table, project, data, settings }: { table: PhysicalTable; project: KimballProject; data: SampleDataset; settings: PhysicalSettings }) {
  const rows = data.tables[table.name];
  const preview = rows?.rows.slice(0, 8) ?? [];
  const count = rows?.rows.length ?? 0;
  const editableRows = !table.calendar;
  return (
    <details className={`card table-card ${table.kind === 'fact' ? 'accent-fact' : 'accent-dim'}`}>
      <summary>
        <span className="mono table-name">{table.name}</span>
        <span className={`badge ${table.kind === 'fact' ? 'fact' : 'dim'}`}>{table.kind === 'fact' ? 'Fact' : table.calendar ? 'Date dimension' : 'Dimension'}</span>
        {table.scd2 && <span className="badge">Type 2 history</span>}
        <span className="hint">
          {table.columns.length} columns · {count.toLocaleString()} sample rows
        </span>
      </summary>
      <div className="stack" style={{ marginTop: 12 }}>
        {table.grain && <p className="hint mono">{table.grain}</p>}
        <div className="table-wrap">
          <table className="data columns">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type ({SQL_DIALECTS.find((d) => d.value === settings.dialect)!.label})</th>
                <th>Key</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((c) => (
                <tr key={c.name}>
                  <td className="mono">{c.name}</td>
                  <td className="mono">
                    {sqlType(c, settings.dialect)}
                    {c.nullable ? '' : ' not null'}
                  </td>
                  <td>
                    {ROLE_LABEL[c.role] && <span className={`badge ${c.role === 'foreign-key' ? 'dim' : c.role === 'measure' ? 'fact' : ''}`}>{ROLE_LABEL[c.role]}</span>}
                    {c.added && <span className="badge warning" title="Not in the design: added by Kimball Designer">added</span>}
                  </td>
                  <td className="hint">
                    {c.references ? `→ ${c.references.table}. ` : ''}
                    {c.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {preview.length > 0 && (
          <div className="table-wrap">
            <table className="data sample">
              <thead>
                <tr>
                  {rows!.columns.map((c) => (
                    <th key={c} className="mono">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, ci) => (
                      <td key={ci} className={typeof v === 'number' ? 'num' : undefined}>
                        {formatCell(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row">
          {editableRows ? (
            <RowCountField
              key={settings.rows[table.sourceId] ?? defaultRows(table)}
              value={settings.rows[table.sourceId] ?? defaultRows(table)}
              onCommit={(n) =>
                setPhysical((s) => {
                  if (n === defaultRows(table)) delete s.rows[table.sourceId];
                  else s.rows[table.sourceId] = n;
                })
              }
            />
          ) : (
            <span className="hint">One row per day from {settings.dateFrom} to {settings.dateTo}.</span>
          )}
        </div>
        {table.kind === 'dimension' && !table.calendar && <AttributeEditor table={table} project={project} />}
      </div>
    </details>
  );
}

// ─── SQL ───

type SqlView = 'ddl' | 'advice' | 'seed';

function SqlPanel({ project, model, data, settings }: { project: KimballProject; model: PhysicalModel; data: SampleDataset; settings: PhysicalSettings }) {
  const [view, setView] = useState<SqlView>('ddl');
  const base = slugify(project.meta.name, 'project');
  const ddl = useMemo(() => ddlScript(project, { dialect: settings.dialect, model }), [project, settings.dialect, model]);
  const adviceGroups = groupAdvice(indexAdvice(model, settings.dialect)).filter((g) => g.when !== 'table');
  const seedPreview = view === 'seed' ? seedScript(project, data, settings.dialect, model) : '';
  const dialectLabel = SQL_DIALECTS.find((d) => d.value === settings.dialect)!.label;
  const zip = (name: string, files: { name: string; data: string }[]) =>
    downloadBlob(`${name}.zip`, new Blob([createZip(files.map((f) => ({ name: `${name}/${f.name}`, data: f.data }))) as BlobPart], { type: 'application/zip' }));
  const sandbox = () => zip(`${base}-prototype`, prototypeFiles(project, settings));
  const dbt = () => zip(`${base}-dbt`, dbtProjectFiles(project, settings, model, data));
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: 'ddl', label: 'CREATE TABLE script', description: '' },
            { value: 'advice', label: `Index advice (${adviceGroups.length})`, description: '' },
            { value: 'seed', label: 'Sample data (INSERT)', description: '' },
          ]}
        />
      </div>
      {view === 'advice' ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="hint">
            <strong>Now</strong> is created by the script; <strong>later</strong> is in the script as comments, for when a table grows or the
            grain is confirmed. Primary and foreign keys are part of each CREATE TABLE.
          </p>
          {model.tables.map((t) => {
            const groups = adviceGroups.filter((g) => g.table === t.name);
            if (!groups.length) return null;
            return (
              <div className="advice-table" key={t.name}>
                <h3 className="mono">{t.name}</h3>
                <ul>
                  {groups.map((g, i) => (
                    <li key={i}>
                      <span className={`badge ${g.when === 'later' ? '' : 'success'}`}>{g.when === 'later' ? 'Later' : 'Now'}</span>
                      <div>
                        <p>{g.why}</p>
                        {g.columns.length > 0 && <p className="hint mono">{g.columns.join(', ')}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="code-block">
          <pre className="code tall" tabIndex={0} aria-label={view === 'ddl' ? 'CREATE TABLE script' : 'Sample data script'}>
            {view === 'ddl' ? ddl : seedPreview.length > 60_000 ? `${seedPreview.slice(0, 60_000)}\n-- … download the file for the rest` : seedPreview}
          </pre>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn fact" onClick={sandbox}>
          <IconDownload /> Docker sandbox (.zip)
        </button>
        <button type="button" className="btn" onClick={dbt}>
          <IconDownload /> dbt project (.zip)
        </button>
        <button type="button" className="btn" onClick={() => downloadText(`${base}-schema.${settings.dialect}.sql`, ddl, 'application/sql')}>
          <IconDownload /> CREATE TABLE (.sql)
        </button>
        <button type="button" className="btn" onClick={() => downloadText(`${base}-data.${settings.dialect}.sql`, seedScript(project, data, settings.dialect, model), 'application/sql')}>
          <IconDownload /> Sample data (.sql)
        </button>
        <button type="button" className="btn" onClick={() => downloadText(`${base}-index-recommendations.md`, indexAdviceToMarkdown(project, settings.dialect, model), 'text/markdown')}>
          <IconDownload /> Index advice (.md)
        </button>
        <button type="button" className="btn ghost" onClick={() => void copy(ddl, 'CREATE TABLE script')}>
          <IconCopy /> Copy script
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        The sandbox runs PostgreSQL in Docker with these tables and rows: unzip it and run <code>docker compose up -d</code>, then connect to{' '}
        <code>127.0.0.1:5433</code> (database and user <code>kimball</code>). It also contains the script for {dialectLabel}, the index advice and CSV files.
      </p>
      <p className="hint">
        The dbt project has a model per table with descriptions and tests from the design, and the sample rows as seeds.{' '}
        {settings.dialect === 'postgres' ? (
          <>
            <code>dbt seed</code>, <code>dbt run</code> and <code>dbt test</code> work against the sandbox as they are.
          </>
        ) : (
          <>Its profile reads the {dialectLabel} connection from environment variables; choose PostgreSQL to run it against the sandbox.</>
        )}{' '}
        Its README explains how to swap the seeds for your staging models.
      </p>
    </>
  );
}

// ─── Phase ───

export function PrototypePhase() {
  const project = useProject();
  const sync = useSyncStatus();
  const settings = useMemo(() => physicalSettings(project), [project]);
  const model = useMemo(() => physicalModel(project), [project]);
  const data = useMemo(() => generateSampleData(project, model, settings), [project, model, settings]);
  const [draft, setDraft] = useState<ExploreQuery | null>(null);
  const query = currentQuery(model, draft);
  const show = (q: ExploreQuery) => {
    setDraft(q);
    const explorer = document.getElementById(EXPLORE_ID);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    explorer?.scrollIntoView?.({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    explorer?.focus({ preventScroll: true });
  };
  const notReady = project.processes.filter((p) => !isReadyToBuild(p));
  const file = sync.mode === 'server' ? (sync.fileName ?? 'the project file') : 'kimball/project.kimball.json';
  const prompt = `Use the kimball-designer skill on ${file}: suggest realistic sample values, data types and business keys for the dimension attributes (ask me before you record them), then run "kimball prototype" and start the Docker sandbox so we can query the design.`;

  return (
    <PhaseFrame
      phase="prototype"
      lead={
        <div className="callout fact">
          <strong>Try the design with data.</strong> Every dimension and business process becomes a table filled with made-up rows. Ask
          your requirements' questions below, then take the CREATE TABLE script and index advice into the build.
        </div>
      }
    >
      {project.processes.length === 0 ? (
        <EmptyState
          title="Nothing to build yet"
          actions={
            <button type="button" className="btn primary" onClick={() => goToPhase('processes')}>
              Add business processes
            </button>
          }
        >
          The prototype is made from your business processes and dimensions.
        </EmptyState>
      ) : (
        <>
          {notReady.length > 0 && (
            <div className="callout warning" style={{ marginBottom: 16 }}>
              Not ready to build yet:{' '}
              {notReady.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ' · '}
                  <strong>{displayName(p, 'Untitled process')}</strong> needs{' '}
                  {[!p.grain.trim() && 'a grain', p.dimensions.length === 0 && 'dimensions', p.facts.length === 0 && p.factTableType !== 'factless' && 'facts']
                    .filter(Boolean)
                    .join(', ')}
                </span>
              ))}
              . It still gets a table, but the data is thin.
            </div>
          )}
          <Settings settings={settings} model={model} />

          <section className="section">
            <SectionHead title="Explore">Group the facts by any attribute. Does the design answer the questions people asked?</SectionHead>
            <Explorer project={project} model={model} data={data} dialect={settings.dialect} query={query} setDraft={setDraft} />
          </section>

          <section className="section">
            <SectionHead title="Requirements">
              Save the question that answers each requirement. The requirements document shows it, and the sandbox's queries.sql gets the
              SQL.
            </SectionHead>
            <RequirementCoverage project={project} model={model} current={query} onShow={show} />
          </section>

          <section className="section">
            <SectionHead title="Tables">
              {model.tables.filter((t) => t.kind === 'dimension').length} dimension and {model.tables.filter((t) => t.kind === 'fact').length} fact tables.
              Open one to see its columns and sample rows.
            </SectionHead>
            <div className="stack" style={{ gap: 8 }}>
              {model.tables.map((t) => (
                <TableCard key={t.name} table={t} project={project} data={data} settings={settings} />
              ))}
            </div>
            {model.notes.length > 0 && (
              <ul className="hint" style={{ marginTop: 8 }}>
                {model.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="section">
            <SectionHead title="SQL and downloads">
              A starting point for the detailed design: review names, data types and keys before you build.
            </SectionHead>
            <SqlPanel project={project} model={model} data={data} settings={settings} />
          </section>

          <section className="section">
            <SectionHead
              title="Ask Claude to make it real"
              actions={
                <button type="button" className="btn" onClick={() => void copy(prompt, 'Prompt')}>
                  <IconCopy /> Copy prompt
                </button>
              }
            >
              With the kimball-designer skill, Claude can suggest sample values that look like your business, set data types and business
              keys, write the bundle and start the sandbox for you.
            </SectionHead>
            <pre className="summary">{prompt}</pre>
          </section>
        </>
      )}
    </PhaseFrame>
  );
}
