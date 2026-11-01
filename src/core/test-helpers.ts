import { createDimension, createMeasure, createProcess, createProject, type KimballProject } from './model';

/** A small, valid project: two processes sharing Date and Product. */
export function tinyProject(): KimballProject {
  const p = createProject('Tiny', '2026-01-01T00:00:00.000Z');
  const date = createDimension({ id: 'dm_date', name: 'Date', kind: 'date' });
  const product = createDimension({ id: 'dm_product', name: 'Product' });
  const store = createDimension({ id: 'dm_store', name: 'Store' });
  p.dimensions.push(date, product, store);
  p.processes.push(
    createProcess({
      id: 'bp_sales',
      name: 'Sales',
      grain: 'One row per sales line',
      factTableType: 'transaction',
      businessValue: 5,
      feasibility: 4,
      facts: [createMeasure({ id: 'ms_amount', name: 'Amount' })],
      dimensions: [
        { dimensionId: 'dm_date', roles: [] },
        { dimensionId: 'dm_product', roles: [] },
        { dimensionId: 'dm_store', roles: [] },
      ],
    }),
    createProcess({
      id: 'bp_inventory',
      name: 'Inventory',
      grain: 'One row per product per day',
      factTableType: 'periodic-snapshot',
      businessValue: 3,
      feasibility: 3,
      facts: [createMeasure({ id: 'ms_on_hand', name: 'On hand', additivity: 'semi-additive' })],
      dimensions: [
        { dimensionId: 'dm_date', roles: ['Snapshot date'] },
        { dimensionId: 'dm_product', roles: [] },
      ],
    }),
  );
  return p;
}
