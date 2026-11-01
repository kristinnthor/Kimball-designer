import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { APP_VERSION, normalizeProject, ProjectParseError, serializeProject } from '../core';
import { mtimeMs, writeFileAtomic } from './io';

export const DEFAULT_PORT = 4178;
const MAX_BODY = 5 * 1024 * 1024;

export interface ServeOptions {
  /** Project file the UI edits. Created on first save if it doesn't exist. */
  file: string;
  /** The single-file UI to serve at `/`. */
  uiHtml: string;
  port?: number;
  host?: string;
  log?: (message: string) => void;
}

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Header the UI sends with PUT: the file mtime its edits are based on. A newer file on disk means a conflict. */
export const BASE_MTIME_HEADER = 'x-kimball-base-mtime';

/**
 * Serves the guided UI and a tiny JSON API over one project file, bound to
 * localhost only. Host and Origin are checked to defeat DNS rebinding and
 * cross-site requests.
 */
export function startServer(options: ServeOptions): Promise<RunningServer> {
  const file = resolve(options.file);
  const host = options.host ?? '127.0.0.1';
  const log = options.log ?? (() => {});
  let port = options.port ?? DEFAULT_PORT;

  // Browsers omit the default port from Host and Origin, so port 80 also allows the bare names.
  const allowedHosts = () =>
    new Set(['127.0.0.1', 'localhost', '[::1]'].flatMap((h) => (port === 80 ? [`${h}:${port}`, h] : [`${h}:${port}`])));
  const allowedOrigins = () => new Set([...allowedHosts()].map((h) => `http://${h}`));

  const send = (res: ServerResponse, status: number, body: string, type = 'application/json; charset=utf-8', extra: Record<string, string> = {}) => {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extra,
    });
    res.end(body);
  };
  const json = (res: ServerResponse, status: number, data: unknown, extra?: Record<string, string>) =>
    send(res, status, JSON.stringify(data), undefined, extra);

  /** Reads the body; resolves null when it is over the limit (the rest is drained so the 413 reaches the client). */
  const readBody = (req: IncomingMessage) =>
    new Promise<string | null>((ok, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= MAX_BODY) chunks.push(c);
      });
      req.on('end', () => ok(size > MAX_BODY ? null : Buffer.concat(chunks).toString('utf8')));
      req.on('error', fail);
    });

  /** Reads the file and its mtime consistently: retries if the file changed during the read. */
  const readConsistent = async () => {
    for (let attempt = 0; ; attempt++) {
      const before = await mtimeMs(file);
      const text = await readFile(file, 'utf8');
      const after = await mtimeMs(file);
      if (before === after || attempt >= 4) return { text, mtime: after };
    }
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!allowedHosts().has(req.headers.host ?? '')) return json(res, 403, { error: 'Forbidden host' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins().has(origin)) return json(res, 403, { error: 'Forbidden origin' });

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const route = `${req.method} ${url.pathname}`;

    switch (route) {
      case 'GET /':
      case 'GET /index.html':
        return send(res, 200, options.uiHtml, 'text/html; charset=utf-8');

      case 'GET /api/health':
        return json(res, 200, { ok: true, app: 'kimball-designer', version: APP_VERSION, file, fileName: basename(file) });

      case 'GET /api/project/meta': {
        const m = await mtimeMs(file);
        return json(res, 200, { exists: m !== null, mtimeMs: m });
      }

      case 'GET /api/project': {
        if (!existsSync(file)) return json(res, 404, { error: 'Project file does not exist yet', file });
        const { text, mtime: m } = await readConsistent();
        try {
          // Not just JSON: the UI can only load something that normalises to a project.
          normalizeProject(JSON.parse(text.replace(/^﻿/, '')));
        } catch (e) {
          // Typically a half-written edit; the UI keeps its copy and retries.
          const reason = e instanceof ProjectParseError ? e.message : `Project file is not valid JSON: ${(e as Error).message}`;
          return json(res, 422, { error: reason, mtimeMs: m });
        }
        return send(res, 200, text, undefined, { 'X-Kimball-Mtime': String(m) });
      }

      case 'PUT /api/project': {
        if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          return json(res, 415, { error: 'Content-Type must be application/json' });
        }
        const body = await readBody(req);
        if (body === null) return json(res, 413, { error: 'Project is larger than 5 MB' });
        const base = Number(req.headers[BASE_MTIME_HEADER]);
        const current = await mtimeMs(file);
        if (current !== null && Number.isFinite(base) && base > 0 && Math.abs(current - base) > 1) {
          return json(res, 409, { error: 'The file changed on disk since it was loaded', mtimeMs: current });
        }
        let text: string;
        try {
          text = serializeProject(normalizeProject(JSON.parse(body)));
        } catch (e) {
          const message = e instanceof ProjectParseError ? e.message : `Invalid JSON: ${(e as Error).message}`;
          return json(res, 400, { error: message });
        }
        await writeFileAtomic(file, text);
        const m = await mtimeMs(file);
        log(`saved ${basename(file)}`);
        return json(res, 200, { ok: true, mtimeMs: m });
      }

      default:
        return json(res, 404, { error: 'Not found' });
    }
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((e) => {
      log(`error: ${(e as Error).message}`);
      if (!res.headersSent) json(res, 500, { error: 'Internal error' });
    });
  });

  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      const address = server.address();
      if (address && typeof address === 'object') port = address.port;
      ok({
        url: `http://${host === '::1' ? '[::1]' : host}:${port}/`,
        port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}
