import { APP_VERSION } from './version';
import { displayName, isConformedUsage, priorityScore, type BusinessProcess, type Dimension, type KimballProject } from './model';
import { FONT_SANS, PALETTES, type ThemeName } from './theme';
import { csvCell, escapeXml, mdCell } from './text';

export interface MatrixColumn {
  dimension: Dimension;
  usageCount: number;
  /** Used by two or more business processes. */
  conformed: boolean;
}

export interface MatrixCell {
  used: boolean;
  roles: string[];
}

export interface MatrixRow {
  process: BusinessProcess;
  cells: MatrixCell[];
}

export interface BusMatrix {
  columns: MatrixColumn[];
  rows: MatrixRow[];
}

export interface BusMatrixOptions {
  /** Column order. `usage` (default): most-shared first, then catalogue order. */
  columnOrder?: 'usage' | 'catalogue' | 'name';
  /** Row order. `project` (default) keeps the file order; `priority` sorts by value × feasibility. */
  rowOrder?: 'project' | 'priority' | 'name';
  /** Include dimensions no process uses (default true, so gaps are visible). */
  includeUnused?: boolean;
}

/** Derives the enterprise bus matrix (business processes × dimensions) from the project. */
export function deriveBusMatrix(project: KimballProject, options: BusMatrixOptions = {}): BusMatrix {
  const { columnOrder = 'usage', rowOrder = 'project', includeUnused = true } = options;

  const usage = new Map<string, number>();
  for (const p of project.processes) {
    for (const id of new Set(p.dimensions.map((u) => u.dimensionId))) usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  let columns: MatrixColumn[] = project.dimensions.map((dimension) => {
    const usageCount = usage.get(dimension.id) ?? 0;
    return { dimension, usageCount, conformed: isConformedUsage(dimension.kind, usageCount) };
  });
  if (!includeUnused) columns = columns.filter((c) => c.usageCount > 0);
  const catalogueIndex = new Map(project.dimensions.map((d, i) => [d.id, i]));
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  if (columnOrder === 'usage') {
    columns.sort(
      (a, b) => b.usageCount - a.usageCount || catalogueIndex.get(a.dimension.id)! - catalogueIndex.get(b.dimension.id)!,
    );
  } else if (columnOrder === 'name') {
    columns.sort((a, b) => byName(a.dimension.name, b.dimension.name));
  }

  let processes = [...project.processes];
  if (rowOrder === 'priority') {
    const index = new Map(project.processes.map((p, i) => [p.id, i]));
    processes.sort((a, b) => (priorityScore(b) ?? -1) - (priorityScore(a) ?? -1) || index.get(a.id)! - index.get(b.id)!);
  } else if (rowOrder === 'name') {
    processes = processes.sort((a, b) => byName(a.name, b.name));
  }

  const rows = processes.map((process) => ({
    process,
    cells: columns.map(({ dimension }) => {
      const usages = process.dimensions.filter((u) => u.dimensionId === dimension.id);
      return { used: usages.length > 0, roles: [...new Set(usages.flatMap((u) => u.roles))] };
    }),
  }));

  return { columns, rows };
}

function cellText(cell: MatrixCell): string {
  if (!cell.used) return '';
  return cell.roles.length ? `X (${cell.roles.join(', ')})` : 'X';
}

/** GitHub-flavoured Markdown table. Conformed dimensions are bold. */
export function busMatrixToMarkdown(project: KimballProject, options?: BusMatrixOptions): string {
  const m = deriveBusMatrix(project, options);
  if (m.rows.length === 0) return '_No business processes yet._\n';
  const header = ['Business process', ...m.columns.map((c) => (c.conformed ? `**${mdCell(displayName(c.dimension))}**` : mdCell(displayName(c.dimension))))];
  const align = ['---', ...m.columns.map(() => ':---:')];
  const lines = [`| ${header.join(' | ')} |`, `| ${align.join(' | ')} |`];
  for (const row of m.rows) {
    lines.push(`| ${[mdCell(displayName(row.process)), ...row.cells.map((c) => mdCell(cellText(c)))].join(' | ')} |`);
  }
  lines.push('', '**Bold** = conformed dimension (used by two or more business processes). Roles in parentheses.');
  return lines.join('\n') + '\n';
}

export function busMatrixToCsv(project: KimballProject, options?: BusMatrixOptions): string {
  const m = deriveBusMatrix(project, options);
  const rows = [
    ['Business process', 'Grain', ...m.columns.map((c) => displayName(c.dimension))],
    ...m.rows.map((r) => [displayName(r.process), r.process.grain, ...r.cells.map(cellText)]),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Standalone, branded HTML page containing the bus matrix. */
export function busMatrixToHtml(project: KimballProject, options: BusMatrixOptions & { theme?: ThemeName } = {}): string {
  const c = PALETTES[options.theme ?? 'light'];
  const m = deriveBusMatrix(project, options);
  const title = `${displayName(project.meta, 'Untitled project')} — enterprise bus matrix`;
  const head = m.columns
    .map(
      (col) =>
        `<th scope="col" class="${col.conformed ? 'conformed' : ''}" title="Used by ${col.usageCount} process(es)">${escapeXml(displayName(col.dimension))}</th>`,
    )
    .join('');
  const body = m.rows
    .map(
      (row) =>
        `<tr><th scope="row">${escapeXml(displayName(row.process))}${row.process.grain ? `<span class="grain">${escapeXml(row.process.grain)}</span>` : ''}</th>` +
        row.cells
          .map((cell, i) =>
            cell.used
              ? `<td class="used${m.columns[i]!.conformed ? ' conformed' : ''}"><span class="mark" aria-label="used">●</span>${cell.roles.length ? `<span class="roles">${escapeXml(cell.roles.join(', '))}</span>` : ''}</td>`
              : '<td><span class="sr">not used</span></td>',
          )
          .join('') +
        '</tr>',
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<style>
  body { margin: 0; padding: 32px; background: ${c.paper}; color: ${c.ink}; font: 14px/1.45 ${FONT_SANS}; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  p.meta { margin: 0 0 20px; color: ${c.muted}; }
  .wrap { overflow-x: auto; background: ${c.surface}; border: 1px solid ${c.line}; border-radius: 12px; }
  table { border-collapse: collapse; min-width: 100%; }
  th, td { border-bottom: 1px solid ${c.line}; padding: 10px 12px; text-align: center; vertical-align: middle; }
  thead th { background: ${c.surface2}; font-size: 12px; font-weight: 600; color: ${c.ink2}; position: sticky; top: 0; }
  thead th.conformed { color: ${c.conformedStrong}; box-shadow: inset 0 -3px 0 ${c.conformed}; }
  tbody th { text-align: left; font-weight: 600; min-width: 180px; }
  td { min-width: 96px; }
  .grain { display: block; font-weight: 400; font-size: 12px; color: ${c.muted}; }
  td.used .mark { color: ${c.dim}; font-size: 16px; }
  td.used.conformed .mark { color: ${c.conformed}; }
  .roles { display: block; font-size: 11px; color: ${c.muted}; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  footer { margin-top: 16px; font-size: 12px; color: ${c.muted}; }
  .key { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px 0 12px; vertical-align: -1px; }
</style>
</head>
<body>
<h1>${escapeXml(title)}</h1>
<p class="meta">${m.rows.length} business process(es) × ${m.columns.length} dimension(s) · ${m.columns.filter((x) => x.conformed).length} conformed</p>
<div class="wrap">
<table>
<thead><tr><th scope="col" style="text-align:left">Business process</th>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>
<footer>
  <span class="key" style="background:${c.conformed}"></span>Conformed dimension (2+ processes)
  <span class="key" style="background:${c.dim}"></span>Dimension used by one process
  · Generated by Kimball Designer ${escapeXml(APP_VERSION)}
</footer>
</body>
</html>
`;
}
