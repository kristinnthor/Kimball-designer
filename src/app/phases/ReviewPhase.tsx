import {
  bubbleToMermaid,
  bubbleToSvg,
  busMatrixToCsv,
  busMatrixToHtml,
  busMatrixToMarkdown,
  countBySeverity,
  displayName,
  phaseDef,
  projectSummaryText,
  requirementsToMarkdown,
  serializeProject,
  slugify,
  type Finding,
  type KimballProject,
} from '../../core';
import { IconCopy, IconDownload } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { SectionHead } from '../components/ui';
import { copyText, downloadBlob, downloadText } from '../lib/files';
import { createZip, type ZipEntry } from '../lib/zip';
import { useFindings } from '../store/derived';
import { goToPhase } from '../store/routing';
import { useProject } from '../store/store';
import { useSyncStatus } from '../store/sync';
import { pushToast } from '../store/toasts';

/** Every deliverable, with the same names the CLI `render` command uses. */
export function deliverables(project: KimballProject): ZipEntry[] {
  const base = slugify(project.meta.name, 'project');
  const entries: ZipEntry[] = [
    { name: `${base}.kimball.json`, data: serializeProject(project) },
    { name: 'requirements.md', data: requirementsToMarkdown(project) },
    { name: 'bus-matrix.md', data: busMatrixToMarkdown(project) },
    { name: 'bus-matrix.csv', data: busMatrixToCsv(project) },
    { name: 'bus-matrix.html', data: busMatrixToHtml(project) },
  ];
  const used = new Set<string>();
  for (const p of project.processes) {
    let slug = slugify(displayName(p), 'process');
    while (used.has(slug)) slug += '-2';
    used.add(slug);
    entries.push({ name: `bubbles/${slug}.svg`, data: bubbleToSvg(project, p) }, { name: `bubbles/${slug}.mmd`, data: bubbleToMermaid(project, p) });
  }
  return entries;
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className="finding">
      <span className={`badge ${f.severity}`}>{f.severity}</span>
      <div className="body">
        <p>
          {f.message} <span className="hint mono">{f.code}</span>
        </p>
        <p className="hint">{f.hint}</p>
      </div>
      <button type="button" className="btn sm" onClick={() => goToPhase(f.phase)}>
        Fix in {phaseDef(f.phase).title}
      </button>
    </div>
  );
}

export function ReviewPhase() {
  const project = useProject();
  const findings = useFindings();
  const counts = countBySeverity(findings);
  const sync = useSyncStatus();
  const base = slugify(project.meta.name, 'project');
  const summary = projectSummaryText(project);

  return (
    <PhaseFrame phase="review">
      <div className="stat-grid">
        <div className="stat">
          <b style={{ color: counts.error ? 'var(--kd-danger)' : 'var(--kd-success)' }}>{counts.error}</b>
          <span>errors</span>
        </div>
        <div className="stat">
          <b style={{ color: counts.warning ? 'var(--kd-warning)' : 'var(--kd-success)' }}>{counts.warning}</b>
          <span>warnings</span>
        </div>
        <div className="stat">
          <b>{counts.info}</b>
          <span>notes</span>
        </div>
        <div className="stat">
          <b>{project.openQuestions.filter((q) => q.status === 'open').length}</b>
          <span>open questions</span>
        </div>
      </div>

      <section className="section">
        <SectionHead title="Findings">Errors must be fixed; warnings usually should be; notes are judgement calls.</SectionHead>
        {findings.length === 0 ? (
          <div className="callout fact">No findings — the model follows every rule Kimball Designer checks.</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {findings.map((f, i) => (
              <FindingRow key={`${f.code}-${f.target.id ?? ''}-${i}`} f={f} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <SectionHead
          title="Deliverables"
          actions={
            <button type="button" className="btn fact" onClick={() => downloadBlob(`${base}-kimball-deliverables.zip`, new Blob([createZip(deliverables(project)) as BlobPart], { type: 'application/zip' }))}>
              <IconDownload /> Download all (.zip)
            </button>
          }
        >
          The same files <code>kimball render</code> produces.
        </SectionHead>
        <div className="row">
          <button type="button" className="btn" onClick={() => downloadText(`${base}.kimball.json`, serializeProject(project), 'application/json')}>
            <IconDownload /> Project file
          </button>
          <button type="button" className="btn" onClick={() => downloadText(`${base}-requirements.md`, requirementsToMarkdown(project), 'text/markdown')}>
            <IconDownload /> Requirements document
          </button>
          <button type="button" className="btn" onClick={() => downloadText(`${base}-bus-matrix.html`, busMatrixToHtml(project), 'text/html')}>
            <IconDownload /> Bus matrix (HTML)
          </button>
          <button type="button" className="btn" onClick={() => goToPhase('bubbles')}>
            Bubble diagrams…
          </button>
        </div>
      </section>

      <section className="section">
        <SectionHead
          title="Hand off to Claude"
          actions={
            <button type="button" className="btn" onClick={async () => pushToast((await copyText(summary)) ? 'Summary copied.' : 'Copy failed.', 'success')}>
              <IconCopy /> Copy summary
            </button>
          }
        >
          {sync.mode === 'server'
            ? `Claude can read ${sync.fileName ?? 'the project file'} directly. Try: "Review my Kimball project, fix the warnings with me and render the deliverables."`
            : 'Export the project file into your repository, then ask Claude: "Use the kimball-designer skill to review kimball/project.kimball.json and render the deliverables."'}
        </SectionHead>
        <pre className="summary">{summary}</pre>
      </section>
    </PhaseFrame>
  );
}
