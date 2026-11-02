import { useEffect, useMemo, type ReactNode } from 'react';
import {
  APP_VERSION,
  HELP_CLI,
  HELP_DELIVERABLES,
  HELP_DELIVERABLES_LEAD,
  HELP_DEMOS,
  HELP_FAQ,
  HELP_GLOSSARY,
  HELP_NEXT_STEPS,
  HELP_NOT_INCLUDED,
  HELP_NOT_INCLUDED_LEAD,
  HELP_OUTCOMES,
  HELP_OVERVIEW,
  HELP_PHASES,
  HELP_SAVING,
  HELP_SECTIONS,
  HELP_SHORTCUTS,
  HELP_WAYS,
  PHASES,
  REPO_URL,
  RULES,
  STAGES,
  loadExample,
  phaseDef,
  type HelpDemo,
} from '../../core';
import { useResolvedTheme } from '../lib/theme';
import { startDemo } from '../store/demo';
import { goToPhase, helpHref } from '../store/routing';
import { useProject, useStore } from '../store/store';
import { useSyncStatus } from '../store/sync';
import { BubbleDiagram } from './BubbleDiagram';
import { BusMatrixGrid } from './BusMatrixGrid';
import { ThemeToggle } from './Header';
import { IconArrowLeft, IconArrowRight, IconPlay, LogoMark } from './icons';
import { CodeBlock, Rich } from './Rich';

const SAMPLE_TIME = '2026-01-01T00:00:00.000Z';

