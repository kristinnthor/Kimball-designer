import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { EXAMPLES, loadExample } from './examples';
import { ddlScript } from './ddl';
import { defaultQuery, querySql, runQuery } from './explore';
import { physicalModel } from './physical';
import { generateSampleData, seedScript } from './sampledata';
import { requirementAnswers } from './traceability';

/** Result rows keyed by their group values, so row order and number formats don't matter. */
function byGroup(rows: unknown[][]): Map<string, number | null> {
  const cell = (v: unknown) => (v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  return new Map(rows.map((r) => [JSON.stringify(r.slice(0, -1).map(cell)), r[r.length - 1] == null ? null : Number(r[r.length - 1])]));
}

// Runs the generated PostgreSQL scripts in a real (WebAssembly) PostgreSQL, the way the
// Docker sandbox loads them: every key, index and INSERT must be accepted.
describe('PostgreSQL scripts', () => {
  it.each(EXAMPLES.map((e) => e.id))('%s: schema, sample data and example queries run', async (id) => {
    const project = loadExample(id, '2026-01-01T00:00:00.000Z');
    project.physical = { dialect: 'postgres', seed: 1, dateFrom: '2025-01-01', dateTo: '2025-03-31', rows: {} };
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    const db = new PGlite();
    try {
      await db.exec(ddlScript(project, { dialect: 'postgres', model, dropFirst: true }));
      await db.exec(seedScript(project, data, 'postgres', model));
      for (const t of model.tables) {
        const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t.name}`);
        expect(rows[0]!.n, t.name).toBe(data.tables[t.name]!.rows.length);
      }
      for (const fact of model.tables.filter((t) => t.kind === 'fact')) {
        const { rows } = await db.query(querySql(model, defaultQuery(model, fact), 'postgres'));
        expect(rows.length, fact.name).toBeGreaterThan(0);
      }
      // The SQL of each saved requirement query gives the same answer as the explorer.
      const answered = requirementAnswers(project, model).filter((a) => a.query);
      expect(answered.length).toBeGreaterThan(0);
      for (const a of answered) {
        const query = { ...a.query!, limit: 100_000 };
        const expected = byGroup(runQuery(model, data, query, 'postgres').rows);
        const { rows } = await db.query<unknown[]>(querySql(model, query, 'postgres'), [], { rowMode: 'array' });
        const actual = byGroup(rows);
        expect([...actual.keys()].sort(), a.label).toEqual([...expected.keys()].sort());
        for (const [key, value] of expected) {
          expect(Math.abs((actual.get(key) ?? NaN) - (value ?? NaN)), `${a.label} ${key}`).toBeLessThanOrEqual(0.011);
        }
      }
    } finally {
      await db.close();
    }
  }, 60_000);
});
