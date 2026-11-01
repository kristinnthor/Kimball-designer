import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readUiOrPlaceholder, runCli } from './cli';

// In the bundle this file lives at <skill>/scripts/kimball.mjs, so the UI is at <skill>/ui/index.html.
const uiPath = fileURLToPath(new URL('../ui/index.html', import.meta.url));

function openUrl(url: string) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {
    // Opening a browser is best effort; the URL is printed anyway.
  }
}

runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  loadUi: () => readUiOrPlaceholder(uiPath),
  openUrl,
  waitForExit: () =>
    new Promise((done) => {
      process.once('SIGINT', () => done());
      process.once('SIGTERM', () => done());
    }),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`Unexpected error: ${(e as Error).stack ?? e}\n`);
    process.exitCode = 1;
  },
);
