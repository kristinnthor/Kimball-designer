import { useSyncExternalStore } from 'react';
import { normalizeProject, serializeProject, type KimballProject } from '../../core';
import { store } from './store';
import { pushToast } from './toasts';
import { currentPhase, goToPhase, isHelpOpen } from './routing';

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
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

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
/** A save was requested while another was in flight; run it when that one finishes. */
let saveAgain = false;
/** False until the file has been read once; saving before that could overwrite edits made elsewhere. */
let loaded = false;

const isDirty = () => serializeProject(store.getState().project) !== lastSynced;

async function fetchRemote(): Promise<{ project: KimballProject; mtime: number | null } | { status: number; error: string }> {
  try {
    const res = await fetch(api('project'), { cache: 'no-store' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { status: res.status, error: body.error ?? res.statusText };
    }
    const mtime = Number(res.headers.get('x-kimball-mtime'));
    return { project: normalizeProject(await res.json()), mtime: Number.isFinite(mtime) ? mtime : null };
  } catch (e) {
    // Network failure, or a file that is JSON but not a project.
    return { status: 0, error: (e as Error).message };
  }
}

function applyRemote(project: KimballProject, mtime: number | null, announce: boolean) {
  const previousPhase = store.getState().project.meta.currentPhase;
  loaded = true;
  lastSynced = serializeProject(project);
  baseMtime = mtime;
  store.replace(project, { resetHistory: !announce });
  setStatus({ state: 'saved', message: null });
  if (announce) {
    pushToast(`Updated from ${status.fileName ?? 'the project file'} — it was edited outside the browser.`, 'info');
    // Follow Claude to its phase, but don't pull the user out of Help.
    if (project.meta.currentPhase !== previousPhase && project.meta.currentPhase !== currentPhase() && !isHelpOpen()) {
      goToPhase(project.meta.currentPhase);
    }
  }
}

async function putRemote(project: KimballProject, force = false) {
  if (inFlight) {
    saveAgain = true;
    return;
  }
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
    loaded = true;
    setStatus({ state: 'saved', message: null });
  } catch (e) {
    saveLocal(project);
    setStatus({ state: 'error', message: `Couldn't save to the file (${(e as Error).message}). A copy is kept in this browser; saving is retried.` });
  } finally {
    inFlight = false;
    if (saveAgain) {
      saveAgain = false;
      if (isDirty() && status.state !== 'conflict') void putRemote(store.getState().project);
    }
  }
}

async function poll() {
  if (inFlight || status.state === 'conflict') return;
  if (!loaded) {
    // The first read failed (half-written or invalid file): keep trying, and don't save over it.
    const remote = await fetchRemote();
    if ('project' in remote) applyRemote(remote.project, remote.mtime, false);
    else if (remote.status === 404) await putRemote(store.getState().project, true);
    else setStatus({ state: 'error', message: `Can't read the project file: ${remote.error}. Fix the file; the browser retries and won't save until it can read it.` });
    return;
  }
  try {
    const res = await fetch(api('project/meta'), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    const meta = (await res.json()) as { exists: boolean; mtimeMs: number | null };
    if (!meta.exists) {
      // File deleted or renamed outside; write ours back.
      baseMtime = null;
      void putRemote(store.getState().project, true);
      return;
    }
    if (status.state === 'error') {
      // Reachable again: retry the save that failed instead of claiming it is saved.
      if (isDirty()) void putRemote(store.getState().project);
      else setStatus({ state: 'saved', message: null });
      return;
    }
    if (meta.mtimeMs == null || baseMtime == null || Math.abs(meta.mtimeMs - baseMtime) <= 1) return;
    if (isDirty()) {
      setStatus({ state: 'conflict', message: 'The file was edited outside the browser while you had unsaved changes.' });
      return;
    }
    const remote = await fetchRemote();
    if (!('project' in remote)) return;
    // The user may have typed, or a save may have started, while the file was loading.
    if (inFlight || isDirty()) {
      setStatus({ state: 'conflict', message: 'The file was edited outside the browser while you had unsaved changes.' });
      return;
    }
    applyRemote(remote.project, remote.mtime, true);
  } catch {
    setStatus({ state: 'error', message: "Can't reach kimball serve. Your changes are kept in this browser." });
  }
}

/** Resolve a conflict by loading the version on disk. */
export async function keepDiskVersion() {
  const remote = await fetchRemote();
  if ('project' in remote) applyRemote(remote.project, remote.mtime, true);
  else setStatus({ state: 'conflict', message: `Couldn't load the file version (${remote.error}).` });
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
  // `kimball serve` only listens on loopback, so the hosted site and file:// skip the probe.
  if (window.location.protocol.startsWith('http') && LOOPBACK_HOSTS.has(window.location.hostname)) {
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
      // Don't fall back to a browser copy that may belong to another file; show the problem and keep retrying.
      store.replace(store.getState().project, { resetHistory: true });
      setStatus({ state: 'error', message: `Can't read the project file: ${remote.error}. Fix the file; the browser retries and won't save until it can read it.` });
    }
    if (status.mode === 'server' && store.getState().project.meta.currentPhase && !window.location.hash) {
      goToPhase(store.getState().project.meta.currentPhase);
    }
    store.subscribe(() => {
      clearTimeout(saveTimer);
      if (!store.getState().started) return;
      saveTimer = setTimeout(() => {
        const project = store.getState().project;
        if (loaded && isDirty() && status.state !== 'conflict') void putRemote(project);
      }, SAVE_DELAY_SERVER);
    });
    setInterval(() => void poll(), POLL_MS);
    return 'server';
  }

  setStatus({ mode: 'local', state: 'idle' });
  const saved = loadLocalProject();
  if (saved) {
    store.replace(saved, { resetHistory: true });
    // Resume where the user left off instead of overwriting it with Kickoff.
    if (!window.location.hash) goToPhase(saved.meta.currentPhase);
  }
  store.subscribe(() => {
    clearTimeout(saveTimer);
    if (!store.getState().started) return;
    saveTimer = setTimeout(() => {
      const ok = saveLocal(store.getState().project);
      setStatus(ok ? { state: 'saved', message: null } : { state: 'error', message: 'Browser storage is unavailable — export your project to keep it.' });
    }, SAVE_DELAY_LOCAL);
  });
  return 'local';
}
