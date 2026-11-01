import { expect, test } from '@playwright/test';
import { goToPhase, UI_FILE_URL } from './helpers';

test('a developer goes from kickoff to bus matrix and exports everything (offline file)', async ({ page }) => {
  await page.goto(UI_FILE_URL);

  // Welcome → new project
  await expect(page.getByRole('heading', { name: 'Start a new project' })).toBeVisible();
  await page.getByLabel('Project name').fill('Coffee chain analytics');
  await page.getByRole('button', { name: 'Start' }).click();

  // 1 Kickoff
  await expect(page.getByRole('heading', { level: 1, name: 'Kickoff' })).toBeVisible();
  await page.getByLabel('Purpose').fill('Show store managers which products and dayparts drive margin.');
  await page.getByLabel('In scope').fill('Store sales and online orders for all 40 stores.');
  await expect(page.locator('.step.complete', { hasText: 'Kickoff' })).toBeVisible();

  // 4 Business processes (quick add)
  await page.getByRole('button', { name: /Business processes/ }).click();
  await page.getByRole('button', { name: /^Orders$/ }).click();
  await page.getByRole('button', { name: /^Shipments$/ }).click();
  await expect(page.locator('.card.accent-fact')).toHaveCount(2);

  // 5 Grain
  await page.getByRole('button', { name: 'Next: Grain' }).click();
  const grainCards = page.locator('.card.accent-fact');
  await grainCards.nth(0).getByRole('button', { name: /^Transaction/ }).click();
  await grainCards.nth(0).getByLabel('Grain statement').fill('One row per order line');
  await grainCards.nth(1).getByRole('button', { name: /^Accumulating snapshot/ }).click();
  await grainCards.nth(1).getByLabel('Grain statement').fill('One row per shipment, updated at each milestone');
  await expect(page.locator('.step.complete', { hasText: 'Grain' })).toBeVisible();

  // 6 Dimensions: catalogue via quick add, then assign per process
  await page.getByRole('button', { name: 'Next: Dimensions' }).click();
  for (const name of ['Date', 'Customer', 'Product']) await page.getByRole('button', { name: new RegExp(`^${name}$`) }).first().click();
  const processCards = page.locator('.card.accent-fact');
  for (const name of ['Date', 'Customer', 'Product']) await processCards.nth(0).getByRole('button', { name, exact: true }).click();
  for (const name of ['Date', 'Customer']) await processCards.nth(1).getByRole('button', { name, exact: true }).click();
  await processCards.nth(1).getByLabel('Date — roles (optional)').fill('Ship date');
  await processCards.nth(1).getByLabel('Date — roles (optional)').press('Enter');
  await processCards.nth(1).getByLabel('Date — roles (optional)').fill('Delivery date');
  await processCards.nth(1).getByLabel('Date — roles (optional)').press('Enter');
  await expect(page.getByText('Conformed · 2 processes')).toHaveCount(2);

  // 7 Facts
  await page.getByRole('button', { name: 'Next: Facts' }).click();
  const factCards = page.locator('.card.accent-fact');
  await factCards.nth(0).getByRole('button', { name: 'Add fact' }).click();
  await factCards.nth(0).getByLabel('Fact name').fill('Sales amount');
  await factCards.nth(1).getByRole('button', { name: 'Add fact' }).click();
  await factCards.nth(1).getByLabel('Fact name').fill('Days to deliver');

  // 8 Bubble diagrams
  await page.getByRole('button', { name: 'Next: Bubble diagrams' }).click();
  await expect(page.locator('.diagram svg [data-dimension-id]')).toHaveCount(3);
  await expect(page.locator('.diagram svg title').first()).toContainText('Bubble diagram: Orders');

  // 9 Bus matrix
  await page.getByRole('button', { name: 'Next: Bus matrix' }).click();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(5);
  await expect(page.locator('.matrix thead th.conformed')).toHaveCount(2);
  // Toggle a cell with the keyboard, then undo.
  const cell = page.getByRole('checkbox', { name: 'Shipments uses Product' });
  await cell.focus();
  await page.keyboard.press('Space');
  await expect(cell).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Control+z');
  await expect(cell).toHaveAttribute('aria-checked', 'false');

  // 10 Review & export
  await page.getByRole('button', { name: 'Next: Review & export' }).click();
  await expect(page.locator('.stat', { hasText: 'errors' }).locator('b')).toHaveText('0');
  await expect(page.locator('.stat', { hasText: 'warnings' }).locator('b')).toHaveText('0');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download all/ }).click()]);
  expect(download.suggestedFilename()).toBe('coffee-chain-analytics-kimball-deliverables.zip');

  // Autosave status is shown (persistence across reloads is covered by the served-mode test).
  await expect(page.getByRole('status').filter({ hasText: /Saved in this browser|storage is unavailable/ }).first()).toBeVisible();
});

test('an example project loads and every phase renders', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /Healthcare claims/ }).click();
  for (const [id, title] of [
    ['kickoff', 'Kickoff'],
    ['stakeholders', 'Stakeholders'],
    ['requirements', 'Requirements'],
    ['processes', 'Business processes'],
    ['grain', 'Grain'],
    ['dimensions', 'Dimensions'],
    ['facts', 'Facts'],
    ['bubbles', 'Bubble diagrams'],
    ['matrix', 'Bus matrix'],
    ['review', 'Review & export'],
  ] as const) {
    await goToPhase(page, id);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  await expect(page.getByText('10 of 10 phases')).toBeVisible();
});