/** Full help: what the product is, what the process delivers, demos and reference. */
export function HelpPage({ section }: { section: string | null }) {
  const started = useStore((s) => s.started);
  const project = useProject();
  const server = useSyncStatus().mode === 'server';

  useEffect(() => {
    const el = section ? document.getElementById(`help-${section}`) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [section]);

  const back = () => {
    if (started) goToPhase(project.meta.currentPhase);
    else window.location.hash = '';
  };
  const begin = (id: string) => void startDemo(id, server);

  return (
    <div className="help">
      <header className="help-top">
        <button type="button" className="brand brand-button" onClick={back} aria-label="Kimball Designer: back to the app">
          <LogoMark size={30} />
          <span>
            Kimball <small>Designer</small>
          </span>
        </button>
        <span className="help-top-title">Help</span>
        <div className="header-actions">
          <ThemeToggle />
          <button type="button" className="btn sm" onClick={back}>
            <IconArrowLeft /> {started ? 'Back to your project' : 'Back to start'}
          </button>
        </div>
      </header>

      <div className="help-layout">
        <nav className="help-toc" aria-label="Help contents">
          <ol>
            {HELP_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={helpHref(s.id)}
                  aria-current={section === s.id ? 'location' : undefined}
                  onClick={() => document.getElementById(`help-${s.id}`)?.scrollIntoView({ block: 'start' })}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="help-main" id="kd-help">
          <Overview begin={begin} />
          <Deliverables />
          <Phases started={started} />
          <Demos begin={begin} />
          <Ways />
          <Saving />
          <Glossary />
          <Rules />
          <Shortcuts />
          <Faq />
          <footer className="help-foot">
            <p>
              Still stuck? <a href={`${REPO_URL}/issues/new/choose`}>Open an issue</a> · <a href={`${REPO_URL}/blob/main/docs/USER-GUIDE.md`}>User guide on GitHub</a> ·{' '}
              <a href={REPO_URL}>Source code</a>
            </p>
            <p className="hint">
              Kimball Designer {APP_VERSION}. An independent open-source project, not affiliated with the Kimball Group.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={`help-${id}`} className="help-section" aria-labelledby={`help-h-${id}`}>
      <h2 id={`help-h-${id}`}>{title}</h2>
      {lead && (
        <p className="help-lead">
          <Rich text={lead} />
        </p>
      )}
      {children}
    </section>
  );
}

function Overview({ begin }: { begin: (id: string) => void }) {
  return (
    <section id="help-overview" className="help-section" aria-labelledby="help-h-overview">
      <div className="help-hero">
        <LogoMark size={64} />
        <div>
          <p className="help-kicker">Help &amp; demos</p>
          <h1 id="help-h-overview">How Kimball Designer works</h1>
        </div>
      </div>
      {HELP_OVERVIEW.intro.map((p) => (
        <p key={p} className="help-lead">
          <Rich text={p} />
        </p>
      ))}
      <div className="row help-cta">
        <button type="button" className="btn primary" onClick={() => begin('tour')}>
          <IconPlay /> Take the 3-minute tour
        </button>
        <button type="button" className="btn" onClick={() => begin('first-process')}>
          <IconPlay /> Model your first process
        </button>
        <a className="btn ghost" href={helpHref('deliverables')}>
          What you get <IconArrowRight />
        </a>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Who it is for</h3>
          <ul className="help-list">
            {HELP_OVERVIEW.audience.map((a) => (
              <li key={a}>
                <Rich text={a} />
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>How it flows</h3>
          <p>
            <Rich text={HELP_OVERVIEW.howItFlows} />
          </p>
          <ul className="help-stages">
            {STAGES.map((s) => (
              <li key={s.id}>
                <span className={`stage-chip ${s.id}`}>{s.title}</span> {s.description}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Deliverables() {
  const theme = useResolvedTheme();
  const sample = useMemo(() => loadExample('retail', SAMPLE_TIME), []);
  const sales = sample.processes[0]!;
  return (
    <Section id="deliverables" title="What you get" lead={HELP_DELIVERABLES_LEAD}>
      <h3>What the process gives you</h3>
      <div className="help-outcomes">
        {HELP_OUTCOMES.map((o) => (
          <div key={o.title} className="help-outcome">
            <h4>{o.title}</h4>
            <p>
              <Rich text={o.text} />
            </p>
          </div>
        ))}
      </div>

      <h3>See it on a real project</h3>
      <p className="hint help-gap">
        Both pictures below come from the Retail example and are drawn live from its project file, exactly as your own will be.
      </p>
      <figure className="help-figure">
        <BubbleDiagram project={sample} process={sales} theme={theme} />
        <figcaption>
          <strong>Bubble diagram</strong> for {sales.name}: the business process in the middle, its dimensions around it,
          conformed ones in amber, and the grain underneath.
        </figcaption>
      </figure>
      <figure className="help-figure">
        <BusMatrixGrid project={sample} editable={false} />
        <figcaption>
          <strong>Enterprise bus matrix</strong>: four business processes against eleven dimensions. The amber columns are
          shared, so they are built once and reused.
        </figcaption>
      </figure>

      <h3>The deliverables</h3>
      <div className="help-deliverables">
        {HELP_DELIVERABLES.map((d) => (
          <article key={d.id} className="card help-deliverable">
            <h4>{d.title}</h4>
            <p className="hint">
              <Rich text={d.formats} />
            </p>
            <p>
              <Rich text={d.summary} />
            </p>
            <dl className="help-facts">
              <dt>What is inside</dt>
              <dd>
                <ul className="help-list">
                  {d.contains.map((c) => (
                    <li key={c}>
                      <Rich text={c} />
                    </li>
                  ))}
                </ul>
              </dd>
              <dt>Who uses it</dt>
              <dd>
                <Rich text={d.usedBy} />
              </dd>
              <dt>Why it matters</dt>
              <dd>
                <Rich text={d.why} />
              </dd>
              <dt>Where to find it</dt>
              <dd>
                <Rich text={d.where} />
              </dd>
            </dl>
          </article>
        ))}
      </div>

      <div className="grid-2 help-gap-top">
        <div className="card accent-fact">
          <h3>What happens next</h3>
          <ol className="help-list">
            {HELP_NEXT_STEPS.map((s) => (
              <li key={s}>
                <Rich text={s} />
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h3>Not included</h3>
          <p className="hint">{HELP_NOT_INCLUDED_LEAD}</p>
          <ul className="help-list">
            {HELP_NOT_INCLUDED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Phases({ started }: { started: boolean }) {
  return (
    <Section id="phases" title="The eleven phases" lead="Each phase is short and has one job. The stepper on the left of the app shows which are done; the coach panel explains the current one.">
      {STAGES.map((stage) => (
        <div key={stage.id} className="help-stage">
          <h3>
            <span className={`stage-chip ${stage.id}`}>{stage.title}</span>
            <span className="help-stage-desc">{stage.description}</span>
          </h3>
          <div className="help-phase-grid">
            {PHASES.filter((p) => p.stage === stage.id).map((p) => {
              const h = HELP_PHASES[p.id];
              return (
                <article key={p.id} className="card help-phase">
                  <h4>
                    <span className="help-phase-num">{p.number}</span> {p.title}
                  </h4>
                  <p className="hint">{p.goal}</p>
                  <dl className="help-facts">
                    <dt>You do</dt>
                    <dd>
                      <Rich text={h.youDo} />
                    </dd>
                    <dt>You record</dt>
                    <dd>
                      <Rich text={h.youRecord} />
                    </dd>
                    <dt>Done when</dt>
                    <dd>
                      <Rich text={h.doneWhen} />
                    </dd>
                  </dl>
                  {started && (
                    <a className="btn sm ghost" href={`#/${p.id}`}>
                      Open {p.title} <IconArrowRight />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </Section>
  );
}

function setupNote(d: HelpDemo): string {
  switch (d.setup.kind) {
    case 'blank':
      return 'Starts a new, empty project.';
    case 'example':
      return 'Opens an example project.';
    case 'current-or-example':
      return 'Uses your open project.';
    default:
      return '';
  }
}

function Demos({ begin }: { begin: (id: string) => void }) {
  return (
    <Section
      id="demos"
      title="Demos"
      lead="Learn by doing. Press **Start**: a demo bar at the bottom of the screen walks you through each step in the real app and ticks steps off as you do them. Leave any time with ✕. If a project is open, you are asked before it is replaced."
    >
      <div className="help-demos">
        {HELP_DEMOS.map((d) => (
          <article key={d.id} className={`card help-demo${d.setup.kind === 'none' ? ' wide' : ''}`}>
            <div className="card-head">
              <h3>{d.title}</h3>
              <span className="badge">{d.minutes} min</span>
            </div>
            <p>
              <Rich text={d.summary} />
            </p>
            {d.setup.kind === 'none' ? (
              <ol className="help-steps">
                {d.steps.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}.</strong> <Rich text={s.body} />
                    {s.code && <CodeBlock code={s.code} label={s.title} />}
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <details className="help-details">
                  <summary>The {d.steps.length} steps</summary>
                  <ol className="help-list">
                    {d.steps.map((s) => (
                      <li key={s.title}>
                        <strong>{s.title}</strong>
                        {s.phase && <span className="hint"> · {phaseDef(s.phase).title}</span>}
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="row help-demo-start">
                  <button type="button" className="btn primary" aria-label={`Start demo: ${d.title}`} onClick={() => begin(d.id)}>
                    <IconPlay /> Start demo
                  </button>
                  <span className="hint">{setupNote(d)}</span>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}

function Ways() {
  return (
    <Section id="ways" title="Ways to use it" lead="The same project file works everywhere, so you can switch between these at any time.">
      <div className="grid-2">
        {HELP_WAYS.map((w) => (
          <article key={w.id} className="card">
            <h3>{w.title}</h3>
            <p className="hint help-gap">
              <strong>Best for:</strong> <Rich text={w.bestFor} />
            </p>
            <ul className="help-list">
              {w.steps.map((s) => (
                <li key={s}>
                  <Rich text={s} />
                </li>
              ))}
            </ul>
            {w.code && <CodeBlock code={w.code} label={w.title} />}
          </article>
        ))}
      </div>
      <h3 className="help-gap-top">Command line</h3>
      <p className="help-gap">
        The <code>kimball</code> CLI ships inside the skill and needs only Node 18 or later:{' '}
        <code>node plugin/skills/kimball-designer/scripts/kimball.mjs &lt;command&gt;</code>
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="kimball commands">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            {HELP_CLI.map((c) => (
              <tr key={c.command}>
                <td>
                  <code>kimball {c.command}</code>
                </td>
                <td>
                  <Rich text={c.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Saving() {
  return (
    <Section id="saving" title="Saving and privacy">
      <div className="grid-2">
        {HELP_SAVING.map((s) => (
          <div key={s.title} className="card">
            <h3>{s.title}</h3>
            <p>
              <Rich text={s.text} />
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Glossary() {
  return (
    <Section id="glossary" title="Glossary" lead="The Kimball terms used in the app, in plain words.">
      <dl className="help-glossary">
        {HELP_GLOSSARY.map((t) => (
          <div key={t.term}>
            <dt>{t.term}</dt>
            <dd>
              <Rich text={t.definition} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Rules() {
  return (
    <Section
      id="rules"
      title="Validation rules"
      lead={`Errors must be fixed, warnings usually should be, and notes are judgement calls. The full rationale is in [METHODOLOGY.md](${REPO_URL}/blob/main/docs/METHODOLOGY.md).`}
    >
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Validation rules">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Severity</th>
              <th scope="col">Rule</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.code}>
                <td className="mono">{r.code}</td>
                <td>
                  <span className={`badge ${r.severity}`}>{r.severity}</span>
                </td>
                <td>{r.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Shortcuts() {
  return (
    <Section id="shortcuts" title="Keyboard shortcuts">
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Keyboard shortcuts">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Keys</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {HELP_SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td>
                  <kbd>{s.keys}</kbd>
                </td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Faq() {
  return (
    <Section id="faq" title="FAQ">
      <div className="help-faq">
        {HELP_FAQ.map((f) => (
          <details key={f.q} className="help-details">
            <summary>{f.q}</summary>
            <p>
              <Rich text={f.a} />
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
