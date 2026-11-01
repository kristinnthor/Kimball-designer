import { useSyncExternalStore } from 'react';
import { produce, type Draft } from 'immer';
import { createProject, type KimballProject } from '../../core';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;

interface State {
  project: KimballProject;
  past: KimballProject[];
  future: KimballProject[];
  /** False until the user creates, opens or resumes a project (shows the welcome screen). */
  started: boolean;
}

type Listener = () => void;

let state: State = { project: createProject(), past: [], future: [], started: false };
const listeners = new Set<Listener>();
let lastCoalesce: { key: string; at: number } | null = null;

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

export interface UpdateOptions {
  /** Consecutive updates with the same key within ~1 s share one undo step (typing). */
  coalesce?: string;
  /** Don't record an undo step (e.g. navigation bookkeeping). */
  history?: boolean;
}

export const store = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Applies an immer recipe to the project and bumps `meta.updatedAt`. */
  update(recipe: (draft: Draft<KimballProject>) => void, options: UpdateOptions = {}) {
    const next = produce(state.project, (d) => {
      recipe(d);
    });
    if (next === state.project) return;
    const stamped = produce(next, (d) => {
      d.meta.updatedAt = new Date().toISOString();
    });
    if (options.history === false) {
      set({ ...state, project: stamped });
      return;
    }
    const now = Date.now();
    const coalesce = options.coalesce && lastCoalesce?.key === options.coalesce && now - lastCoalesce.at < COALESCE_MS;
    lastCoalesce = options.coalesce ? { key: options.coalesce, at: now } : null;
    set({
      ...state,
      project: stamped,
      past: coalesce ? state.past : [...state.past, state.project].slice(-HISTORY_LIMIT),
      future: [],
    });
  },

  /** Replaces the whole project (open file, load example, remote update). */
  replace(project: KimballProject, options: { resetHistory?: boolean } = {}) {
    lastCoalesce = null;
    set({
      project,
      past: options.resetHistory ? [] : [...state.past, state.project].slice(-HISTORY_LIMIT),
      // Redo after a replacement would jump back over it (and wipe an edit made by Claude).
      future: [],
      started: true,
    });
  },

  undo() {
    const prev = state.past[state.past.length - 1];
    if (!prev) return;
    lastCoalesce = null;
    set({ ...state, project: prev, past: state.past.slice(0, -1), future: [state.project, ...state.future] });
  },

  redo() {
    const [next, ...rest] = state.future;
    if (!next) return;
    lastCoalesce = null;
    set({ ...state, project: next, past: [...state.past, state.project], future: rest });
  },

  /** Back to the welcome screen. */
  reset() {
    lastCoalesce = null;
    set({ project: createProject(), past: [], future: [], started: false });
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}

export const useProject = () => useStore((s) => s.project);
export const update = store.update;
