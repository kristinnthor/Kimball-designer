import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import {
  serializeProject,
  createDimension,
  createMeasure,
  createProcess,
  createProject,
  ddlScript,
  defaultQuery,
  distinctValues,
  generateSampleData,
  indexAdvice,
  inferMeasureType,
  loadExample,
  normalizeProject,
  physicalModel,
  prototypeFiles,
  runQuery,
  seedScript,
  sqlLiteral,
  sqlName,
  tableToCsv,
  type KimballProject,
} from './index';

const retail = () => loadExample('retail', '2026-01-01T00:00:00.000Z');
const saas = () => loadExample('saas', '2026-01-01T00:00:00.000Z');

describe('sqlName', () => {
  it('makes safe snake_case identifiers', () => {
    expect(sqlName('Net sales amount')).toBe('net_sales_amount');
    expect(sqlName('Þjónusta og ráðgjöf')).toBe('thjonusta_og_radgjof');
    expect(sqlName('Margin %')).toBe('margin_pct');
    expect(sqlName('2nd address')).toBe('n_2nd_address');
    expect(sqlName('   ', 'fallback')).toBe('fallback');
  });
});

describe('physicalModel', () => {
  it('builds dimension and fact tables from the retail example', () => {
    const model = physicalModel(retail());
    const names = model.tables.map((t) => t.name);
    expect(names).toContain('dim_date');
    expect(names).toContain('dim_product');
    expect(names).toContain('fact_retail_sales');
    // Degenerate dimensions become fact columns, not tables.
    expect(names).not.toContain('dim_pos_transaction_number');
    const sales = model.tables.find((t) => t.name === 'fact_retail_sales')!;
    expect(sales.columns.find((c) => c.name === 'pos_transaction_number')?.role).toBe('degenerate');
    expect(sales.columns.find((c) => c.name === 'cashier_employee_key')?.references).toEqual({ table: 'dim_employee', column: 'employee_key' });
  });

  it('gives each role its own foreign key', () => {
    const model = physicalModel(retail());
    const po = model.tables.find((t) => t.name === 'fact_purchase_order_receipts')!;
    const fks = po.columns.filter((c) => c.role === 'foreign-key').map((c) => c.name);
    expect(fks).toEqual(expect.arrayContaining(['order_date_key', 'expected_date_key', 'receipt_date_key', 'receiving_location_store_key']));
  });

  it('adds type 2 history columns and finds the business key', () => {
    const model = physicalModel(retail());
    const product = model.tables.find((t) => t.name === 'dim_product')!;
    expect(product.scd2).toBe(true);
    expect(product.businessKey).toEqual(['sku_number']);
    expect(product.columns.map((c) => c.name)).toEqual(expect.arrayContaining(['row_effective_date', 'row_expiration_date', 'is_current_row']));
  });

  it('adds a business key and a name when the design has no attributes', () => {
    const p = createProject('T');
    const dim = createDimension({ name: 'Warehouse' });
    p.dimensions.push(dim);
    p.processes.push(createProcess({ name: 'Shipments', dimensions: [{ dimensionId: dim.id, roles: [] }] }));
    const t = physicalModel(p).tables.find((x) => x.name === 'dim_warehouse')!;
    expect(t.columns.map((c) => c.name)).toEqual(['warehouse_key', 'warehouse_code', 'warehouse_name']);
    expect(t.columns.filter((c) => c.added).length).toBe(2);
  });

  it('prefixes reserved words and keeps names unique', () => {
    const p = createProject('T');
    const dim = createDimension({ name: 'Customer', attributes: [
      { id: 'a1', name: 'Group', description: '', scdType: null },
      { id: 'a2', name: 'group', description: '', scdType: null },
    ] });
    p.dimensions.push(dim);
    const t = physicalModel(p).tables[0]!;
    expect(t.columns.map((c) => c.name)).toContain('customer_group');
    expect(t.columns.map((c) => c.name)).toContain('customer_group_2');
  });

  it('avoids words reserved in SQL Server and Snowflake', () => {
    const p = createProject('T');
    p.dimensions.push(
      createDimension({
        name: 'Claim line',
        attributes: ['Procedure', 'Account', 'Transaction', 'Schema'].map((name, i) => ({ id: `a${i}`, name, description: '', scdType: null })),
      }),
    );
    const names = physicalModel(p).tables[0]!.columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['claim_line_procedure', 'claim_line_account', 'claim_line_transaction', 'claim_line_schema']));
  });

  it('infers measure types from name and unit', () => {
    expect(inferMeasureType(createMeasure({ name: 'Sales quantity', unit: 'units' })).dataType).toBe('integer');
    expect(inferMeasureType(createMeasure({ name: 'Net sales amount', unit: 'currency' }))).toMatchObject({ dataType: 'decimal', scale: 2 });
    expect(inferMeasureType(createMeasure({ name: 'Margin', unit: '%' }))).toMatchObject({ dataType: 'decimal', scale: 4 });
    expect(inferMeasureType(createMeasure({ name: 'Order-to-ship lag', unit: 'hours' }))).toMatchObject({ dataType: 'decimal', precision: 12 });
    expect(inferMeasureType(createMeasure({ name: 'Weight', unit: 'kg', dataType: 'integer' })).dataType).toBe('integer');
  });
});

