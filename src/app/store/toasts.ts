import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushToast(message: string, tone: Toast['tone'] = 'info', action?: Toast['action'], ttl = 5000) {
  const toast = { id: nextId++, message, tone, action };
  toasts = [...toasts, toast].slice(-4);
  emit();
  if (ttl > 0) setTimeout(() => dismissToast(toast.id), ttl);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
}
