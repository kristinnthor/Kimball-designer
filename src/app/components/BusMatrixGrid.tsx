import { useRef, type KeyboardEvent } from 'react';
import { deriveBusMatrix, displayName, priorityScore, type BusMatrix, type BusMatrixOptions, type KimballProject } from '../../core';
import { update } from '../store/store';

/**
 * Interactive enterprise bus matrix. Cells are a roving-tabindex grid:
 * arrow keys move, Space/Enter toggles whether the process uses the dimension.
 */
/** Puts the columns in the given order; columns not listed (new dimensions) go last. */
function orderColumns(m: BusMatrix, ids: string[]): BusMatrix {
  const pos = new Map(ids.map((id, i) => [id, i]));
  const rank = (i: number) => pos.get(m.columns[i]!.dimension.id) ?? ids.length + i;
  const order = m.columns.map((_, i) => i).sort((a, b) => rank(a) - rank(b));
  return { columns: order.map((i) => m.columns[i]!), rows: m.rows.map((r) => ({ ...r, cells: order.map((i) => r.cells[i]!) })) };
}

export function BusMatrixGrid({
  project,
  options,
  editable = true,
  columnIds,
}: {
  project: KimballProject;
  options?: BusMatrixOptions;
  editable?: boolean;
  /** Fixed column order, so toggling a cell doesn't re-sort the columns under the pointer. */
  columnIds?: string[];
}) {
  const derived = deriveBusMatrix(project, options);
  const m = columnIds ? orderColumns(derived, columnIds) : derived;
  const tableRef = useRef<HTMLTableElement>(null);

  const toggle = (processId: string, dimensionId: string) =>
    update((d) => {
      const p = d.processes.find((x) => x.id === processId);
      if (!p) return;
      const used = p.dimensions.some((u) => u.dimensionId === dimensionId);
      p.dimensions = used ? p.dimensions.filter((u) => u.dimensionId !== dimensionId) : [...p.dimensions, { dimensionId, roles: [] }];
    });

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    const nr = Math.min(Math.max(r + mv[0], 0), m.rows.length - 1);
    const nc = Math.min(Math.max(c + mv[1], 0), m.columns.length - 1);
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${nr}-${nc}"]`)?.focus();
  };

  if (m.rows.length === 0 || m.columns.length === 0) return null;

  return (
    // Read-only cells are disabled, so the scroll region itself must be focusable for keyboard users.
    <div className="table-wrap" {...(editable ? {} : { tabIndex: 0, role: 'region', 'aria-label': 'Bus matrix (scrollable)' })}>
      <table className="data matrix" ref={tableRef} aria-label="Enterprise bus matrix">
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left' }}>
              Business process
            </th>
            {m.columns.map((col) => (
              <th
                key={col.dimension.id}
                scope="col"
                className={col.conformed ? 'conformed' : ''}
                title={`${displayName(col.dimension)} — used by ${col.usageCount} process(es)${col.conformed ? ' (conformed)' : ''}`}
              >
                {displayName(col.dimension, 'Unnamed')}
                <div className="hint" style={{ fontWeight: 400 }}>
                  {col.usageCount}×
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.rows.map((row, r) => (
            <tr key={row.process.id}>
              <th scope="row">
                {displayName(row.process, 'Untitled process')}
                {priorityScore(row.process) != null && (
                  <span className="badge fact" style={{ marginLeft: 8 }}>
                    {priorityScore(row.process)}
                  </span>
                )}
                {row.process.grain && <span className="grain">{row.process.grain}</span>}
              </th>
              {row.cells.map((cell, c) => {
                const col = m.columns[c]!;
                const label = `${displayName(row.process)} uses ${displayName(col.dimension)}`;
                return (
                  <td key={col.dimension.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={cell.used}
                      aria-label={label}
                      title={cell.roles.length ? `Roles: ${cell.roles.join(', ')}` : label}
                      className={`matrix-cell ${col.conformed ? 'conformed' : ''}`}
                      data-cell={`${r}-${c}`}
                      tabIndex={r === 0 && c === 0 ? 0 : -1}
                      disabled={!editable}
                      onKeyDown={(e) => onKey(e, r, c)}
                      onClick={() => toggle(row.process.id, col.dimension.id)}
                    >
                      ✓
                    </button>
                    {cell.roles.length > 0 && <span className="roles">{cell.roles.join(', ')}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
