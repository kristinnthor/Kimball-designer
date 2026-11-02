import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { dbtModels, dbtProjectFiles } from './dbt';
import { ddlScript } from './ddl';
import { EXAMPLES, loadExample } from './examples';
import { physicalModel } from './physical';
import { generateSampleData, seedScript } from './sampledata';

// What `dbt seed && dbt run && dbt test` does, without Python: the sample tables stand in for the
// seeds, each model becomes a view, and each generated test runs as the SQL dbt would compile.
describe('dbt project on PostgreSQL', () => {
  it.each(EXAMPLES.map((e) => e.id))('%s: every model builds and every test passes on the sample data', async (id) => {
    const project = loadExample(id, '2026-01-01T00:00:00.000Z');
    project.physical = { dialect: 'postgres', seed: 1, dateFrom: '2025-01-01', dateTo: '2025-03-31', rows: {} };
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    const files = dbtProjectFiles(project, project.physical, model, data);
    const models = dbtModels(model);
    const compile = (sql: string) =>
      sql.replace(/\{\{ ref\('(\w+)'\) \}\}/g, (_, name: string) => (name.startsWith('sample_') ? name.slice('sample_'.length) : `dbt_${name}`));
    const db = new PGlite();
    try {
      await db.exec(ddlScript(project, { dialect: 'postgres', model }));
      await db.exec(seedScript(project, data, 'postgres', model));
      for (const m of models) {
        const sql = files.find((f) => f.name === `models/marts/${m.name}.sql`)!.data;
        await db.exec(`CREATE VIEW dbt_${m.name} AS ${compile(sql)}`);
        const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM dbt_${m.name}`);
        expect(rows[0]!.n, m.name).toBe(data.tables[m.name]!.rows.length);
      }
      let tests = 0;
      for (const m of models) {
        for (const c of m.columns) {
          for (const t of c.tests) {
            const sql =
              t.test === 'unique'
                ? `SELECT ${c.name} FROM dbt_${m.name} WHERE ${c.name} IS NOT NULL GROUP BY ${c.name} HAVING count(*) > 1`
                : t.test === 'not_null'
                  ? `SELECT ${c.name} FROM dbt_${m.name} WHERE ${c.name} IS NULL`
                  : `SELECT child.${c.name} FROM dbt_${m.name} AS child LEFT JOIN dbt_${t.to!.model} AS parent ON parent.${t.to!.field} = child.${c.name} WHERE child.${c.name} IS NOT NULL AND parent.${t.to!.field} IS NULL`;
            const { rows } = await db.query(sql);
            expect(rows.length, `${t.test} on ${m.name}.${c.name}`).toBe(0);
            tests++;
          }
        }
      }
      expect(tests).toBeGreaterThan(models.length * 2);
      for (const a of files.filter((f) => f.name.startsWith('analyses/'))) {
        const { rows } = await db.query(compile(a.data));
        expect(rows.length, a.name).toBeGreaterThan(0);
      }
    } finally {
      await db.close();
    }
  }, 60_000);
});
