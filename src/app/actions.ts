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

export function newProject(name: string, serverMode: boolean) {
  if (!confirmReplace(serverMode)) return;
  start(createProject(name.trim()));
}

export function startFromExample(id: ExampleInfo['id'], serverMode: boolean) {
  if (!confirmReplace(serverMode)) return;
  const project = loadExample(id, new Date().toISOString());
  start({ ...project, meta: { ...project.meta, currentPhase: 'kickoff' } });
  pushToast(`Loaded the "${displayName(project.meta)}" example. Explore it, then adapt or start fresh.`, 'success');
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

export function exportProjectJson() {
  const project = store.getState().project;
  downloadText(`${slugify(project.meta.name, 'project')}.kimball.json`, serializeProject(project), 'application/json');
}

export function closeProject() {
  if (!window.confirm('Close this project? It stays in this browser only until you start another one. Export it first to keep a copy.')) {
    return;
  }
  clearLocalProject();
  store.reset();
  window.location.hash = '';
}
