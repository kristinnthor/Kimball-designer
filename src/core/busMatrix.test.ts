import { describe, expect, it } from 'vitest';
import { busMatrixToCsv, busMatrixToHtml, busMatrixToMarkdown, deriveBusMatrix } from './busMatrix';
import { createDimension } from './model';
import { tinyProject } from './test-helpers';

describe('deriveBusMatrix', () => {
  it('orders columns by usage and marks conformed dimensions', () => {
    const m = deriveBusMatrix(tinyProject());
    expect(m.columns.map((c) => [c.dimension.name, c.usageCount, c.conformed])).toEqual([
      ['Date', 2, true],
      ['Product', 2, true],
      ['Store', 1, false],
    ]);
    expect(m.rows.map((r) => r.cells.map((c) => c.used))).toEqual([
      [true, true, true],
      [true, true, false],
    ]);
    expect(m.rows[1]!.cells[0]!.roles).toEqual(['Snapshot date']);
  });

  it('supports priority row order and hiding unused dimensions', () => {
    const p = tinyProject();
    p.dimensions.push(createDimension({ name: 'Unused' }));
    p.processes[1]!.businessValue = 5;
    p.processes[1]!.feasibility = 5;
    const m = deriveBusMatrix(p, { rowOrder: 'priority', includeUnused: false });
    expect(m.rows[0]!.process.name).toBe('Inventory');
    expect(m.columns.map((c) => c.dimension.name)).not.toContain('Unused');
    expect(deriveBusMatrix(p).columns.map((c) => c.dimension.name)).toContain('Unused');
  });
});

describe('bus matrix exporters', () => {
  it('renders Markdown with conformed columns in bold and roles', () => {
    const md = busMatrixToMarkdown(tinyProject());
    expect(md).toContain('| Business process | **Date** | **Product** | Store |');
    expect(md).toContain('| Inventory | X (Snapshot date) | X |  |');
  });

  it('escapes pipes in Markdown', () => {
    const p = tinyProject();
    p.processes[0]!.name = 'Sales | web';
    expect(busMatrixToMarkdown(p)).toContain('Sales \\| web');
  });

  it('renders CSV with grain and quoting', () => {
    const p = tinyProject();
    p.processes[0]!.grain = 'One row per line, "atomic"';
    const csv = busMatrixToCsv(p).split('\r\n');
    expect(csv[0]).toBe('Business process,Grain,Date,Product,Store');
    expect(csv[1]).toBe('Sales,"One row per line, ""atomic""",X,X,X');
  });

  it('renders standalone, escaped HTML', () => {
    const p = tinyProject();
    p.meta.name = '<Tiny & Co>';
    const html = busMatrixToHtml(p, { theme: 'dark' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('&lt;Tiny &amp; Co&gt;');
    expect(html).not.toContain('<Tiny');
  });
});