describe('ddlScript', () => {
  it('writes PostgreSQL with identity keys, foreign keys and FK indexes', () => {
    const sql = ddlScript(retail(), { dialect: 'postgres' });
    expect(sql).toContain('CREATE TABLE dim_product (');
    expect(sql).toContain('product_key integer GENERATED BY DEFAULT AS IDENTITY NOT NULL');
    expect(sql).toMatch(/CONSTRAINT fk_fact_retail_sales_product_key FOREIGN KEY \(product_key\) REFERENCES dim_product \(product_key\)/);
    expect(sql).toContain('CREATE INDEX ix_fact_retail_sales_product_key ON fact_retail_sales (product_key);');
    expect(sql).toContain('WHERE is_current_row;');
    // Recommendations for later are commented out.
    expect(sql).toMatch(/^-- CREATE INDEX brin_fact_retail_sales_date_key/m);
    // Every statement ends; no dangling comma before a closing parenthesis.
    expect(sql).not.toMatch(/,\s*\n\);/);
  });

  it('writes SQL Server with a clustered columnstore per fact table', () => {
    const sql = ddlScript(retail(), { dialect: 'sqlserver' });
    expect(sql).toContain('int IDENTITY(1,1) NOT NULL');
    expect(sql).toContain('nvarchar(');
    expect(sql).toContain('CREATE CLUSTERED COLUMNSTORE INDEX cci_fact_retail_sales ON fact_retail_sales;');
    expect(sql).toContain('WHERE is_current_row = 1;');
    expect(sql).not.toContain('CREATE INDEX ix_fact_retail_sales_product_key');
  });

  it('writes Snowflake without indexes', () => {
    const sql = ddlScript(retail(), { dialect: 'snowflake' });
    expect(sql).toContain('integer AUTOINCREMENT');
    expect(sql).toContain('number(18,2)');
    expect(sql).not.toMatch(/^CREATE (UNIQUE )?INDEX/m);
    expect(sql).toMatch(/^-- ALTER TABLE fact_retail_sales CLUSTER BY \(date_key\);/m);
  });

  it('keeps object names within PostgreSQL limits', () => {
    for (const a of indexAdvice(physicalModel(saas()), 'postgres')) {
      const name = a.sql.match(/(?:CONSTRAINT|INDEX) (\w+)/)?.[1];
      if (name) expect(name.length).toBeLessThanOrEqual(63);
    }
  });

  it('can drop tables first, facts before dimensions', () => {
    const sql = ddlScript(retail(), { dialect: 'postgres', dropFirst: true });
    expect(sql.indexOf('DROP TABLE IF EXISTS fact_retail_sales;')).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS dim_date;'));
  });

  it('handles an empty project', () => {
    const sql = ddlScript(createProject('Empty'), { dialect: 'postgres' });
    expect(sql).toContain('0 dimension tables, 0 fact tables');
    expect(sql).toContain('Add business processes');
  });
});

