import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, type ChildProcess } from 'node:child_process';
import { CLI, startServe } from './helpers';

let dir: string;
let file: string;
let server: { url: string; proc: ChildProcess };

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kd-e2e-'));
  file = join(dir, 'live.kimball.json');
  execFileSync(process.execPath, [CLI, 'init', file, '--example', 'retail']);
  server = await startServe(file, 4300 + Math.floor(Math.random() * 500));
});

test.afterEach(() => {
  server?.proc.kill();
  rmSync(dir, { recursive: true, force: true });
});

const readName = () => JSON.parse(readFileSync(file, 'utf8')).meta.name as string;

test('the browser and the project file stay in sync both ways', async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator('.sync', { hasText: 'Synced to live.kimball.json' })).toBeVisible();

  // Browser → file
  await page.getByLabel('Project name').fill('Retail analytics (live)');
  await expect.poll(readName, { timeout: 5000 }).toBe('Retail analytics (live)');
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Retail analytics (live)');

  // File → browser (as when Claude edits the file), including following currentPhase
  const project = JSON.parse(readFileSync(file, 'utf8'));
  project.processes.push({
    id: 'bp_returns',
    name: 'Customer returns',
    grain: 'One row per returned item',
    factTableType: 'transaction',
    dimensions: [{ dimensionId: 'dm_date', roles: ['Return date'] }],
    facts: [{ id: 'ms_refund', name: 'Refund amount' }],
  });
  project.meta.currentPhase = 'bubbles';
  writeFileSync(file, JSON.stringify(project, null, 2));

  await expect(page.getByText(/edited outside the browser/)).toBeVisible({ timeout: 6000 });
  await expect(page).toHaveURL(/#\/bubbles$/);
  await expect(page.getByRole('button', { name: /Customer returns/ })).toBeVisible();
});

test('a conflicting edit asks which version to keep', async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator('.sync', { hasText: 'Synced' })).toBeVisible();

  // Stop the UI from saving immediately by editing, then change the file underneath it.
  await page.getByLabel('Project name').fill('Browser version');
  const project = JSON.parse(readFileSync(file, 'utf8'));
  project.meta.name = 'Disk version';
  writeFileSync(file, JSON.stringify(project, null, 2));

  const alert = page.getByRole('alert');
  // Either the save hits 409 or the poll detects the change first — both must surface a choice.
  await expect(alert).toBeVisible({ timeout: 8000 });
  await alert.getByRole('button', { name: 'Load the file version' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Disk version');
  await expect(alert).toBeHidden();
});
