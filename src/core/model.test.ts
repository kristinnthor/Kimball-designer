import { describe, expect, it } from 'vitest';
import {
  createDimension,
  createProcess,
  createProject,
  isConformed,
  isDateDimension,
  newId,
  priorityScore,
  processesUsing,
  SCHEMA_VERSION,
} from './model';
import { tinyProject } from './test-helpers';

describe('model', () => {
  it('creates an empty project at the kickoff phase', () => {
    const p = createProject('Sales', '2026-01-01T00:00:00.000Z');
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.meta).toMatchObject({ name: 'Sales', currentPhase: 'kickoff', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(p.processes).toEqual([]);
  });

  it('generates unique prefixed ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId('bp')));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^bp_[a-z0-9]{8}$/);
  });

  it('detects conformed dimensions', () => {
    const p = tinyProject();
    expect(isConformed(p, 'dm_date')).toBe(true);
    expect(isConformed(p, 'dm_store')).toBe(false);
    expect(processesUsing(p, 'dm_product').map((x) => x.id)).toEqual(['bp_sales', 'bp_inventory']);
  });

  it('recognises date dimensions by kind or name', () => {
    expect(isDateDimension(createDimension({ name: 'Calendar', kind: 'standard' }))).toBe(true);
    expect(isDateDimension(createDimension({ name: 'Anything', kind: 'date' }))).toBe(true);
    expect(isDateDimension(createDimension({ name: 'Customer' }))).toBe(false);
    expect(isDateDimension(createDimension({ name: 'Update' }))).toBe(false);
  });

  it('computes priority score only when both scores exist', () => {
    expect(priorityScore(createProcess({ businessValue: 4, feasibility: 5 }))).toBe(20);
    expect(priorityScore(createProcess({ businessValue: 4 }))).toBeNull();
  });
});
