import { expect, test } from '@playwright/test';
import { UI_FILE_URL } from './helpers';

test('Help explains the deliverables and a demo walks a new user through their first process', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('link', { name: /Help, demos and what you get/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'How Kimball Designer works' })).toBeVisible();

  // What you get: live samples and every deliverable explained.
  const toc = page.getByRole('navigation', { name: 'Help contents' });
  await toc.getByRole('link', { name: 'What you get' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'What you get' })).toBeInViewport();
  await expect(page.locator('.help .diagram svg')).toBeVisible();
  await expect(page.locator('.help .matrix .matrix-cell[aria-checked="true"]')).toHaveCount(21);
  for (const title of ['Bubble diagrams', 'Enterprise bus matrix', 'Requirements document', 'Project file']) {
    await expect(page.getByRole('heading', { level: 4, name: title, exact: true })).toBeVisible();
  }

  // Start the demo.
  await toc.getByRole('link', { name: 'Demos' }).click();
  await page.getByRole('button', { name: 'Start demo: Model your first business process' }).click();
  const bar = page.getByRole('region', { name: 'Demo: Model your first business process' });
  const next = bar.getByRole('button', { name: 'Next demo step' });
  const done = bar.locator('.badge.success');
  const h1 = (name: string) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // 1 Purpose and scope
  await h1('Kickoff');
  await expect(bar).toContainText('Step 1 of 11');
  await expect(done).toBeHidden();
  await page.getByLabel('Purpose').fill('Know which products sell best in each shop, by hour');
  await page.getByLabel('In scope').fill('Till sales in all shops');
  await expect(done).toBeVisible();
  await next.click();

  // 2 Interview someone
  await h1('Stakeholders');
  await page.getByRole('button', { name: 'Add stakeholder' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Ana');
  await page.getByLabel('Role', { exact: true }).fill('Operations manager');
  await page.getByRole('group', { name: 'Interview status' }).getByRole('button', { name: 'Done' }).click();
  await expect(done).toBeVisible();
  await next.click();

  // 3 Write a business question
  await h1('Requirements');
  await page.getByRole('button', { name: 'Add requirement' }).first().click();
  await page.getByLabel('Business question or need').fill('Which products sell best in each shop and hour?');
  await expect(done).toBeVisible();
  await next.click();

  // 4 Add the business process and score it
  await h1('Business processes');
  await page.getByRole('button', { name: /^Sales$/ }).click();
  await page.getByRole('group', { name: 'Business value' }).getByRole('button', { name: '5' }).click();
  await page.getByRole('group', { name: 'Feasibility' }).getByRole('button', { name: '4' }).click();
  await expect(done).toBeVisible();
  await next.click();

  // 5 Declare the grain
  await h1('Grain');
  const sales = page.locator('.card.accent-fact').first();
  await sales.getByRole('button', { name: /^Transaction/ }).click();
  await sales.getByLabel('Grain statement').fill('One row per item on a receipt');
  await expect(done).toBeVisible();
  await next.click();

  // 6 Pick the dimensions
  await h1('Dimensions');
  for (const name of ['Date', 'Product', 'Location']) await page.getByRole('button', { name: new RegExp(`^${name}$`) }).first().click();
  for (const name of ['Date', 'Product', 'Location']) await page.locator('.card.accent-fact').first().getByRole('button', { name, exact: true }).click();
  await expect(done).toBeVisible();
  await next.click();

  // 7 Add the facts
  await h1('Facts');
  const facts = page.locator('.card.accent-fact').first();
  await facts.getByRole('button', { name: 'Add fact' }).click();
  await facts.getByLabel('Fact name').nth(0).fill('Quantity');
  await facts.getByRole('button', { name: 'Add fact' }).click();
  await facts.getByLabel('Fact name').nth(1).fill('Sales amount');
  await expect(done).toBeVisible();
  await next.click();

  // 8 See the bubble diagram
  await h1('Bubble diagrams');
  await expect(page.locator('.diagram svg [data-dimension-id]')).toHaveCount(3);
  await expect(done).toBeVisible();
  await next.click();

  // 9 Share a dimension with a second process
  await h1('Business processes');
  await page.getByRole('button', { name: /^Inventory snapshot$/ }).click();
  await page.getByRole('navigation', { name: 'Phases' }).getByRole('button', { name: /^Dimensions/ }).click();
  await expect(bar.getByRole('button', { name: 'Back to Business processes' })).toBeVisible();
  for (const name of ['Date', 'Product', 'Location']) await page.locator('.card.accent-fact').nth(1).getByRole('button', { name, exact: true }).click();
  await expect(done).toBeVisible();
  await next.click();

  // 10 The bus matrix now has conformed columns
  await h1('Bus matrix');
  await expect(page.locator('.matrix thead th.conformed')).toHaveCount(3);
  await next.click();

  // 11 Review and finish
  await h1('Review & export');
  await expect(bar).toContainText('Step 11 of 11');
  await bar.getByRole('button', { name: 'Finish demo' }).click();
  await expect(bar).toBeHidden();
  await expect(page.getByText(/Demo complete: Model your first business process/)).toBeVisible();
});
