import { useSyncExternalStore } from 'react';
import { PHASE_IDS, type PhaseId } from '../../core';

/** Hash routes (`#/grain`, `#/help/demos`) so the single-file build works from file:// too. */
function parts(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split(/[/?]/);
}

function read(): PhaseId {
  const id = parts()[0] as PhaseId;
  return PHASE_IDS.includes(id) ? id : 'kickoff';
}

/** `undefined` when Help is closed, `null` for the top of Help, otherwise the section id. */
function readHelp(): string | null | undefined {
  const [first, section] = parts();
  if (first !== 'help') return undefined;
  return section || null;
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function usePhase(): PhaseId {
  return useSyncExternalStore(subscribe, read);
}

export function useHelpRoute(): string | null | undefined {
  return useSyncExternalStore(subscribe, readHelp);
}

export function goToPhase(id: PhaseId) {
  if (read() !== id || !window.location.hash || readHelp() !== undefined) window.location.hash = `/${id}`;
  document.getElementById('kd-main')?.scrollTo({ top: 0 });
}

export function currentPhase(): PhaseId {
  return read();
}

export function isHelpOpen(): boolean {
  return readHelp() !== undefined;
}

export function helpHref(section?: string): string {
  return section ? `#/help/${section}` : '#/help';
}
