import {
  ADDITIVITY,
  FACT_TABLE_TYPES,
  displayName,
  isConformedUsage,
  optionLabel,
  type BusinessProcess,
  type DimensionKind,
  type Id,
  type KimballProject,
} from './model';
import { FONT_MONO, FONT_SANS, PALETTES, type ThemeName } from './theme';
import { escapeXml, truncate, wrapText } from './text';

export interface BubbleNode {
  dimensionId: Id;
  label: string;
  lines: string[];
  roles: string[];
  kind: DimensionKind;
  conformed: boolean;
  x: number;
  y: number;
  r: number;
}

export interface BubbleLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  centerR: number;
  centerLines: string[];
  nodes: BubbleNode[];
  /** Facts panel geometry; null when hidden. */
  panel: { x: number; y: number; width: number; height: number } | null;
  grainLines: string[];
  footerY: number;
  /** Baselines of the legend: the colour key, and the additivity key (null without a facts panel). */
  legend: { keyY: number; additivityY: number | null };
}

export interface BubbleOptions {
  /** Show the facts panel to the right of the diagram (default true). */
  showFacts?: boolean;
}

/** Approximate widths of the two legend texts at 11 px, so they never overlap or get clipped. */
const LEGEND_KEY_W = 390;
const LEGEND_ADDITIVITY_W = 280;

const PAD = 24;
const TOP = 88;
const CENTER_R = 74;
const GAP = 16;
const PANEL_W = 260;
const ROLE_LABEL_SPACE = 22;

