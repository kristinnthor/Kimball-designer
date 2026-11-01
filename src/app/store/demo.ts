import { useSyncExternalStore } from 'react';
import { HELP_DEMOS, type HelpDemo } from '../../core';
import { newProject, startFromExample } from '../actions';
import { goToPhase } from './routing';
import { store } from './store';
import { pushToast } from './toasts';

/**
 * The running guided demo, if any. Kept in sessionStorage so a reload
 * mid-demo resumes at the same step.
 */
export interface DemoState {
  id: string;
  step: number;
}

const KEY = 'kd.demo';
let state: DemoState | null = readSaved();
const listeners = new Set<() => void>();

function readSaved(): DemoState | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as DemoState | null;
    return saved && HELP_DEMOS.some((d) => d.id === saved.id) ? saved : null;
  } catch {
    return null;
  }
}

function set(next: DemoState | null) {
  state = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore: the demo still works for this page view
  }
  listeners.forEach((l) => l());
}

export function useDemo(): DemoState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function demoDef(id: string): HelpDemo | undefined {
  return HELP_DEMOS.find((d) => d.id === id);
}

/** Sets up the demo's project and shows its first step. Returns false if the user cancelled. */
export function startDemo(id: string, serverMode: boolean): boolean {
  const demo = demoDef(id);
  if (!demo || demo.setup.kind === 'none') return false;
  const { setup } = demo;
  let ready = true;
  if (setup.kind === 'blank') ready = newProject(setup.name, serverMode);
  else if (setup.kind === 'example') ready = startFromExample(setup.example, serverMode, false);
  else if (!store.getState().started) ready = startFromExample(setup.example, serverMode, false);
  if (!ready) return false;
  showStep(demo, 0);
  return true;
}

export function goToStep(step: number) {
  const demo = state && demoDef(state.id);
  if (demo && step >= 0 && step < demo.steps.length) showStep(demo, step);
}

function showStep(demo: HelpDemo, step: number) {
  set({ id: demo.id, step });
  const phase = demo.steps[step]!.phase;
  if (phase) goToPhase(phase);
}

export function exitDemo(finished = false) {
  const demo = state && demoDef(state.id);
  set(null);
  if (finished && demo) pushToast(`Demo complete: ${demo.title}. Help has more demos whenever you want them.`, 'success');
}
