import { useState } from 'react';
import { bubbleToMermaid, bubbleToSvg, displayName, optionLabel, FACT_TABLE_TYPES, slugify } from '../../core';
import { BubbleDiagram } from '../components/BubbleDiagram';
import { IconCopy, IconDownload } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState } from '../components/ui';
import { copyText, downloadBlob, downloadText, svgToPng } from '../lib/files';
import { useResolvedTheme } from '../lib/theme';
import { goToPhase } from '../store/routing';
import { useProject } from '../store/store';
import { pushToast } from '../store/toasts';

export function BubblesPhase() {
  const project = useProject();
  const theme = useResolvedTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const process = project.processes.find((p) => p.id === selectedId) ?? project.processes[0];

  if (!process) {
    return (
      <PhaseFrame phase="bubbles">
        <EmptyState
          title="Nothing to draw yet"
          actions={
            <button type="button" className="btn primary" onClick={() => goToPhase('processes')}>
              Add business processes
            </button>
          }
        >
          Each business process gets its own bubble diagram once it has dimensions.
        </EmptyState>
      </PhaseFrame>
    );
  }

  const name = slugify(displayName(process), 'process');
  return (
    <PhaseFrame phase="bubbles">
      {project.processes.length > 1 && (
        <div className="thumbs" role="group" aria-label="Business process" style={{ marginBottom: 16 }}>
          {project.processes.map((p) => (
            <button key={p.id} type="button" className="thumb" aria-pressed={p.id === process.id} onClick={() => setSelectedId(p.id)}>
              <strong>{displayName(p, 'Untitled process')}</strong>
              <span>
                {optionLabel(FACT_TABLE_TYPES, p.factTableType) || 'Type not set'} · {p.dimensions.length} dims
              </span>
            </button>
          ))}
        </div>
      )}

      <BubbleDiagram project={project} process={process} theme={theme} onDimensionClick={() => goToPhase('dimensions')} />

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={() => downloadText(`${name}.svg`, bubbleToSvg(project, process), 'image/svg+xml')}>
          <IconDownload /> SVG
        </button>
        <button
          type="button"
          className="btn"
          onClick={() =>
            svgToPng(bubbleToSvg(project, process))
              .then((png) => downloadBlob(`${name}.png`, png))
              .catch((e: Error) => pushToast(e.message, 'error'))
          }
        >
          <IconDownload /> PNG
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () =>
            pushToast((await copyText('```mermaid\n' + bubbleToMermaid(project, process) + '```\n')) ? 'Mermaid copied to the clipboard.' : 'Copy failed.', 'success')
          }
        >
          <IconCopy /> Copy Mermaid
        </button>
        <span className="spacer" />
        <span className="hint">Click a dimension to edit it. Downloads use the light theme for documents.</span>
      </div>
    </PhaseFrame>
  );
}
