import { describe, expect, it } from 'vitest';
import { bubbleToMermaid, bubbleToSvg } from './bubble';
import { busMatrixToCsv, deriveBusMatrix } from './busMatrix';
import { isExampleId } from './examples';
import { normalizeProject } from './normalize';
import { phaseStatus } from './phases';
import { csvCell, mdCell, wrapText } from './text';
import { validateProject } from './validate';
import { tinyProject } from './test-helpers';

// Regression tests for issues raised in review of the core engine (PR #38).
describe('review fixes', () => {
  it('neutralises spreadsheet formulas in CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('One row per line')).toBe('One row per line');
    const p = tinyProject();
    p.processes[0]!.name = '=cmd';
    expect(busMatrixToCsv(p)).toContain("'=cmd");
  });

  it('escapes raw HTML in Markdown cells', () => {
    expect(mdCell('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(mdCell('a\nb')).toBe('a<br>b');
  });

  it('does not hang when wrapping to a tiny width', () => {
    expect(wrapText('abc', 1, 5)).toEqual(['a-', 'bc']); // width is clamped to 2
    expect(wrapText('abc', 0, 2)).toHaveLength(2);
  });

  it('sanitises invalid ids consistently so references still resolve', () => {
    const p = normalizeProject({
      meta: { name: 'X' },
      stakeholders: [{ id: 'sh ann!', name: 'Ann', interviewStatus: 'done' }],
      requirements: [{ id: 'rq 1', statement: 'Q', stakeholderIds: ['sh ann!'], processIds: ['bp sales'] }],
      processes: [{ id: 'bp sales', name: 'Sales', dimensions: ['dm date', { dimensionId: 'dm date' }] }],
      dimensions: [{ id: 'dm date', name: 'Date', kind: 'date' }],
    });
    expect(p.processes[0]!.id).toBe('bp_sales');
    expect(p.requirements[0]!.processIds).toEqual(['bp_sales']);
    expect(p.requirements[0]!.stakeholderIds).toEqual(['sh_ann_']);
    expect(p.processes[0]!.dimensions[0]!.dimensionId).toBe('dm_date');
    expect(validateProject(p).filter((f) => f.code === 'KD003')).toEqual([]);
  });

  it('treats blank and zero scores as not scored', () => {
    const p = normalizeProject({ processes: [{ name: 'A', businessValue: '', feasibility: 0 }] });
    expect(p.processes[0]!.businessValue).toBeNull();
    expect(p.processes[0]!.feasibility).toBeNull();
  });

  it('detects a project id reused by an item', () => {
    const p = tinyProject();
    p.meta.id = 'bp_sales';
    expect(validateProject(p).map((f) => f.code)).toContain('KD002');
  });

  it('rejects inherited property names as example ids', () => {
    expect(isExampleId('toString')).toBe(false);
    expect(isExampleId('constructor')).toBe(false);
    expect(isExampleId('retail')).toBe(true);
  });

  it('deduplicates repeated roles in the matrix and Mermaid', () => {
    const p = tinyProject();
    const inv = p.processes[1]!;
    inv.dimensions.push({ dimensionId: 'dm_date', roles: ['Snapshot date'] });
    expect(deriveBusMatrix(p).rows[1]!.cells[0]!.roles).toEqual(['Snapshot date']);
    expect(bubbleToMermaid(p, inv)).toContain('d0(Date · Snapshot date)\n');
  });

  it('computes review status from the project when counts are not passed', () => {
    const p = tinyProject();
    p.meta.name = '';
    expect(phaseStatus(p, 'review').state).toBe('in-progress');
    expect(phaseStatus(tinyProject(), 'review').state).toBe('complete');
  });

  it('uses the dark palette for dark SVGs', () => {
    const p = tinyProject();
    const dark = bubbleToSvg(p, p.processes[0]!, { theme: 'dark' });
    const light = bubbleToSvg(p, p.processes[0]!, { theme: 'light' });
    expect(dark).toContain('fill="#0B1222"'); // dark paper background
    expect(dark).toContain('fill="#2CC3BD"'); // dark fact colour
    expect(light).toContain('fill="#F7F8FB"');
    expect(light).not.toContain('#2CC3BD');
  });
});
