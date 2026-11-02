import { describe, expect, it } from 'vitest';
import { bubbleToMermaid, bubbleToSvg, layoutBubble } from './bubble';
import { createDimension, createProcess, createProject } from './model';
import { tinyProject } from './test-helpers';
import { wrapText } from './text';

function projectWith(n: number) {
  const p = createProject('Big');
  for (let i = 0; i < n; i++) p.dimensions.push(createDimension({ id: `dm_${i}`, name: `Dimension number ${i}` }));
  const proc = createProcess({
    id: 'bp_x',
    name: 'A process with a fairly long name',
    dimensions: p.dimensions.map((d) => ({ dimensionId: d.id, roles: [] })),
  });
  p.processes.push(proc);
  return { p, proc };
}

describe('layoutBubble', () => {
  it.each([0, 1, 3, 8, 12, 13, 20, 24])('places %i dimensions without overlap inside the canvas', (n) => {
    const { p, proc } = projectWith(n);
    const L = layoutBubble(p, proc);
    expect(L.nodes).toHaveLength(n);
    for (const a of L.nodes) {
      expect(Math.hypot(a.x - L.cx, a.y - L.cy)).toBeGreaterThanOrEqual(L.centerR + a.r);
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(L.width);
      expect(a.y + a.r).toBeLessThanOrEqual(L.height);
      for (const b of L.nodes) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('merges repeated usages of a dimension and flags conformed ones', () => {
    const p = tinyProject();
    const sales = p.processes[0]!;
    sales.dimensions.push({ dimensionId: 'dm_date', roles: ['Ship date'] });
    const L = layoutBubble(p, sales);
    expect(L.nodes).toHaveLength(3);
    expect(L.nodes.find((x) => x.dimensionId === 'dm_date')).toMatchObject({ conformed: true, roles: ['Ship date'] });
    expect(L.nodes.find((x) => x.dimensionId === 'dm_store')!.conformed).toBe(false);
  });

  it('is deterministic', () => {
    const p = tinyProject();
    expect(layoutBubble(p, p.processes[0]!)).toEqual(layoutBubble(p, p.processes[0]!));
  });
});

describe('bubble exporters', () => {
  it('renders an accessible, escaped SVG', () => {
    const p = tinyProject();
    p.processes[0]!.name = 'Sales <web> & "store"';
    const svg = bubbleToSvg(p, p.processes[0]!);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('<title id="kd-title">Bubble diagram: Sales &lt;web&gt; &amp; &quot;store&quot;</title>');
    expect(svg).toContain('GRAIN');
    expect(svg).toContain('data-dimension-id="dm_date"');
    expect(svg).not.toContain('<web>');
  });

  it('supports dark theme, transparent background and hiding facts', () => {
    const p = tinyProject();
    const svg = bubbleToSvg(p, p.processes[0]!, { theme: 'dark', background: false, showFacts: false });
    expect(svg).not.toContain('kd-facts');
    expect(svg).not.toMatch(/<rect width="\d+" height="\d+" fill=/);
  });

  it('renders a Mermaid mindmap with sanitised labels', () => {
    const p = tinyProject();
    p.processes[1]!.name = 'Inventory (daily)';
    expect(bubbleToMermaid(p, p.processes[1]!)).toBe(
      'mindmap\n  root((Inventory daily))\n    d0(Date · Snapshot date)\n    d1(Product)\n',
    );
  });
});

describe('wrapText', () => {
  it('wraps, hard-splits long words and ellipsises overflow', () => {
    expect(wrapText('Customer account', 11, 3)).toEqual(['Customer', 'account']);
    expect(wrapText('Supercalifragilistic', 8, 3)).toEqual(['Superca-', 'lifragi-', 'listic']);
    expect(wrapText('one two three four five six', 7, 2)).toEqual(['one two', 'three…']);
  });
});

describe('legend and interactivity (review fixes)', () => {
  // Rough text width at the legend's 11 px font, matching the layout's estimate.
  const textWidth = (s: string) => s.length * 6;

  it('keeps the legend inside the picture for a process without dimensions', () => {
    const p = createProject('Empty');
    const proc = createProcess({ id: 'bp_empty', name: 'Empty' });
    p.processes.push(proc);
    for (const showFacts of [true, false]) {
      const L = layoutBubble(p, proc, { showFacts });
      expect(L.width - 24, `showFacts ${showFacts}`).toBeGreaterThanOrEqual(24 + 240 + textWidth('Conformed (2+ processes)'));
      if (showFacts) {
        // Not enough room on one line: the additivity key moves below the colour key.
        expect(L.legend.additivityY).toBe(L.legend.keyY + 18);
        expect(L.legend.additivityY! + 4).toBeLessThanOrEqual(L.height);
      } else {
        expect(L.legend.additivityY).toBeNull();
      }
    }
  });

  it('keeps the additivity key on the same line when there is room', () => {
    const { p, proc } = projectWith(4);
    const L = layoutBubble(p, proc);
    expect(L.legend.additivityY).toBe(L.legend.keyY);
  });

  it('makes bubbles keyboard buttons only when interactive', () => {
    const { p, proc } = projectWith(3);
    const exported = bubbleToSvg(p, proc);
    expect(exported).toContain('role="img"');
    expect(exported).not.toContain('tabindex');
    const app = bubbleToSvg(p, proc, { interactive: true });
    expect(app).toContain('role="group"');
    expect(app.match(/tabindex="0" role="button" aria-label="Open dimension Dimension number \d"/g)).toHaveLength(3);
    // Wrapped lines are separated by a space, so the visible text reads "Dimension number 0", as the name does.
    expect(app).toMatch(/>Dimension<\/tspan> <tspan[^>]*>number 0</);
  });
});
