import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_MTIME_HEADER, startServer, type RunningServer } from './server';
import { createProject, serializeProject } from '../core';

let dir: string;
let file: string;
let server: RunningServer;
const base = () => server.url.replace(/\/$/, '');

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kd-serve-'));
  file = join(dir, 'p.kimball.json');
  server = await startServer({ file, port: 0, uiHtml: '<!doctype html><title>Kimball UI</title>' });
});
afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Raw request so tests can forge Host/Origin headers (fetch forbids that). */
function raw(path: string, headers: Record<string, string>, method = 'GET', body?: string) {
  return new Promise<{ status: number; body: string }>((ok, fail) => {
    const req = request({ host: '127.0.0.1', port: server.port, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', fail);
    if (body) req.write(body);
    req.end();
  });
}

const put = (project: unknown, extra: Record<string, string> = {}) =>
  fetch(`${base()}/api/project`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(project),
  });

describe('kimball serve, review fixes', () => {
  it('answers an oversized PUT with 413 instead of resetting the connection', async () => {
    const big = JSON.stringify({ ...createProject('Big'), padding: 'x'.repeat(6 * 1024 * 1024) });
    const res = await raw('/api/project', { Host: `127.0.0.1:${server.port}`, 'Content-Type': 'application/json' }, 'PUT', big);
    expect(res.status).toBe(413);
  });

  it('accepts a Content-Type in any case', async () => {
    const res = await put(createProject('Case'), { 'Content-Type': 'Application/JSON' });
    expect(res.status).toBe(200);
  });

  it('returns 422 for a file that is JSON but not a project', async () => {
    writeFileSync(file, JSON.stringify({ schemaVersion: '2.0' }));
    const res = await fetch(`${base()}/api/project`);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain('schemaVersion');
  });
});

describe('kimball serve', () => {
  it('serves the UI and health info', async () => {
    const html = await fetch(server.url);
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(await html.text()).toContain('Kimball UI');
    const health = await (await fetch(`${base()}/api/health`)).json();
    expect(health).toMatchObject({ ok: true, app: 'kimball-designer', fileName: 'p.kimball.json' });
  });

  it('reports a missing file, then creates it on PUT', async () => {
    expect((await fetch(`${base()}/api/project`)).status).toBe(404);
    expect(await (await fetch(`${base()}/api/project/meta`)).json()).toEqual({ exists: false, mtimeMs: null });

    const res = await put(createProject('Live'));
    expect(res.status).toBe(200);
    const { mtimeMs } = await res.json();
    expect(mtimeMs).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).meta.name).toBe('Live');

    const got = await fetch(`${base()}/api/project`);
    expect(got.headers.get('x-kimball-mtime')).toBe(String(mtimeMs));
    expect((await got.json()).meta.name).toBe('Live');
  });

  it('normalises what it writes', async () => {
    await put({ meta: { name: 'Sloppy' }, processes: [{ name: 'Sales', dimensions: ['dm_date'] }] });
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.schemaVersion).toBe('1.0');
    expect(saved.processes[0].dimensions).toEqual([{ dimensionId: 'dm_date', roles: [] }]);
  });

  it('detects conflicting edits made on disk', async () => {
    const first = await (await put(createProject('A'))).json();
    await new Promise((r) => setTimeout(r, 20));
    writeFileSync(file, serializeProject(createProject('Edited by Claude')));
    const res = await put(createProject('B'), { [BASE_MTIME_HEADER]: String(first.mtimeMs) });
    expect(res.status).toBe(409);
    expect(JSON.parse(readFileSync(file, 'utf8')).meta.name).toBe('Edited by Claude');
  });

  it('reports a half-written file as 422 instead of failing', async () => {
    writeFileSync(file, '{ "meta": ');
    expect((await fetch(`${base()}/api/project`)).status).toBe(422);
  });

  it('rejects bad payloads', async () => {
    expect((await put([1, 2])).status).toBe(400);
    expect((await put({ schemaVersion: '9.0' })).status).toBe(400);
    const text = await fetch(`${base()}/api/project`, { method: 'PUT', body: '{}', headers: { 'Content-Type': 'text/plain' } });
    expect(text.status).toBe(415);
    expect((await fetch(`${base()}/nope`)).status).toBe(404);
  });

  it('blocks DNS rebinding and cross-site requests', async () => {
    expect((await raw('/api/health', { Host: 'evil.example:80' })).status).toBe(403);
    expect((await raw('/api/health', { Host: `localhost:${server.port}` })).status).toBe(200);
    const cross = await raw(
      '/api/project',
      { Host: `127.0.0.1:${server.port}`, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      'PUT',
      '{}',
    );
    expect(cross.status).toBe(403);
  });
});
