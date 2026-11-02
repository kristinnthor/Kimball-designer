import { expect, test } from '@playwright/test';
import { goToPhase, UI_FILE_URL } from './helpers';

test('the prototype explores sample data and offers the SQL and a sandbox', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /Retail sales & inventory/ }).click();
  await goToPhase(page, 'prototype');
  await expect(page.getByRole('heading', { level: 1, name: 'Prototype' })).toBeVisible();

  // Explore: group net sales by store region and see the SQL.
  await page.getByLabel('Group by').selectOption({ label: 'region' });
  const result = page.locator('.explore-result');
  await expect(result.locator('thead th').first()).toHaveText('region');
  expect(await result.locator('tbody tr').count()).toBeGreaterThan(1);
  await expect(page.getByLabel('SQL for this question')).toContainText('GROUP BY s.region');

  // Summing a semi-additive fact without a date warns.
  await page.getByLabel('Fact table').selectOption({ label: 'Store inventory (fact_store_inventory)' });
  await page.getByLabel('Measure').selectOption({ label: 'quantity_on_hand (semi-additive)' });
  await page.getByLabel('Aggregate').selectOption('sum');
  await expect(page.locator('.callout.warning', { hasText: 'semi-additive' })).toBeVisible();

  // Sample values from the design show up in the data.
  const store = page.locator('.table-card').filter({ has: page.locator('.table-name', { hasText: /^dim_store$/ }) });
  await store.locator(':scope > summary').click();
  await store.getByText('Make the data look real').click();
  const regionValues = store.getByLabel('Sample values for Region');
  await regionValues.fill('Capital area, North Iceland');
  await regionValues.press('Enter');
  await expect(store.locator('table.sample')).toContainText(/Capital area|North Iceland/);

  // SQL Server script with a columnstore, and the downloads.
  await page.getByRole('button', { name: 'SQL Server' }).click();
  await expect(page.getByLabel('CREATE TABLE script')).toContainText('CREATE CLUSTERED COLUMNSTORE INDEX cci_fact_retail_sales');
  await page.getByRole('button', { name: /^Index advice \(\d+\)/ }).click();
  await expect(page.locator('.advice-table').first()).toBeVisible();
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Docker sandbox/ }).click()]);
  expect(zip.suggestedFilename()).toBe('retail-analytics-prototype.zip');
  const [ddl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CREATE TABLE (.sql)' }).click()]);
  expect(ddl.suggestedFilename()).toBe('retail-analytics-schema.sqlserver.sql');
});

test('stakeholders are offered as business owners, and long open questions stay readable', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /Retail sales & inventory/ }).click();
  await goToPhase(page, 'processes');
  const owner = page.getByRole('combobox', { name: 'Business owner' }).first();
  await owner.fill('');
  await owner.press('ArrowDown');
  await expect(page.getByRole('option')).toHaveCount(5);
  await page.getByRole('option', { name: /Jonas Berg/ }).click();
  await expect(owner).toHaveValue('Jonas Berg');

  await goToPhase(page, 'requirements');
  const question = page.getByLabel('Open question 1', { exact: true });
  const long = 'Is product cost available per order line in the ERP, or only per purchase order? '.repeat(4);
  await question.fill(long);
  const fits = await question.evaluate((el: HTMLTextAreaElement) => el.scrollHeight <= el.clientHeight + 1);
  expect(fits).toBe(true);
});

test('a saved question answers a requirement, and the answer can be shown, replaced and removed', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /Retail sales & inventory/ }).click();
  await goToPhase(page, 'prototype');
  const coverage = page.locator('section', { has: page.getByRole('heading', { name: 'Requirements', exact: true }) });
  await expect(coverage).toContainText('2 of 3 must-have requirements');

  // Answer R3 (out of stock) with a question about store inventory.
  await page.getByLabel('Fact table').selectOption({ label: 'Store inventory (fact_store_inventory)' });
  await page.getByLabel('Measure').selectOption({ label: 'days_of_supply (non-additive)' });
  await page.getByLabel('Aggregate').selectOption('min');
  await page.getByLabel('Group by').selectOption({ label: 'region' });
  await expect(coverage).toContainText('The question above: Store inventory: minimum of Days of supply by Store › Region');
  await coverage.getByRole('button', { name: 'Use the question above for R3' }).click();
  const r3 = coverage.getByRole('row', { name: /^R3 / });
  await expect(r3).toContainText('Store inventory: minimum of Days of supply by Store › Region');
  await expect(r3).toContainText('Shown above');
  await expect(coverage).toContainText('3 of 3 must-have requirements');

  // Show R1's query in the explorer, then remove it and undo.
  await coverage.getByRole('button', { name: 'Show the query for R1' }).click();
  await expect(page.getByLabel('Fact table')).toHaveValue('fact_retail_sales');
  await expect(page.getByLabel('SQL for this question')).toContainText('GROUP BY p.category, d.fiscal_week');
  await coverage.getByRole('button', { name: 'Remove the answer to R1' }).click();
  await expect(coverage.getByRole('row', { name: /^R1 / })).toContainText('Not answered yet');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(coverage.getByRole('row', { name: /^R1 / })).toContainText('Product › Category and Date › Fiscal week');

  // The requirements phase shows the answer too.
  await goToPhase(page, 'requirements');
  await expect(page.getByText('Answered in the prototype by: Store inventory: minimum of Days of supply by Store › Region')).toBeVisible();
});
