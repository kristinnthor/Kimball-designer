import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { EXAMPLES, loadExample } from './examples';
import { ddlScript } from './ddl';
import { defaultQuery, querySql } from './explore';
import { physicalModel } from './physical';
import { generateSampleData, seedScript } from './sampledata';

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
    } finally {
      await db.close();
    }
  }, 60_000);
});
