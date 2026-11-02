import { expect, test } from '@playwright/test';
import { goToPhase, UI_FILE_URL } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /Retail sales & inventory/ }).click();
});

test('a bubble opens its dimension from the keyboard', async ({ page }) => {
  await goToPhase(page, 'bubbles');
  const bubble = page.getByRole('button', { name: 'Open dimension Product' });
  await bubble.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Dimensions' })).toBeVisible();
  // The opened dimension's name field has focus.
  await expect(page.locator(':focus')).toHaveValue('Product');
});

test('processes with the same scores get separate labels on the prioritisation grid', async ({ page }) => {
  await goToPhase(page, 'processes');
  const cards = page.locator('.card.accent-fact');
  for (const i of [0, 1]) {
    for (const name of ['Business value', 'Feasibility']) {
      const four = cards.nth(i).getByRole('group', { name }).getByRole('button', { name: '4', exact: true });
      if ((await four.getAttribute('aria-pressed')) !== 'true') await four.click();
    }
  }
  const labels = page.locator('.priority svg text[font-weight="600"]');
  const boxes = await labels.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a]!;
      const B = boxes[b]!;
      const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
      expect(overlap, `labels ${a} and ${b} overlap`).toBe(false);
    }
  }
});

test('on a phone the header fits and the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await goToPhase(page, 'requirements');
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    header: document.querySelector('.app-header')!.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  expect(widths.header).toBeLessThanOrEqual(widths.viewport);
  // The Project menu keeps its name although the text is hidden.
  await expect(page.getByRole('button', { name: 'Project' })).toBeVisible();
});

test('Escape closes the coach overlay on narrower screens', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await goToPhase(page, 'grain');
  // Opened at desktop width, the coach may already be showing; it is now an overlay.
  const show = page.getByRole('button', { name: 'Show coach' });
  if (await show.count()) await show.click();
  await expect(page.getByRole('complementary', { name: 'Coach' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Coach' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show coach' })).toBeFocused();
});
