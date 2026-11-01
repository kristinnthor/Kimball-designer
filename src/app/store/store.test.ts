import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core';
import { store } from './store';

describe('store', () => {
  beforeEach(() => store.replace(createProject('Start'), { resetHistory: true }));

  it('applies updates, stamps updatedAt and supports undo/redo', () => {
    const before = store.getState().project;
    store.update((d) => void (d.meta.name = 'Changed'));
    const after = store.getState().project;
    expect(after.meta.name).toBe('Changed');
    expect(after.meta.updatedAt >= before.meta.updatedAt).toBe(true);
    store.undo();
    expect(store.getState().project.meta.name).toBe('Start');
    store.redo();
    expect(store.getState().project.meta.name).toBe('Changed');
  });

  it('ignores no-op updates', () => {
    const before = store.getState();
    store.update(() => {});
    expect(store.getState()).toBe(before);
  });

  it('coalesces typing into one undo step', () => {
    for (const name of ['R', 'Re', 'Ret', 'Reta', 'Retail']) store.update((d) => void (d.meta.name = name), { coalesce: 'name' });
    expect(store.getState().past).toHaveLength(1);
    store.undo();
    expect(store.getState().project.meta.name).toBe('Start');
  });

  it('can skip history for bookkeeping updates', () => {
    store.update((d) => void (d.meta.currentPhase = 'grain'), { history: false });
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().project.meta.currentPhase).toBe('grain');
  });

  it('marks the project started on replace and clears it on reset', () => {
    expect(store.getState().started).toBe(true);
    store.reset();
    expect(store.getState().started).toBe(false);
  });
});