describe('generateSampleData', () => {
  it('is deterministic for the same seed', () => {
    const a = generateSampleData(retail());
    const b = generateSampleData(retail());
    expect(a.tables.fact_retail_sales!.rows.slice(0, 20)).toEqual(b.tables.fact_retail_sales!.rows.slice(0, 20));
    const p = retail();
    p.physical = { dialect: 'postgres', seed: 99, dateFrom: '2025-01-01', dateTo: '2025-12-31', rows: {} };
    expect(generateSampleData(p).tables.fact_retail_sales!.rows.slice(0, 20)).not.toEqual(a.tables.fact_retail_sales!.rows.slice(0, 20));
  });

  it('only uses keys that exist in the dimensions', () => {
    const project = retail();
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    for (const fact of model.tables.filter((t) => t.kind === 'fact')) {
      const rows = data.tables[fact.name]!;
      for (const fk of fact.columns.filter((c) => c.role === 'foreign-key')) {
        const dim = data.tables[fk.references!.table]!;
        const keys = new Set(dim.rows.map((r) => r[dim.columns.indexOf(fk.references!.column)]));
        const i = rows.columns.indexOf(fk.name);
        for (const r of rows.rows) expect(keys.has(r[i]!)).toBe(true);
      }
    }
  });

  it('builds one calendar row per day and respects row counts', () => {
    const project = retail();
    project.physical = { dialect: 'postgres', seed: 1, dateFrom: '2024-01-01', dateTo: '2024-12-31', rows: { bp_retail_sales: 50 } };
    const data = generateSampleData(project);
    expect(data.tables.dim_date!.rows).toHaveLength(366);
    expect(data.tables.fact_retail_sales!.rows).toHaveLength(50);
  });

  it('keeps type 2 history consistent', () => {
    const data = generateSampleData(retail());
    const t = data.tables.dim_product!;
    const bk = t.columns.indexOf('sku_number');
    const current = t.columns.indexOf('is_current_row');
    const byKey = new Map<string, number>();
    for (const r of t.rows) if (r[current]) byKey.set(String(r[bk]), (byKey.get(String(r[bk])) ?? 0) + 1);
    expect([...byKey.values()].every((n) => n === 1)).toBe(true);
    expect(t.rows.length).toBeGreaterThan(byKey.size);
  });

  it('gives a junk dimension distinct combinations, so its unique index holds', () => {
    const data = generateSampleData(saas());
    const t = data.tables.dim_change_profile!;
    const combos = t.rows.map((r) => JSON.stringify(r.slice(1)));
    expect(new Set(combos).size).toBe(combos.length);
    expect(combos.length).toBeGreaterThan(5);
  });

  it('generates plausible values: age bands are ages, changes go both ways', () => {
    const health = generateSampleData(loadExample('healthcare', '2026-01-01T00:00:00.000Z'));
    const member = health.tables.dim_member!;
    const ages = new Set(member.rows.map((r) => r[member.columns.indexOf('age_band')]));
    expect([...ages].every((a) => /\d/.test(String(a)))).toBe(true);
    const changes = generateSampleData(saas()).tables.fact_subscription_changes!;
    const mrr = changes.rows.map((r) => Number(r[changes.columns.indexOf('mrr_change')]));
    expect(mrr.some((v) => v < 0)).toBe(true);
    expect(Math.max(...mrr)).toBeLessThan(1000);
  });

  it('uses sample values from the design', () => {
    const project = retail();
    const store = project.dimensions.find((d) => d.name === 'Store')!;
    store.attributes.find((a) => a.name === 'Region')!.sampleValues = ['Capital area', 'North', 'East'];
    const data = generateSampleData(project);
    const t = data.tables.dim_store!;
    const values = new Set(t.rows.map((r) => r[t.columns.indexOf('region')]));
    expect([...values].every((v) => ['Capital area', 'North', 'East'].includes(String(v)))).toBe(true);
  });
});

