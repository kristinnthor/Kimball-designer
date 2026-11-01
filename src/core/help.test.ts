import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExample } from './examples';
import {
  HELP_CLI,
  HELP_DELIVERABLES,
  HELP_DEMOS,
  HELP_FAQ,
  HELP_GLOSSARY,
  HELP_NEXT_STEPS,
  HELP_NOT_INCLUDED,
  HELP_OUTCOMES,
  HELP_OVERVIEW,
  HELP_PHASES,
  HELP_SAVING,
  HELP_SECTIONS,
  HELP_SHORTCUTS,
  HELP_WAYS,
  helpToMarkdown,
} from './help';
import { createDimension, createMeasure, createProcess, createProject, isConformed, PHASE_IDS } from './model';
import { countBySeverity, validateProject } from './validate';

/** Every user-facing string in the help content. */
function allText(): string[] {
  return [
    ...HELP_OVERVIEW.intro,
    ...HELP_OVERVIEW.audience,
    HELP_OVERVIEW.howItFlows,
    ...HELP_OUTCOMES.flatMap((o) => [o.title, o.text]),
    ...HELP_DELIVERABLES.flatMap((d) => [d.title, d.formats, d.summary, ...d.contains, d.usedBy, d.why, d.where]),
    ...HELP_NEXT_STEPS,
    ...HELP_NOT_INCLUDED,
    ...Object.values(HELP_PHASES).flatMap((p) => [p.youDo, p.youRecord, p.doneWhen]),
    ...HELP_DEMOS.flatMap((d) => [d.title, d.summary, ...d.steps.flatMap((s) => [s.title, s.body])]),
    ...HELP_WAYS.flatMap((w) => [w.title, w.bestFor, ...w.steps]),
    ...HELP_CLI.map((c) => c.description),
    ...HELP_SAVING.flatMap((s) => [s.title, s.text]),
    ...HELP_GLOSSARY.flatMap((t) => [t.term, t.definition]),
    ...HELP_SHORTCUTS.flatMap((s) => [s.keys, s.action]),
    ...HELP_FAQ.flatMap((f) => [f.q, f.a]),
  ];
}

describe('help content', () => {
  it('uses balanced inline markup and only https links', () => {
    for (const text of allText()) {
      const outsideCode = text.replace(/`[^`]*`/g, '');
      expect((text.match(/`/g) ?? []).length % 2, text).toBe(0);
      expect((outsideCode.match(/\*\*/g) ?? []).length % 2, text).toBe(0);
      expect((outsideCode.replace(/\*\*/g, '').match(/\*/g) ?? []).length % 2, text).toBe(0);
      expect(outsideCode, 'raw HTML would be swallowed by Markdown').not.toMatch(/<[a-z/]/i);
      for (const [, url] of text.matchAll(/\]\(([^)]+)\)/g)) expect(url).toMatch(/^https:\/\//);
    }
  });

  it('covers every phase and uses unique ids', () => {
    expect(Object.keys(HELP_PHASES).sort()).toEqual([...PHASE_IDS].sort());
    for (const list of [HELP_SECTIONS, HELP_DELIVERABLES, HELP_DEMOS, HELP_WAYS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const demo of HELP_DEMOS) for (const step of demo.steps) if (step.phase) expect(PHASE_IDS).toContain(step.phase);
  });

  it('keeps the claims about the Retail example true', () => {
    const retail = loadExample('retail');
    const counts = countBySeverity(validateProject(retail));
    expect(counts.error + counts.warning).toBe(0); // tour: "No errors or warnings"
    expect(retail.processes).toHaveLength(4); // caption: "four business processes"
    expect(retail.dimensions).toHaveLength(11); // caption: "eleven dimensions"
    expect(retail.stakeholders).toHaveLength(5);
    expect(retail.requirements).toHaveLength(6);
    expect(retail.processes.map((p) => p.factTableType)).toEqual(['transaction', 'periodic-snapshot', 'transaction', 'accumulating-snapshot']);
    for (const name of ['Date', 'Product', 'Store']) {
      expect(isConformed(retail, retail.dimensions.find((d) => d.name === name)!.id), name).toBe(true);
    }
  });

  it('ticks off every step of the first-process demo when its instructions are followed', () => {
    const demo = HELP_DEMOS.find((d) => d.id === 'first-process')!;
    const empty = createProject('Coffee shop analytics');
    expect(demo.steps.filter((s) => s.done).map((s) => s.done!(empty))).not.toContain(true);

    const p = createProject('Coffee shop analytics');
    p.meta.purpose = 'Know which products sell best in each shop, by hour';
    p.meta.scopeIn = 'Till sales in all shops';
    p.stakeholders.push({ id: 'sh_ana', name: 'Ana', role: 'Operations manager', department: '', type: 'business', interviewStatus: 'done', notes: '' });
    p.requirements.push({ id: 'rq_1', statement: 'Which products sell best in each shop and hour?', kpis: ['Units sold'], priority: 'should', stakeholderIds: [], processIds: [], notes: '' });
    const dims = ['Date', 'Product', 'Shop'].map((name) => createDimension({ name }));
    p.dimensions.push(...dims);
    const usage = dims.map((d) => ({ dimensionId: d.id, roles: [] }));
    p.processes.push(
      createProcess({
        name: 'Sales',
        businessValue: 5,
        feasibility: 4,
        grain: 'One row per item on a receipt',
        factTableType: 'transaction',
        dimensions: usage,
        facts: [createMeasure({ name: 'Quantity' }), createMeasure({ name: 'Sales amount', unit: 'currency' })],
      }),
      createProcess({ name: 'Inventory snapshot', dimensions: usage }),
    );
    for (const step of demo.steps) if (step.done) expect(step.done(p), step.title).toBe(true);
  });
});

describe('helpToMarkdown', () => {
  const md = helpToMarkdown();

  it('has a heading for every section and working table-of-contents anchors', () => {
    for (const s of HELP_SECTIONS) expect(md).toContain(`\n## ${s.title}\n`);
    const anchors = [...md.matchAll(/^\d+\. \[[^\]]+\]\(#([^)]+)\)$/gm)].map((m) => m[1]);
    expect(anchors).toHaveLength(HELP_SECTIONS.length);
    expect(anchors).toContain('what-you-get');
  });

  it('includes screenshots only when asked', () => {
    expect(md).toContain('](images/ui-bus-matrix.jpg)');
    expect(helpToMarkdown({ images: false })).not.toContain('](images/');
  });

  it('matches the generated files in the repository', () => {
    const note = 'Generated from src/core/help.ts by `npm run build:docs`. Do not edit by hand.';
    const stale = 'Stale generated guide. Run `npm run build:docs` and commit the result.';
    expect(readFileSync('docs/USER-GUIDE.md', 'utf8'), stale).toBe(helpToMarkdown({ images: true, note }));
    expect(readFileSync('plugin/skills/kimball-designer/references/user-guide.md', 'utf8'), stale).toBe(helpToMarkdown({ images: false, note }));
  });
});
