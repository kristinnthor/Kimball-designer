import { useMemo, useState } from 'react';
import {
  AGGREGATES,
  DATA_TYPES,
  SAMPLE_ROWS_MAX,
  SQL_DIALECTS,
  ddlScript,
  defaultQuery,
  defaultRows,
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
  rowCount,
  runQuery,
  seedScript,
  slugify,
  sqlType,
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
  type SampleDataset,
  type SqlDialect,
} from '../../core';
import { IconCopy, IconDownload, IconSparkle } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, SectionHead, Segmented, TagInput } from '../components/ui';
import { copyText, downloadBlob, downloadText } from '../lib/files';
import { createZip } from '../lib/zip';
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

async function copy(text: string, what: string) {
  const ok = await copyText(text);
  pushToast(ok ? `${what} copied.` : 'Copy failed. Select the text and copy it instead.', ok ? 'success' : 'error');
}

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

function Explorer({ project, model, data, dialect }: { project: KimballProject; model: PhysicalModel; data: SampleDataset; dialect: SqlDialect }) {
  const facts = model.tables.filter((t) => t.kind === 'fact' && t.columns.some((c) => c.role === 'foreign-key' || c.role === 'degenerate'));
  const [draft, setDraft] = useState<ExploreQuery | null>(null);
  const fact = facts.find((f) => f.name === draft?.fact) ?? facts[0];
  if (!fact) {
    return <p className="hint">Give a business process at least one dimension to explore it.</p>;
  }
  const options = groupOptions(model, fact);
  const keys = new Set(options.map((o) => o.key));
  const measures = fact.columns.filter((c) => c.role === 'measure');
  // Fall back to a sensible question when the design changed under the current one.
  const valid =
    draft &&
    draft.fact === fact.name &&
    (draft.measure === null || measures.some((m) => m.name === draft.measure)) &&
    draft.groupBy.every((g) => keys.has(groupKey(g))) &&
    (!draft.filter || keys.has(groupKey(draft.filter.by)));
  const query: ExploreQuery = valid ? draft : defaultQuery(model, fact);
  const set = (patch: Partial<ExploreQuery>) => setDraft({ ...query, ...patch });
  const result = runQuery(model, data, query, dialect);
  const max = Math.max(1, ...result.rows.map((r) => Math.abs(Number(r[r.length - 1]) || 0)));
  const filterValues = query.filter ? distinctValues(model, data, fact.name, query.filter.by) : [];
  const process = project.processes.find((p) => p.id === fact.sourceId);
  const linked = project.requirements.filter((r) => process && r.processIds.includes(process.id) && r.statement.trim());
  const [first, second] = query.groupBy;

  return (
    <div className="card stack">
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
          Questions this process should answer: {linked.map((r) => `“${r.statement.trim()}”`).join(' · ')}
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
  const sandbox = () => {
    const files = prototypeFiles(project, settings).map((f) => ({ name: `${base}-prototype/${f.name}`, data: f.data }));
    downloadBlob(`${base}-prototype.zip`, new Blob([createZip(files) as BlobPart], { type: 'application/zip' }));
  };
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
        <button type="button" className="btn" onClick={() => downloadText(`${base}-schema.${settings.dialect}.sql`, ddl, 'application/sql')}>
          <IconDownload /> CREATE TABLE script
        </button>
        <button type="button" className="btn" onClick={() => downloadText(`${base}-data.${settings.dialect}.sql`, seedScript(project, data, settings.dialect, model), 'application/sql')}>
          <IconDownload /> Sample data
        </button>
        <button type="button" className="btn" onClick={() => downloadText(`${base}-index-recommendations.md`, indexAdviceToMarkdown(project, settings.dialect, model), 'text/markdown')}>
          <IconDownload /> Index advice
        </button>
        <button type="button" className="btn ghost" onClick={() => void copy(ddl, 'CREATE TABLE script')}>
          <IconCopy /> Copy script
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        The sandbox runs PostgreSQL in Docker with these tables and rows: unzip it and run <code>docker compose up -d</code>, then connect to{' '}
        <code>127.0.0.1:5433</code> (database and user <code>kimball</code>). It also contains the script for {dialectLabel}, the index advice and CSV files.
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
            <Explorer project={project} model={model} data={data} dialect={settings.dialect} />
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
