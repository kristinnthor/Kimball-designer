import {
  createProject,
  displayName,
  loadExample,
  serializeProject,
  slugify,
  type ExampleInfo,
  type KimballProject,
} from '../core';
import { downloadText, pickProjectFile } from './lib/files';
import { goToPhase } from './store/routing';
import { store } from './store/store';
import { pushToast } from './store/toasts';
import { clearLocalProject } from './store/sync';

/** In server mode, replacing the project overwrites the file on disk — confirm first. */
function confirmReplace(serverMode: boolean): boolean {
  if (!serverMode && !store.getState().started) return true;
  const what = serverMode ? 'the project file on disk' : 'the project in this browser';
  return window.confirm(`This replaces ${what}. Export it first if you want to keep it. Continue?`);
}

function start(project: KimballProject) {
  store.replace(project, { resetHistory: true });
  goToPhase(project.meta.currentPhase);
}

/** Returns false if the user cancelled. */
export function newProject(name: string, serverMode: boolean): boolean {
  if (!confirmReplace(serverMode)) return false;
  start(createProject(name.trim()));
  return true;
}

/** Returns false if the user cancelled. */
export function startFromExample(id: ExampleInfo['id'], serverMode: boolean, announce = true): boolean {
  if (!confirmReplace(serverMode)) return false;
  const project = loadExample(id, new Date().toISOString());
  start({ ...project, meta: { ...project.meta, currentPhase: 'kickoff' } });
  if (announce) pushToast(`Loaded the "${displayName(project.meta)}" example. Explore it, then adapt or start fresh.`, 'success');
  return true;
}

export async function openProjectFile(serverMode: boolean) {
  try {
    const project = await pickProjectFile();
    if (!project || !confirmReplace(serverMode)) return;
    start(project);
    pushToast(`Opened "${displayName(project.meta, 'Untitled project')}".`, 'success');
  } catch (e) {
    pushToast((e as Error).message, 'error');
  }
}

/**
 * Applies a structural removal and offers Undo in a toast. Undo only applies while
 * nothing else has changed since, so it never reverts a different edit.
 */
export function removeWithUndo(what: string, recipe: Parameters<typeof store.update>[0]) {
  store.update(recipe);
  const after = store.getState().project;
  pushToast(`Removed ${what}.`, 'info', {
    label: 'Undo',
    run: () => {
      if (store.getState().project === after) store.undo();
      else pushToast('Other changes were made since. Use Undo (Ctrl+Z) step by step instead.', 'warning');
    },
  });
}

export function exportProjectJson() {
  const project = store.getState().project;
  downloadText(`${slugify(project.meta.name, 'project')}.kimball.json`, serializeProject(project), 'application/json');
}

export function closeProject() {
  if (!window.confirm('Close this project? It is removed from this browser. Export it first if you want to keep a copy.')) {
    return;
  }
  clearLocalProject();
  store.reset();
  window.location.hash = '';
}
