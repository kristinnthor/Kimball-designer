import { describe, expect, it } from 'vitest';
import { bubbleToSvg } from './bubble';
import { normalizeProject } from './normalize';
import { requirementsToMarkdown } from './reqdoc';
import { escapeXml, mdCode, mdInline, slugify, truncate, wrapText } from './text';
import { validateProject } from './validate';
import { loadExample } from './examples';
import { tinyProject } from './test-helpers';

// Regression tests for the full product review (November 2026).
describe('review fixes 2', () => {
  it('escapes user text outside tables in the requirements document', () => {
    const p = tinyProject();
    p.meta.name = 'Proj\n# Injected';
    p.processes[0]!.name = '<img src=x onerror=alert(1)>';
    p.processes[0]!.owner = '<script>x</script>';
    p.assumptions.push({ id: 'as_1', text: 'a\n- fake item' });
    p.openQuestions.push({ id: 'oq_1', text: '**bold** _it_', owner: 'Anna', status: 'open' });
    const md = requirementsToMarkdown(p, '2026-11-01T00:00:00Z');
    expect(md).not.toContain('<img');
    expect(md).not.toContain('<script>');
    expect(md).not.toMatch(/^# Injected/m);
    expect(md).not.toMatch(/^- fake item/m);
    expect(md).toContain('\\*\\*bold\\*\\*');
  });

  it('keeps grain code spans intact', () => {
    // A longer fence, padded because the text ends with a backtick: renders as "One row per `line`".
    expect(mdCode('One row per `line`')).toBe('`` One row per `line` ``');
    expect(mdCode('a\n\n## b')).toBe('`a ## b`');
    expect(mdInline('1. not a list')).toBe('1\\. not a list');
  });

  it('marks degenerate dimensions as not conformed in the requirements document', () => {
    const md = requirementsToMarkdown(loadExample('saas'), '2026-11-01T00:00:00Z');
    const row = md.split('\n').find((l) => l.startsWith('| Subscription id |'))!;
    expect(row).toContain('| No |');
  });

  it('drops XML-invalid control characters', () => {
    expect(escapeXml('a\u000bb\u0007c\td')).toBe('abc\td');
    const p = tinyProject();
    p.processes[0]!.name = 'Sales\u000b';
    expect(bubbleToSvg(p, p.processes[0]!)).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(normalizeProject({ meta: { name: 'X\u0007Y' } }).meta.name).toBe('XY');
  });

  it('never splits an emoji when wrapping or truncating', () => {
    const lines = wrapText('😀'.repeat(10), 12, 3);
    for (const l of lines) expect(l).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/);
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });

  it('never ends a slug with a dash', () => {
    expect(slugify(`${'a'.repeat(59)} bcd`)).not.toMatch(/-$/);
  });

  it('counts a date dimension listed twice without roles once (KD203)', () => {
    const p = tinyProject();
    const proc = p.processes[0]!;
    proc.factTableType = 'accumulating-snapshot';
    const date = proc.dimensions.find((u) => u.dimensionId === 'dm_date')!;
    proc.dimensions.push({ dimensionId: date.dimensionId, roles: [] });
    expect(validateProject(p).some((f) => f.code === 'KD203' && f.target.id === proc.id)).toBe(true);
  });
});
