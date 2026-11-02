import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { goToPhase, UI_FILE_URL } from './helpers';

const PHASES = ['kickoff', 'stakeholders', 'requirements', 'processes', 'grain', 'dimensions', 'facts', 'bubbles', 'matrix', 'review', 'prototype'];

for (const scheme of ['light', 'dark'] as const) {
  test(`no serious accessibility violations in any phase (${scheme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(UI_FILE_URL);

    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${label}: ${v.id} — ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`);
      expect(serious, serious.join('\n')).toEqual([]);
    };

    await scan('welcome');
    await page.getByRole('link', { name: /Help, demos and what you get/ }).click();
    await scan('help');
    // The tour loads the Retail example, so every phase below is scanned with the demo bar showing.
    await page.getByRole('button', { name: 'Start demo: Tour a finished model' }).click();
    await expect(page.getByRole('region', { name: /^Demo:/ })).toBeVisible();
    for (const id of PHASES) {
      await goToPhase(page, id);
      await scan(id);
    }
  });
}

test('the bus matrix is fully keyboard operable', async ({ page }) => {
  await page.goto(UI_FILE_URL);
  await page.getByRole('button', { name: /SaaS subscriptions/ }).click();
  await goToPhase(page, 'matrix');
  const first = page.locator('[data-cell="0-0"]');
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-cell="0-1"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-cell="1-1"]')).toBeFocused();
  const before = await page.locator('[data-cell="1-1"]').getAttribute('aria-checked');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cell="1-1"]')).not.toHaveAttribute('aria-checked', before!);
});
