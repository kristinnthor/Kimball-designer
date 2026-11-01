import { describe, expect, it } from 'vitest';
import { createDimension, createMeasure, createProcess, createRequirement, createStakeholder } from './model';
import { countBySeverity, RULES, validateProject, type Finding } from './validate';
import { tinyProject } from './test-helpers';

const codes = (fs: Finding[]) => fs.map((f) => f.code);

describe('validateProject', () => {
  it('finds nothing wrong with a clean project', () => {
    expect(validateProject(tinyProject()).filter((f) => f.severity !== 'info')).toEqual([]);
  });

  it('KD001 requires a name', () => {
    const p = tinyProject();
    p.meta.name = '  ';
    expect(codes(validateProject(p))).toContain('KD001');
  });

  it('KD002 flags duplicate ids', () => {
    const p = tinyProject();
    p.dimensions.push(createDimension({ id: 'bp_sales', name: 'Clash' }));
    expect(codes(validateProject(p))).toContain('KD002');
  });

  it('KD003 flags dangling references', () => {
    const p = tinyProject();
    p.processes[0]!.dimensions.push({ dimensionId: 'dm_missing', roles: [] });
    p.requirements.push(createRequirement({ statement: 'Q', stakeholderIds: ['sh_x'], processIds: ['bp_x'] }));
    const found = validateProject(p).filter((f) => f.code === 'KD003');
    expect(found).toHaveLength(3);
    expect(found.every((f) => f.severity === 'error')).toBe(true);
  });

  it('KD101/KD102/KD103/KD108 flag incomplete processes', () => {
    const p = tinyProject();
    p.processes.push(createProcess({ name: 'Returns', businessValue: 1, feasibility: 1 }));
    expect(codes(validateProject(p))).toEqual(expect.arrayContaining(['KD101', 'KD102', 'KD103']));
    p.processes[2]!.dimensions.push({ dimensionId: 'dm_product', roles: [] });
    expect(codes(validateProject(p))).toContain('KD108');
  });

  it('KD104 flags facts on a factless table and KD103 is skipped for factless', () => {
    const p = tinyProject();
    p.processes[0]!.factTableType = 'factless';
    expect(codes(validateProject(p))).toContain('KD104');
    p.processes[0]!.facts = [];
    expect(codes(validateProject(p))).not.toContain('KD103');
  });

  it('KD105 flags unused dimensions and KD202 single-use ones', () => {
    const p = tinyProject();
    p.dimensions.push(createDimension({ name: 'Vendor' }));
    const c = codes(validateProject(p));
    expect(c).toContain('KD105');
    expect(c).toContain('KD202'); // Store is only used by Sales
  });

  it('KD106 flags requirements without a process', () => {
    const p = tinyProject();
    p.requirements.push(createRequirement({ statement: 'Why?' }));
    expect(codes(validateProject(p))).toContain('KD106');
    p.requirements[0]!.priority = 'wont';
    expect(codes(validateProject(p))).not.toContain('KD106');
  });

  it('KD107 flags duplicate names case-insensitively', () => {
    const p = tinyProject();
    p.dimensions.push(createDimension({ name: 'product' }));
    expect(codes(validateProject(p))).toContain('KD107');
  });

  it('KD201 nudges grain phrasing', () => {
    const p = tinyProject();
    p.processes[0]!.grain = 'sales lines';
    expect(codes(validateProject(p))).toContain('KD201');
    p.processes[0]!.grain = 'A single row for each ticket';
    expect(codes(validateProject(p))).not.toContain('KD201');
  });

  it('KD203 wants several date roles on accumulating snapshots', () => {
    const p = tinyProject();
    p.processes[0]!.factTableType = 'accumulating-snapshot';
    expect(codes(validateProject(p))).toContain('KD203');
    p.processes[0]!.dimensions[0]!.roles = ['Order date', 'Ship date'];
    expect(codes(validateProject(p))).not.toContain('KD203');
  });

  it('KD204 and KD205 are informational', () => {
    const p = tinyProject();
    p.stakeholders.push(createStakeholder({ name: 'Ann' }));
    p.processes[0]!.feasibility = null;
    const f = validateProject(p).filter((x) => x.code === 'KD204' || x.code === 'KD205');
    expect(f.map((x) => x.severity)).toEqual(['info', 'info']);
  });

  it('sorts errors first and every finding uses a documented rule', () => {
    const p = tinyProject();
    p.meta.name = '';
    p.processes.push(createProcess({ name: 'X', facts: [createMeasure()] }));
    const fs = validateProject(p);
    expect(fs[0]!.severity).toBe('error');
    const known = new Set(RULES.map((r) => r.code));
    for (const f of fs) {
      expect(known.has(f.code)).toBe(true);
      expect(RULES.find((r) => r.code === f.code)!.severity).toBe(f.severity);
    }
    expect(countBySeverity(fs).error).toBe(1);
  });
});
