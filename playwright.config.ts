import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the built single-file UI and the bundled CLI
// (`npm run build:skill` first), exactly what ships in the skill.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
  },
});