describe('seed script and CSV', () => {
  it('escapes literals per dialect', () => {
    expect(sqlLiteral("O'Brien", 'postgres')).toBe("'O''Brien'");
    expect(sqlLiteral('Ólafur', 'sqlserver')).toBe("N'Ólafur'");
    expect(sqlLiteral(true, 'sqlserver')).toBe('1');
    expect(sqlLiteral(false, 'snowflake')).toBe('FALSE');
    expect(sqlLiteral(null, 'postgres')).toBe('NULL');
  });

  it('inserts dimensions before facts and handles identity columns', () => {
    const project = retail();
    const data = generateSampleData(project);
    const pg = seedScript(project, data, 'postgres');
    expect(pg.indexOf('INSERT INTO dim_product')).toBeLessThan(pg.indexOf('INSERT INTO fact_retail_sales'));
    expect(pg).toContain("SELECT setval(pg_get_serial_sequence('dim_product', 'product_key')");
    const ms = seedScript(project, data, 'sqlserver');
    expect(ms).toContain('SET IDENTITY_INSERT dim_product ON;');
    // SQL Server allows at most 1000 rows per VALUES list.
    for (const block of ms.split('INSERT INTO').slice(1)) expect(block.split('\n  (').length - 1).toBeLessThanOrEqual(1000);
  });

  it('writes CSV with a BOM and keeps negative numbers numeric', () => {
    const csv = tableToCsv({ name: 't', columns: ['a', 'b'], rows: [[-5, '=SUM(A1)'], [null, true]] });
    expect(csv.startsWith('﻿a,b\r\n')).toBe(true);
    expect(csv).toContain("-5,'=SUM(A1)");
    expect(csv).toContain(',true');
  });
});

describe('explore', () => {
  it('groups facts by a dimension attribute and returns matching SQL', () => {
    const project = retail();
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    const fact = model.tables.find((t) => t.name === 'fact_retail_sales')!;
    const q = defaultQuery(model, fact);
    expect(q.measure).toBe('net_sales_amount');
    const res = runQuery(model, data, { ...q, measure: 'net_sales_amount', groupBy: [{ column: 'product_key', attribute: 'category' }] }, 'postgres');
    expect(res.rows.length).toBeGreaterThan(1);
    const total = res.rows.reduce((s, r) => s + Number(r[1]), 0);
    const all = runQuery(model, data, { ...q, measure: 'net_sales_amount', groupBy: [] }, 'postgres');
    expect(total).toBeCloseTo(Number(all.rows[0]![0]), 0);
    expect(res.sql).toContain('JOIN dim_product AS p ON p.product_key = f.product_key');
    expect(res.sql).toContain('GROUP BY p.category');
    expect(res.sql).toMatch(/LIMIT 20;$/);
  });

  it('warns when a semi-additive fact is summed across dates', () => {
    const project = retail();
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    const q = { fact: 'fact_store_inventory', measure: 'quantity_on_hand', aggregate: 'sum' as const, groupBy: [{ column: 'store_key', attribute: 'region' }] };
    expect(runQuery(model, data, q, 'postgres').warning).toMatch(/semi-additive/);
    expect(runQuery(model, data, { ...q, groupBy: [...q.groupBy, { column: 'snapshot_date_key', attribute: 'full_date' }] }, 'postgres').warning).toBeNull();
  });

  it('filters and uses TOP for SQL Server', () => {
    const project = retail();
    const model = physicalModel(project);
    const data = generateSampleData(project, model);
    const by = { column: 'store_key', attribute: 'region' };
    const regions = distinctValues(model, data, 'fact_retail_sales', by);
    expect(regions.length).toBeGreaterThan(1);
    const res = runQuery(model, data, { fact: 'fact_retail_sales', measure: null, aggregate: 'count', groupBy: [by], filter: { by, value: regions[0]! } }, 'sqlserver');
    expect(res.rows).toHaveLength(1);
    expect(res.sql).toMatch(/^SELECT TOP \(20\)/);
    expect(res.sql).toContain(`WHERE s.region = N'${regions[0]}'`);
  });
});

