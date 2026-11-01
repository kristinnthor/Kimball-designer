import { useEffect, useSyncExternalStore } from 'react';
import type { ThemeName } from '../../core';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'kd.theme';
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref: ThemePref = readPref();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply() {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // preference simply won't persist
  }
  apply();
  listeners.forEach((l) => l());
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pref,
  );
}

/** The theme actually in effect, for SVG rendering. */
export function useResolvedTheme(): ThemeName {
  const p = useThemePref();
  const systemDark = useSyncExternalStore(
    (l) => {
      media?.addEventListener('change', l);
      return () => media?.removeEventListener('change', l);
    },
    () => media?.matches ?? false,
  );
  useEffect(apply, [p]);
  return p === 'system' ? (systemDark ? 'dark' : 'light') : p;
}

apply();
