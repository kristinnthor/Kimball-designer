import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import {
  EXAMPLES,
  describeRequirementQuery,
  exampleQueries,
  fromRequirementQuery,
  groupOptions,
  loadExample,
  normalizeProject,
  physicalModel,
  requirementAnswers,
  requirementsToMarkdown,
  serializeProject,
  toRequirementQuery,
  validateProject,
  type ExploreQuery,
  type KimballProject,
  type RequirementQuery,
} from './index';

const retail = () => loadExample('retail', '2026-01-01T00:00:00.000Z');
const schema = JSON.parse(readFileSync(new URL('./schema/kimball-project.schema.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);

const categoryByWeek: RequirementQuery = {
  processId: 'bp_retail_sales',
  measureId: 'ms_net_sales',
  aggregate: 'sum',
  groupBy: [
    { dimensionId: 'dm_product', attributeId: 'at_prod_category' },
    { dimensionId: 'dm_date', attributeId: 'at_date_week' },
  ],
};

describe('requirement queries', () => {
  it.each(EXAMPLES.map((e) => e.id))('%s: every column the explorer offers survives the round trip', (id) => {
    const project = loadExample(id);
    const model = physicalModel(project);
    for (const fact of model.tables.filter((t) => t.kind === 'fact')) {
      const measure = fact.columns.find((c) => c.role === 'measure');
      for (const option of groupOptions(model, fact)) {
        const query: ExploreQuery = {
          fact: fact.name,
          measure: measure?.name ?? null,
          aggregate: measure ? 'max' : 'count',
          groupBy: [option.by],
          filter: { by: option.by, value: 'x' },
          limit: 20,
        };
        const saved = toRequirementQuery(model, query);
        expect(saved, `${fact.name} ${option.key}`).not.toBeNull();
        expect(fromRequirementQuery(model, saved!), `${fact.name} ${option.key}`).toEqual(query);
      }
    }
  });

  it.each(EXAMPLES.map((e) => e.id))('%s: the saved example queries match the design', (id) => {
    const answers = requirementAnswers(loadExample(id));
    expect(answers.filter((a) => a.requirement.query).length).toBeGreaterThan(0);
    for (const a of answers.filter((x) => x.requirement.query)) expect(a.status, a.label).toBe('answered');
  });

  it('stores attributes by id, generated columns by name and degenerate dimensions by dimension', () => {
    const model = physicalModel(retail());
    const q = (column: string, attribute?: string): ExploreQuery => ({
      fact: 'fact_retail_sales',
      measure: null,
      aggregate: 'count',
      groupBy: [attribute ? { column, attribute } : { column }],
    });
    expect(toRequirementQuery(model, q('date_key', 'fiscal_week'))!.groupBy).toEqual([{ dimensionId: 'dm_date', attributeId: 'at_date_week' }]);
    expect(toRequirementQuery(model, q('date_key', 'full_date'))!.groupBy).toEqual([{ dimensionId: 'dm_date', column: 'full_date' }]);
    expect(toRequirementQuery(model, q('pos_transaction_number'))!.groupBy).toEqual([{ dimensionId: 'dm_pos_txn' }]);
    expect(toRequirementQuery(model, q('cashier_employee_key', 'job_role'))!.groupBy).toEqual([
      { dimensionId: 'dm_employee', role: 'Cashier', attributeId: 'at_emp_role' },
    ]);
    expect(toRequirementQuery(model, { ...q('date_key', 'fiscal_week'), measure: 'net_sales_amount', aggregate: 'count' })).not.toHaveProperty('measureId');
  });

  it('survives renaming the process, measure, dimension, attribute and role', () => {
    const p = retail();
    p.requirements[0]!.query = categoryByWeek;
    const before = requirementAnswers(p)[0]!.query!;
    const sales = p.processes.find((x) => x.id === 'bp_retail_sales')!;
    sales.name = 'POS sales';
    sales.facts.find((f) => f.id === 'ms_net_sales')!.name = 'Net revenue';
    const product = p.dimensions.find((d) => d.id === 'dm_product')!;
    product.name = 'Item';
    product.attributes.find((a) => a.id === 'at_prod_category')!.name = 'Merchandise category';
    const after = requirementAnswers(p)[0]!;
    expect(after.status).toBe('answered');
    expect(after.query).toEqual({
      ...before,
      fact: 'fact_pos_sales',
      measure: 'net_revenue',
      groupBy: [{ column: 'item_key', attribute: 'merchandise_category' }, before.groupBy[1]],
    });
    expect(after.description).toBe('POS sales: sum of Net revenue by Item › Merchandise category and Date › Fiscal week');
  });

  it.each([
    ['the process is removed', (p: KimballProject) => void (p.processes = p.processes.filter((x) => x.id !== 'bp_retail_sales'))],
    ['the measure is removed', (p: KimballProject) => void (p.processes[0]!.facts = p.processes[0]!.facts.filter((f) => f.id !== 'ms_net_sales'))],
    ['the dimension leaves the process', (p: KimballProject) => void (p.processes[0]!.dimensions = p.processes[0]!.dimensions.filter((u) => u.dimensionId !== 'dm_product'))],
    ['the attribute is removed', (p: KimballProject) => {
      const product = p.dimensions.find((d) => d.id === 'dm_product')!;
      product.attributes = product.attributes.filter((a) => a.id !== 'at_prod_category');
    }],
    ['the dimension gets a role', (p: KimballProject) => void (p.processes[0]!.dimensions.find((u) => u.dimensionId === 'dm_date')!.roles = ['Sales date'])],
  ])('is outdated when %s, and validation says so', (_, change) => {
    const p = retail();
    p.requirements[0]!.query = categoryByWeek;
    change(p);
    const a = requirementAnswers(p)[0]!;
    expect(a.status).toBe('outdated');
    expect(a.query).toBeNull();
    // The example's R2 uses some of the same columns, so it can be outdated too.
    expect(validateProject(p).filter((f) => f.code === 'KD109').map((f) => f.target.id)).toContain('rq_category_growth');
  });

  it('describes counts, filters, degenerate dimensions and generated columns', () => {
    const p = retail();
    expect(describeRequirementQuery(p, categoryByWeek)).toBe('Retail sales: sum of Net sales amount by Product › Category and Date › Fiscal week');
    expect(
      describeRequirementQuery(p, {
        processId: 'bp_retail_sales',
        aggregate: 'count',
        groupBy: [{ dimensionId: 'dm_pos_txn' }, { dimensionId: 'dm_date', column: 'full_date' }],
        filter: { column: { dimensionId: 'dm_employee', role: 'Cashier', attributeId: 'at_emp_role' }, value: 'Supervisor' },
      }),
    ).toBe('Retail sales: number of rows by POS transaction number and Date › full date, where Cashier › Job role is “Supervisor”');
    expect(describeRequirementQuery(p, { processId: 'bp_gone', aggregate: 'count', groupBy: [] })).toBe('Missing process: number of rows');
  });
});

describe('validation', () => {
  it('reports unanswered must-haves only once a requirement has a query', () => {
    const p = retail();
    for (const r of p.requirements) delete r.query;
    expect(validateProject(p).some((f) => f.code === 'KD206')).toBe(false);
    p.requirements[0]!.query = categoryByWeek;
    const kd206 = validateProject(p).filter((f) => f.code === 'KD206');
    expect(kd206.map((f) => f.target.id)).toEqual(['rq_promo_lift', 'rq_out_of_stock']);
    expect(kd206.every((f) => f.severity === 'info' && f.phase === 'prototype')).toBe(true);
  });
});

describe('requirements document', () => {
  it('adds an "Answered by" column once a requirement has a query', () => {
    const p = retail();
    const doc = requirementsToMarkdown(p, '2026-01-01T00:00:00.000Z');
    expect(doc).toContain('| Business processes | Answered by |');
    expect(doc).toContain('| Retail sales: sum of Net sales amount by Product › Category and Date › Fiscal week |');
    expect(doc).toContain('2 of 3 must-have requirements are answered');
    for (const r of p.requirements) delete r.query;
    expect(requirementsToMarkdown(p)).not.toContain('Answered by');
  });

  it('marks queries that no longer match the design', () => {
    const p = retail();
    p.processes[0]!.facts = p.processes[0]!.facts.filter((f) => f.id !== 'ms_net_sales');
    expect(requirementsToMarkdown(p)).toContain('_(no longer matches the design)_');
  });
});

describe('prototype queries.sql', () => {
  it('starts with the SQL for each answered requirement', () => {
    const sql = exampleQueries(retail(), 'sqlserver');
    const requirements = sql.slice(0, sql.indexOf('-- ─── Examples'));
    expect(requirements).toContain('-- R1 (Must): Which categories and brands are growing, by store, region and week?');
    expect(requirements).toContain('-- Retail sales: sum of Net sales amount by Product › Category and Date › Fiscal week');
    expect(requirements).toContain('SELECT TOP (20)\n  p.category,\n  d.fiscal_week,');
    expect(requirements).not.toContain('R3 (Must)');
  });

  it('keeps multi-line statements on one comment line', () => {
    const p = retail();
    p.requirements[0]!.statement = 'Which categories\nare growing?';
    expect(exampleQueries(p, 'postgres')).toContain('-- R1 (Must): Which categories are growing?\n');
  });
});

describe('project file', () => {
  it('normalises saved queries and keeps them valid against the JSON Schema', () => {
    const raw = JSON.parse(serializeProject(retail()));
    raw.requirements[2].query = {
      processId: 'bp_store_inventory',
      measureId: 'ms_qty_on_hand',
      aggregate: 'count',
      groupBy: [{ dimensionId: 'dm_store', attributeId: 'at_store_region', extra: 1 }, { dimensionId: 'dm_product', column: ' brand ' }, { dimensionId: 'dm_date' }, 'junk'],
      filter: { column: { dimensionId: 'dm_store', role: '  ', attributeId: 'at_store_format' }, value: 12 },
    };
    raw.requirements[3].query = { measureId: 'ms_qty_received' };
    raw.requirements[4].query = { processId: 'bp_gone', measureId: 'ms_gone', aggregate: 'median' };
    const p = normalizeProject(raw);
    expect(p.requirements[2]!.query).toEqual({
      processId: 'bp_store_inventory',
      aggregate: 'count',
      groupBy: [{ dimensionId: 'dm_store', attributeId: 'at_store_region' }, { dimensionId: 'dm_product', column: 'brand' }],
      filter: { column: { dimensionId: 'dm_store', attributeId: 'at_store_format' }, value: '12' },
    });
    expect(p.requirements[3]).not.toHaveProperty('query');
    // Kept although it no longer matches: validation reports it, so the user can fix it.
    expect(p.requirements[4]!.query).toEqual({ processId: 'bp_gone', measureId: 'ms_gone', aggregate: 'sum', groupBy: [] });
    expect(validateSchema(JSON.parse(serializeProject(p))), JSON.stringify(validateSchema.errors)).toBe(true);
  });
});
