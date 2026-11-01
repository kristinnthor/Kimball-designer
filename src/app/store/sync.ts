import { useSyncExternalStore } from 'react';
import { normalizeProject, serializeProject, type KimballProject } from '../../core';
import { store } from './store';
import { pushToast } from './toasts';
import { currentPhase, goToPhase } from './routing';

/**
 * Persistence. Two modes:
 * - `local`: the UI was opened as a file or hosted page; the project autosaves to localStorage.
 * - `server`: the UI is served by `kimball serve`; the project file on disk is the source of truth,
 *   saved on change and polled for edits made elsewhere (for example by Claude).
 */
export type SyncMode = 'local' | 'server';
export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface SyncStatus {
  mode: SyncMode;
  state: SyncState;
  fileName: string | null;
  filePath: string | null;
  message: string | null;
}

const LOCAL_KEY = 'kd.project.v1';
const SAVE_DELAY_LOCAL = 400;
const SAVE_DELAY_SERVER = 600;
const POLL_MS = 2000;

let status: SyncStatus = { mode: 'local', state: 'idle', fileName: null, filePath: null, message: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// ─── Local storage ───

export function loadLocalProject(): KimballProject | null {
  try {
    const text = localStorage.getItem(LOCAL_KEY);
    return text ? normalizeProject(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

function saveLocal(project: KimballProject) {
  try {
    localStorage.setItem(LOCAL_KEY, serializeProject(project));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalProject() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
}

// ─── Server (kimball serve) ───

const api = (path: string) => new URL(`api/${path}`, window.location.href).toString();
let baseMtime: number | null = null;
let lastSynced = '';
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;

async function fetchRemote(): Promise<{ project: KimballProject; mtime: number | null } | { status: number; error: string }> {
  const res = await fetch(api('project'), { cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { status: res.status, error: body.error ?? res.statusText };
  }
  const mtime = Number(res.headers.get('x-kimball-mtime'));
  return { project: normalizeProject(await res.json()), mtime: Number.isFinite(mtime) ? mtime : null };
}

function applyRemote(project: KimballProject, mtime: number | null, announce: boolean) {
  const previousPhase = store.getState().project.meta.currentPhase;
  lastSynced = serializeProject(project);
  baseMtime = mtime;
  store.replace(project, { resetHistory: !announce });
  setStatus({ state: 'saved', message: null });
  if (announce) {
    pushToast(`Updated from ${status.fileName ?? 'the project file'} — it was edited outside the browser.`, 'info');
    if (project.meta.currentPhase !== previousPhase && project.meta.currentPhase !== currentPhase()) {
      goToPhase(project.meta.currentPhase);
    }
  }
}

async function putRemote(project: KimballProject, force = false) {
  const text = serializeProject(project);
  inFlight = true;
  setStatus({ state: 'saving' });
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!force && baseMtime != null) headers['x-kimball-base-mtime'] = String(baseMtime);
    const res = await fetch(api('project'), { method: 'PUT', headers, body: text });
    const body = (await res.json().catch(() => ({}))) as { mtimeMs?: number; error?: string };
    if (res.status === 409) {
      setStatus({ state: 'conflict', message: 'The file changed on disk while you were editing.' });
      return;
    }
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    baseMtime = body.mtimeMs ?? null;
    lastSynced = text;
    setStatus({ state: 'saved', message: null });
  } catch (e) {
    saveLocal(project);
    setStatus({ state: 'error', message: `Couldn't save to the file (${(e as Error).message}). A copy is kept in this browser.` });
  } finally {
    inFlight = false;
  }
}

async function poll() {
  if (inFlight || status.state === 'conflict') return;
  try {
    const res = await fetch(api('project/meta'), { cache: 'no-store' });
    const meta = (await res.json()) as { exists: boolean; mtimeMs: number | null };
    if (status.state === 'error') setStatus({ state: 'saved', message: null });
    if (!meta.exists) {
      // File deleted or renamed outside; write ours back.
      baseMtime = null;
      void putRemote(store.getState().project, true);
      return;
    }
    if (meta.mtimeMs == null || baseMtime == null || Math.abs(meta.mtimeMs - baseMtime) <= 1) return;
    const dirty = serializeProject(store.getState().project) !== lastSynced;
    if (dirty) {
      setStatus({ state: 'conflict', message: 'The file was edited outside the browser while you had unsaved changes.' });
      return;
    }
    const remote = await fetchRemote();
    if ('project' in remote) applyRemote(remote.project, remote.mtime, true);
  } catch {
    setStatus({ state: 'error', message: "Can't reach kimball serve. Your changes are kept in this browser." });
  }
}

/** Resolve a conflict by loading the version on disk. */
export async function keepDiskVersion() {
  const remote = await fetchRemote();
  if ('project' in remote) applyRemote(remote.project, remote.mtime, true);
}

/** Resolve a conflict by overwriting the file with the browser's version. */
export async function keepBrowserVersion() {
  await putRemote(store.getState().project, true);
}

// ─── Boot ───

/**
 * Detects `kimball serve`, loads the project and starts autosaving.
 * Resolves to the mode so the app knows whether to show the welcome screen.
 */
export async function startSync(): Promise<SyncMode> {
  type Health = { app?: string; file?: string; fileName?: string };
  let health: Health | null = null;
  if (window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch(api('health'), { cache: 'no-store' });
      if (res.ok) health = (await res.json()) as Health;
    } catch {
      health = null;
    }
  }

  if (health?.app === 'kimball-designer') {
    setStatus({ mode: 'server', state: 'idle', fileName: health.fileName ?? null, filePath: health.file ?? null });
    const remote = await fetchRemote();
    if ('project' in remote) {
      applyRemote(remote.project, remote.mtime, false);
    } else if (remote.status === 404) {
      store.replace(store.getState().project, { resetHistory: true });
      await putRemote(store.getState().project, true);
    } else {
      store.replace(loadLocalProject() ?? store.getState().project, { resetHistory: true });
      setStatus({ state: 'error', message: remote.error });
    }
    if (status.mode === 'server' && store.getState().project.meta.currentPhase && !window.location.hash) {
      goToPhase(store.getState().project.meta.currentPhase);
    }
    store.subscribe(() => {
      if (!store.getState().started) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const project = store.getState().project;
        if (serializeProject(project) !== lastSynced && status.state !== 'conflict') void putRemote(project);
      }, SAVE_DELAY_SERVER);
    });
    setInterval(() => void poll(), POLL_MS);
    return 'server';
  }

  setStatus({ mode: 'local', state: 'idle' });
  const saved = loadLocalProject();
  if (saved) store.replace(saved, { resetHistory: true });
  store.subscribe(() => {
    if (!store.getState().started) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = saveLocal(store.getState().project);
      setStatus(ok ? { state: 'saved', message: null } : { state: 'error', message: 'Browser storage is unavailable — export your project to keep it.' });
    }, SAVE_DELAY_LOCAL);
  });
  return 'local';
}
