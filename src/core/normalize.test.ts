import { describe, expect, it } from 'vitest';
import { normalizeProject, parseProject, ProjectParseError, serializeProject } from './normalize';
import { tinyProject } from './test-helpers';

describe('normalizeProject', () => {
  it('fills defaults for an empty object', () => {
    const p = normalizeProject({}, '2026-01-01T00:00:00.000Z');
    expect(p.meta.name).toBe('');
    expect(p.meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.stakeholders).toEqual([]);
    expect(p.assumptions).toEqual([]);
  });

  it('coerces sloppy input written by hand or by an agent', () => {
    const p = normalizeProject({
      meta: { name: 'X', successCriteria: 'one goal', currentPhase: 'nope' },
      processes: [
        {
          name: 'Sales',
          factTableType: 'weird',
          businessValue: '7',
          feasibility: 0,
          dimensions: ['dm_date', { dimensionId: 'dm_product', roles: 'Buyer' }, { roles: [] }, 42],
          facts: [{ name: 'Amount', additivity: 'sum' }],
        },
      ],
      dimensions: [{ id: 'dm_date', name: 'Date', kind: 'date', attributes: ['Day', { name: 'Week', scdType: 9 }] }],
      assumptions: ['Assume A', ''],
      openQuestions: ['Who owns returns?'],
      unknownField: true,
    });
    expect(p.meta.successCriteria).toEqual(['one goal']);
    expect(p.meta.currentPhase).toBe('kickoff');
    const proc = p.processes[0]!;
    expect(proc.id).toMatch(/^bp_/);
    expect(proc.factTableType).toBeNull();
    expect(proc.businessValue).toBe(5);
    expect(proc.feasibility).toBeNull(); // 0 means "not scored"
    expect(proc.dimensions).toEqual([
      { dimensionId: 'dm_date', roles: [] },
      { dimensionId: 'dm_product', roles: ['Buyer'] },
    ]);
    expect(proc.facts[0]!.additivity).toBe('additive');
    expect(p.dimensions[0]!.attributes.map((a) => [a.name, a.scdType])).toEqual([
      ['Day', null],
      ['Week', null],
    ]);
    expect(p.assumptions.map((a) => a.text)).toEqual(['Assume A']);
    expect(p.openQuestions[0]).toMatchObject({ text: 'Who owns returns?', status: 'open' });
    expect('unknownField' in p).toBe(false);
  });

  it('rejects non-objects and other major schema versions', () => {
    expect(() => normalizeProject([])).toThrow(ProjectParseError);
    expect(() => normalizeProject({ schemaVersion: '2.0' })).toThrow(/Unsupported schemaVersion/);
    expect(() => normalizeProject({ schemaVersion: '1.3' })).not.toThrow();
  });
});

describe('parseProject / serializeProject', () => {
  it('round-trips a project losslessly', () => {
    const p = tinyProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('reports invalid JSON readably and tolerates a BOM', () => {
    expect(() => parseProject('{ nope')).toThrow(/not valid JSON/);
    expect(parseProject('﻿{"meta":{"name":"BOM"}}').meta.name).toBe('BOM');
  });

  it('serialises with a trailing newline', () => {
    expect(serializeProject(tinyProject()).endsWith('}\n')).toBe(true);
  });
});
