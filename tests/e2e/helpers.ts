import { spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';

export const SKILL_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../plugin/skills/kimball-designer');
export const UI_FILE_URL = pathToFileURL(join(SKILL_DIR, 'ui', 'index.html')).href;
export const CLI = join(SKILL_DIR, 'scripts', 'kimball.mjs');

/** Navigates to a phase via the hash router. */
export async function goToPhase(page: Page, id: string) {
  await page.evaluate((phase) => (window.location.hash = `/${phase}`), id);
  await page.waitForFunction((phase) => window.location.hash === `#/${phase}`, id);
}

/** Starts `kimball serve` on a file and resolves with its URL. */
export function startServe(file: string, port: number): Promise<{ url: string; proc: ChildProcess }> {
  return new Promise((ok, fail) => {
    const proc = spawn(process.execPath, [CLI, 'serve', file, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => fail(new Error(`kimball serve did not start:\n${out}`)), 15_000);
    proc.stdout!.on('data', (d: Buffer) => {
      out += d.toString();
      const m = out.match(/→ (http:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        ok({ url: m[1]!, proc });
      }
    });
    proc.stderr!.on('data', (d: Buffer) => (out += d.toString()));
    proc.on('exit', (code) => fail(new Error(`kimball serve exited with ${code}:\n${out}`)));
  });
}