/** Deterministic radial layout: the process in the centre, one bubble per dimension around it. */
export function layoutBubble(project: KimballProject, process: BusinessProcess, options: BubbleOptions = {}): BubbleLayout {
  const showFacts = options.showFacts ?? true;

  // One bubble per dimension; repeated usages merge their roles.
  const merged = new Map<Id, string[]>();
  for (const u of process.dimensions) merged.set(u.dimensionId, [...(merged.get(u.dimensionId) ?? []), ...u.roles]);
  const usageCount = (id: Id) => project.processes.filter((p) => p.dimensions.some((u) => u.dimensionId === id)).length;

  const n = merged.size;
  const r = n > 16 ? 38 : 46;
  const twoRings = n > 12;
  const innerCount = twoRings ? Math.ceil(n / 2) : n;
  const outerCount = twoRings ? Math.floor(n / 2) : 0;
  const chord = 2 * r + GAP;
  const d1 = Math.max(CENTER_R + r + 46, (innerCount * chord) / (2 * Math.PI));
  const d2 = twoRings ? Math.max(d1 + 2 * r + 10, (outerCount * chord) / (2 * Math.PI)) : d1;
  const extent = n === 0 ? CENTER_R + 40 : (twoRings ? d2 : d1) + r + ROLE_LABEL_SPACE;
  const size = Math.ceil(2 * extent);
  // Without the facts panel the picture can be narrower than the legend: centre it in the legend's width.
  const diagramWidth = showFacts ? size : Math.max(size, LEGEND_KEY_W);
  const cx = PAD + diagramWidth / 2;
  const cy = TOP + size / 2;

  const nodes: BubbleNode[] = [...merged.entries()].map(([dimensionId, roles], i) => {
    const dim = project.dimensions.find((d) => d.id === dimensionId);
    const label = dim ? displayName(dim) : `Missing (${dimensionId})`;
    // Two rings: even items on the inner ring, odd items on the outer ring offset by half a step.
    const outer = twoRings && i % 2 === 1;
    const k = twoRings ? Math.floor(i / 2) : i;
    const count = outer ? outerCount : innerCount;
    const angle = -Math.PI / 2 + ((k + (outer ? 0.5 : 0)) * 2 * Math.PI) / count;
    const dist = outer ? d2 : d1;
    return {
      dimensionId,
      label,
      lines: wrapText(label, 12, 3),
      roles: [...new Set(roles)],
      kind: dim?.kind ?? 'standard',
      conformed: isConformedUsage(dim?.kind, usageCount(dimensionId)),
      x: round(cx + dist * Math.cos(angle)),
      y: round(cy + dist * Math.sin(angle)),
      r,
    };
  });

  const factRows = Math.max(1, process.facts.length);
  const panel = showFacts
    ? { x: PAD + size + 24, y: TOP, width: PANEL_W, height: 56 + factRows * 24 }
    : null;
  const width = panel ? panel.x + panel.width + PAD : diagramWidth + 2 * PAD;
  const grainLines = wrapText(process.grain.trim() || 'Grain not declared yet', Math.floor((width - 2 * PAD - 60) / 7.4), 3);
  const bodyBottom = Math.max(TOP + size, panel ? panel.y + panel.height : 0);
  const footerY = bodyBottom + 20;
  // The additivity key shares the colour key's line when there is room, else it gets its own line.
  const oneLine = width - 2 * PAD >= LEGEND_KEY_W + 24 + LEGEND_ADDITIVITY_W;
  const extraLine = panel && !oneLine ? 18 : 0;
  const height = footerY + 30 + grainLines.length * 18 + 40 + extraLine;
  const keyY = height - 18 - extraLine;
  const legend = { keyY, additivityY: panel ? (oneLine ? keyY : keyY + 18) : null };

  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    cx: round(cx),
    cy: round(cy),
    centerR: CENTER_R,
    centerLines: wrapText(displayName(process), 13, 3),
    nodes,
    panel,
    grainLines,
    footerY,
    legend,
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

const ADDITIVITY_SHORT = { additive: 'A', 'semi-additive': 'SA', 'non-additive': 'NA' } as const;

/** Standalone SVG for one business process, themed with the brand palette. */
export function bubbleToSvg(
  project: KimballProject,
  process: BusinessProcess,
  options: BubbleOptions & {
    theme?: ThemeName;
    background?: boolean;
    /** In the app: each dimension bubble is a focusable button (the picture becomes a group). Exports stay images. */
    interactive?: boolean;
  } = {},
): string {
  const theme = options.theme ?? 'light';
  const c = PALETTES[theme];
  const L = layoutBubble(project, process, options);
  const name = displayName(process);
  const typeLabel = optionLabel(FACT_TABLE_TYPES, process.factTableType);
  const centerFill = theme === 'light' ? c.factStrong : c.fact;
  const centerText = theme === 'light' ? '#FFFFFF' : c.paper;
  const out: string[] = [];
  const t = (s: string) => escapeXml(s);

  const dimList = L.nodes
    .map((nd) => `${nd.label}${nd.roles.length ? ` (${nd.roles.join(', ')})` : ''}${nd.conformed ? ' [conformed]' : ''}`)
    .join('; ');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.width} ${L.height}" width="${L.width}" height="${L.height}" role="${options.interactive ? 'group' : 'img'}" aria-labelledby="kd-title kd-desc" font-family="${t(FONT_SANS)}">`,
    `<title id="kd-title">Bubble diagram: ${t(name)}</title>`,
    `<desc id="kd-desc">Business process ${t(name)}${typeLabel ? ` (${t(typeLabel.toLowerCase())} fact table)` : ''}. Grain: ${t(process.grain || 'not declared')}. Dimensions: ${t(dimList || 'none')}.</desc>`,
  );
  if (options.background !== false) out.push(`<rect width="${L.width}" height="${L.height}" fill="${c.paper}"/>`);

  // Header
  const subtitle = [
    typeLabel ? `${typeLabel} fact table` : 'Fact table type not set',
    `${L.nodes.length} dimension${L.nodes.length === 1 ? '' : 's'}`,
    `${process.facts.length} fact${process.facts.length === 1 ? '' : 's'}`,
  ].join(' · ');
  out.push(
    `<text x="${PAD}" y="42" font-size="22" font-weight="700" fill="${c.ink}" letter-spacing="-0.2">${t(truncate(name, 60))}</text>`,
    `<text x="${PAD}" y="66" font-size="13" fill="${c.muted}">${t(subtitle)}</text>`,
  );

  // Spokes
  out.push(`<g stroke="${c.line}" stroke-width="2" stroke-linecap="round">`);
  for (const nd of L.nodes) {
    const dx = nd.x - L.cx;
    const dy = nd.y - L.cy;
    const len = Math.hypot(dx, dy) || 1;
    const x1 = round(L.cx + (dx / len) * L.centerR);
    const y1 = round(L.cy + (dy / len) * L.centerR);
    const x2 = round(nd.x - (dx / len) * nd.r);
    const y2 = round(nd.y - (dy / len) * nd.r);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  out.push('</g>');

  // Dimension bubbles
  for (const nd of L.nodes) {
    const stroke = nd.conformed ? c.conformed : c.dim;
    const lineH = 15;
    const startY = nd.y - ((nd.lines.length - 1) * lineH) / 2 + 4.5;
    out.push(
      options.interactive
        ? // The name contains the visible text (label, then roles) so speech input and screen readers agree.
          `<g class="kd-dim" data-dimension-id="${t(nd.dimensionId)}" tabindex="0" role="button" aria-label="Open dimension ${t(nd.label)}${nd.roles.length ? ` ${t(nd.roles.join(' · '))}` : ''}">`
        : `<g class="kd-dim" data-dimension-id="${t(nd.dimensionId)}">`,
      `<title>${t(nd.label)}${nd.conformed ? ' — conformed' : ''}${nd.roles.length ? ` — roles: ${t(nd.roles.join(', '))}` : ''}</title>`,
      `<circle cx="${nd.x}" cy="${nd.y}" r="${nd.r}" fill="${nd.conformed ? c.conformedSoft : c.dimSoft}" stroke="${stroke}" stroke-width="${nd.conformed ? 3 : 2}"${nd.kind === 'degenerate' ? ' stroke-dasharray="5 4"' : ''}/>`,
      `<text text-anchor="middle" font-size="12.5" font-weight="600" fill="${c.ink}">` +
        nd.lines.map((ln, i) => `<tspan x="${nd.x}" y="${round(startY + i * lineH)}">${t(ln)}</tspan>`).join(' ') +
        '</text>',
    );
    if (nd.roles.length) {
      out.push(
        `<text x="${nd.x}" y="${round(nd.y + nd.r + 15)}" text-anchor="middle" font-size="11" font-style="italic" fill="${c.muted}">${t(truncate(nd.roles.join(' · '), 30))}</text>`,
      );
    }
    out.push('</g>');
  }

  // Centre (business process)
  const cLineH = 18;
  const cStart = L.cy - ((L.centerLines.length - 1) * cLineH) / 2 + 5.5;
  out.push(
    `<g class="kd-process">`,
    `<circle cx="${L.cx}" cy="${L.cy}" r="${L.centerR}" fill="${centerFill}"/>`,
    `<circle cx="${L.cx}" cy="${L.cy}" r="${L.centerR - 6}" fill="none" stroke="${centerText}" stroke-opacity="0.35" stroke-width="1.5"/>`,
    `<text text-anchor="middle" font-size="15.5" font-weight="700" fill="${centerText}">` +
      L.centerLines.map((ln, i) => `<tspan x="${L.cx}" y="${round(cStart + i * cLineH)}">${t(ln)}</tspan>`).join('') +
      '</text>',
    '</g>',
  );

  // Facts panel
  if (L.panel) {
    const P = L.panel;
    out.push(
      `<g class="kd-facts">`,
      `<rect x="${P.x}" y="${P.y}" width="${P.width}" height="${P.height}" rx="12" fill="${c.surface}" stroke="${c.line}"/>`,
      `<rect x="${P.x}" y="${P.y}" width="5" height="${P.height}" rx="2.5" fill="${c.fact}"/>`,
      `<text x="${P.x + 20}" y="${P.y + 30}" font-size="13" font-weight="700" fill="${c.ink}">Facts</text>`,
    );
    if (process.facts.length === 0) {
      out.push(
        `<text x="${P.x + 20}" y="${P.y + 56}" font-size="12.5" fill="${c.muted}">${process.factTableType === 'factless' ? 'Factless — counts events or coverage' : 'No facts yet'}</text>`,
      );
    }
    process.facts.forEach((f, i) => {
      const y = P.y + 56 + i * 24;
      const code = ADDITIVITY_SHORT[f.additivity];
      out.push(
        `<text x="${P.x + 20}" y="${y}" font-size="12.5" fill="${c.ink}">${t(truncate(displayName(f), 28))}${f.unit ? `<tspan fill="${c.muted}"> (${t(truncate(f.unit, 10))})</tspan>` : ''}<title>${t(optionLabel(ADDITIVITY, f.additivity))}</title></text>`,
        `<text x="${P.x + P.width - 16}" y="${y}" text-anchor="end" font-size="10.5" font-weight="700" fill="${f.additivity === 'additive' ? c.factStrong : f.additivity === 'semi-additive' ? c.conformedStrong : c.muted}">${code}</text>`,
      );
    });
    out.push('</g>');
  }

  // Grain caption
  out.push(
    `<line x1="${PAD}" y1="${L.footerY}" x2="${L.width - PAD}" y2="${L.footerY}" stroke="${c.line}"/>`,
    `<text x="${PAD}" y="${L.footerY + 28}" font-size="11" font-weight="700" fill="${c.factStrong}" letter-spacing="0.08em">GRAIN</text>`,
    `<text font-family="${t(FONT_MONO)}" font-size="12.5" fill="${process.grain.trim() ? c.ink : c.muted}">` +
      L.grainLines.map((ln, i) => `<tspan x="${PAD + 60}" y="${L.footerY + 28 + i * 18}">${t(ln)}</tspan>`).join('') +
      '</text>',
  );

  // Legend
  const ly = L.legend.keyY;
  out.push(
    `<g font-size="11" fill="${c.muted}">`,
    `<circle cx="${PAD + 6}" cy="${ly - 4}" r="6" fill="${centerFill}"/><text x="${PAD + 18}" y="${ly}">Business process</text>`,
    `<circle cx="${PAD + 132}" cy="${ly - 4}" r="6" fill="${c.dimSoft}" stroke="${c.dim}" stroke-width="2"/><text x="${PAD + 144}" y="${ly}">Dimension</text>`,
    `<circle cx="${PAD + 228}" cy="${ly - 4}" r="6" fill="${c.conformedSoft}" stroke="${c.conformed}" stroke-width="2.5"/><text x="${PAD + 240}" y="${ly}">Conformed (2+ processes)</text>`,
    L.legend.additivityY !== null
      ? L.legend.additivityY === ly
        ? `<text x="${L.width - PAD}" y="${ly}" text-anchor="end">A additive · SA semi-additive · NA non-additive</text>`
        : `<text x="${PAD}" y="${L.legend.additivityY}">A additive · SA semi-additive · NA non-additive</text>`
      : '',
    '</g>',
    '</svg>',
  );
  return out.filter(Boolean).join('\n') + '\n';
}

const mermaidText = (s: string) => s.replace(/[()[\]{}<>"`]/g, ' ').replace(/\s+/g, ' ').trim() || 'untitled';

/** Mermaid `mindmap` approximation of the bubble diagram, for Markdown documents. */
export function bubbleToMermaid(project: KimballProject, process: BusinessProcess): string {
  const lines = ['mindmap', `  root((${mermaidText(displayName(process))}))`];
  const merged = new Map<Id, string[]>();
  for (const u of process.dimensions) merged.set(u.dimensionId, [...(merged.get(u.dimensionId) ?? []), ...u.roles]);
  let i = 0;
  for (const [id, allRoles] of merged) {
    const roles = [...new Set(allRoles)];
    const dim = project.dimensions.find((d) => d.id === id);
    const label = mermaidText(dim ? displayName(dim) : id) + (roles.length ? ` · ${mermaidText(roles.join(', '))}` : '');
    lines.push(`    d${i++}(${label})`);
  }
  return lines.join('\n') + '\n';
}
