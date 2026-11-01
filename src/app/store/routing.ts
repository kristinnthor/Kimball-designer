import { useSyncExternalStore } from 'react';
import { PHASE_IDS, type PhaseId } from '../../core';

/** Hash routes (`#/grain`) so the single-file build works from file:// too. */
function read(): PhaseId {
  const id = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] as PhaseId;
  return PHASE_IDS.includes(id) ? id : 'kickoff';
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function usePhase(): PhaseId {
  return useSyncExternalStore(subscribe, read);
}

export function goToPhase(id: PhaseId) {
  if (read() !== id || !window.location.hash) window.location.hash = `/${id}`;
  document.getElementById('kd-main')?.scrollTo({ top: 0 });
}

export function currentPhase(): PhaseId {
  return read();
}
