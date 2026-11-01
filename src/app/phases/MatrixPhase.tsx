import { useState } from 'react';
import { busMatrixToCsv, busMatrixToHtml, busMatrixToMarkdown, deriveBusMatrix, slugify, type BusMatrixOptions } from '../../core';
import { BusMatrixGrid } from '../components/BusMatrixGrid';
import { IconCopy, IconDownload } from '../components/icons';
import { PhaseFrame } from '../components/PhaseFrame';
import { EmptyState, Segmented } from '../components/ui';
import { copyText, downloadText } from '../lib/files';
import { goToPhase } from '../store/routing';
import { useProject } from '../store/store';
import { pushToast } from '../store/toasts';

type RowOrder = NonNullable<BusMatrixOptions['rowOrder']>;
type ColumnOrder = NonNullable<BusMatrixOptions['columnOrder']>;

export function MatrixPhase() {
  const project = useProject();
  const [rowOrder, setRowOrder] = useState<RowOrder>('project');
  const [columnOrder, setColumnOrder] = useState<ColumnOrder>('usage');
  const options: BusMatrixOptions = { rowOrder, columnOrder };
  const m = deriveBusMatrix(project, options);
  const conformed = m.columns.filter((c) => c.conformed).length;
  const base = slugify(project.meta.name, 'project');

  return (
    <PhaseFrame phase="matrix">
      {m.rows.length === 0 || m.columns.length === 0 ? (
        <EmptyState
          title="The matrix needs processes and dimensions"
          actions={
            <button type="button" className="btn primary" onClick={() => goToPhase(m.rows.length ? 'dimensions' : 'processes')}>
              {m.rows.length ? 'Add dimensions' : 'Add business processes'}
            </button>
          }
        />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat">
              <b>{m.rows.length}</b>
              <span>business processes</span>
            </div>
            <div className="stat">
              <b>{m.columns.length}</b>
              <span>dimensions</span>
            </div>
            <div className="stat">
              <b style={{ color: 'var(--kd-conformed-strong)' }}>{conformed}</b>
              <span>conformed dimensions</span>
            </div>
            <div className="stat">
              <b>{m.rows.reduce((s, r) => s + r.cells.filter((c) => c.used).length, 0)}</b>
              <span>process–dimension links</span>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 12, gap: 16 }}>
            <span className="hint">Rows</span>
            <Segmented
              label="Row order"
              value={rowOrder}
              onChange={setRowOrder}
              options={[
                { value: 'project', label: 'As entered', description: '' },
                { value: 'priority', label: 'Priority', description: 'Business value × feasibility' },
                { value: 'name', label: 'A–Z', description: '' },
              ]}
            />
            <span className="hint">Columns</span>
            <Segmented
              label="Column order"
              value={columnOrder}
              onChange={setColumnOrder}
              options={[
                { value: 'usage', label: 'Most shared', description: '' },
                { value: 'catalogue', label: 'Catalogue', description: '' },
                { value: 'name', label: 'A–Z', description: '' },
              ]}
            />
          </div>
          <BusMatrixGrid project={project} options={options} />
          <p className="hint" style={{ marginTop: 8 }}>
            Click a cell (or use arrow keys and Space) to toggle. Amber columns are conformed — agree their definitions first.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => downloadText(`${base}-bus-matrix.md`, busMatrixToMarkdown(project, options), 'text/markdown')}>
              <IconDownload /> Markdown
            </button>
            <button type="button" className="btn" onClick={() => downloadText(`${base}-bus-matrix.csv`, busMatrixToCsv(project, options), 'text/csv')}>
              <IconDownload /> CSV
            </button>
            <button type="button" className="btn" onClick={() => downloadText(`${base}-bus-matrix.html`, busMatrixToHtml(project, options), 'text/html')}>
              <IconDownload /> HTML
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => pushToast((await copyText(busMatrixToMarkdown(project, options))) ? 'Bus matrix copied as Markdown.' : 'Copy failed.', 'success')}
            >
              <IconCopy /> Copy Markdown
            </button>
          </div>
        </>
      )}
    </PhaseFrame>
  );
}
