// Renders brand SVGs to PNG with Playwright's Chromium (dev dependency).
// Usage: node scripts/render-brand.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const targets = [
  { svg: 'brand/social-preview.svg', png: 'brand/social-preview.png', width: 1280, height: 640 },
  { svg: 'brand/logo-mark.svg', png: 'brand/logo-mark-512.png', width: 512, height: 512 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  const svg = readFileSync(t.svg, 'utf8').replace(/width="\d+" height="\d+"/, `width="${t.width}" height="${t.height}"`);
  await page.setViewportSize({ width: t.width, height: t.height });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').first().screenshot({ path: t.png, omitBackground: true });
  console.log(`rendered ${t.png}`);
}
await browser.close();