describe('prototype bundle', () => {
  it('contains the sandbox, scripts and CSVs', () => {
    const files = prototypeFiles(retail());
    const names = files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['README.md', 'docker-compose.yml', 'initdb/01-schema.sql', 'initdb/02-data.sql', 'schema.sql', 'index-recommendations.md', 'queries.sql', 'data/fact_retail_sales.csv']));
    const compose = files.find((f) => f.name === 'docker-compose.yml')!.data;
    expect(compose).toContain('127.0.0.1:5433:5432');
    expect(compose).toContain('./initdb:/docker-entrypoint-initdb.d:ro');
  });

  it('adds a seed script for the target dialect', () => {
    const p = retail();
    p.physical = { dialect: 'sqlserver', seed: 1, dateFrom: '2025-01-01', dateTo: '2025-03-31', rows: {} };
    const files = prototypeFiles(p);
    expect(files.find((f) => f.name === 'schema.sql')!.data).toContain('COLUMNSTORE');
    expect(files.some((f) => f.name === 'data.sqlserver.sql')).toBe(true);
  });
});

describe('physical settings in the project file', () => {
  const withPhysical = (physical: unknown): KimballProject =>
    normalizeProject({ schemaVersion: '1.0', meta: { name: 'X', createdAt: '2026-03-01T00:00:00Z' }, physical });

  it('round-trips valid settings and drops invalid ones', () => {
    expect(withPhysical({ dialect: 'snowflake', seed: 7, dateFrom: '2024-02-01', dateTo: '2024-01-01', rows: { bp_a: '250', 'bad id': 0 } }).physical).toEqual({
      dialect: 'snowflake',
      seed: 7,
      dateFrom: '2024-01-01',
      dateTo: '2024-02-01',
      rows: { bp_a: 250 },
    });
    expect(withPhysical({ dialect: 'oracle', dateFrom: '2024-02-30' }).physical).toMatchObject({ dialect: 'postgres', dateFrom: '2025-01-01' });
    expect(withPhysical(undefined).physical).toBeUndefined();
  });

  it('serialises the new fields so they match the JSON Schema', () => {
    const schema = JSON.parse(readFileSync(new URL('./schema/kimball-project.schema.json', import.meta.url), 'utf8'));
    const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
    const p = retail();
    p.meta.currentPhase = 'prototype';
    p.physical = { dialect: 'sqlserver', seed: 3, dateFrom: '2024-01-01', dateTo: '2024-06-30', rows: { bp_retail_sales: 200 } };
    const attr = p.dimensions[1]!.attributes[0]!;
    Object.assign(attr, { dataType: 'text', businessKey: true, sampleValues: ['A-1', 'A-2'] });
    Object.assign(p.processes[0]!.facts[0]!, { dataType: 'integer', sampleRange: [1, 12] });
    const ok = validate(JSON.parse(serializeProject(normalizeProject(JSON.parse(serializeProject(p))))));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('keeps optional attribute and measure fields only when set', () => {
    const p = normalizeProject({
      schemaVersion: '1.0',
      meta: { name: 'X' },
      dimensions: [{ id: 'dm_a', name: 'A', attributes: [{ id: 'at_1', name: 'Code', businessKey: true, dataType: 'text', sampleValues: ['A1', ''] }, { id: 'at_2', name: 'B' }] }],
      processes: [{ id: 'bp_a', name: 'P', facts: [{ id: 'ms_1', name: 'Qty', sampleRange: [10, 1] }, { id: 'ms_2', name: 'Amt', dataType: 'text' }] }],
    });
    expect(p.dimensions[0]!.attributes[0]).toMatchObject({ businessKey: true, dataType: 'text', sampleValues: ['A1'] });
    expect(Object.keys(p.dimensions[0]!.attributes[1]!)).toEqual(['id', 'name', 'description', 'scdType']);
    expect(p.processes[0]!.facts[0]!.sampleRange).toEqual([1, 10]);
    expect(p.processes[0]!.facts[1]!.dataType).toBeUndefined();
  });
});
