import { EXAMPLES } from '../../core';
import { closeProject, exportProjectJson, newProject, openProjectFile, startFromExample } from '../actions';
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme';
import { store, update, useProject, useStore } from '../store/store';
import { keepBrowserVersion, keepDiskVersion, useSyncStatus } from '../store/sync';
import {
  IconCoach,
  IconDownload,
  IconFile,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconPlus,
  IconRedo,
  IconSparkle,
  IconSun,
  IconUndo,
  IconUpload,
  LogoMark,
} from './icons';
import { Menu } from './ui';

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

export function Header({ onToggleCoach, coachOpen }: { onToggleCoach: () => void; coachOpen: boolean }) {
  const project = useProject();
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const sync = useSyncStatus();
  const theme = useThemePref();
  const server = sync.mode === 'server';

  const syncLabel =
    sync.state === 'saving'
      ? 'Saving…'
      : sync.state === 'conflict'
        ? 'Conflict'
        : sync.state === 'error'
          ? 'Not saved'
          : server
            ? `Synced to ${sync.fileName ?? 'file'}`
            : sync.state === 'saved'
              ? 'Saved in this browser'
              : 'Not saved yet';

  return (
    <>
      <header className="app-header">
        <a className="brand" href="#/kickoff" aria-label="Kimball Designer home">
          <LogoMark size={30} />
          <span>
            Kimball <small>Designer</small>
          </span>
        </a>
        <div className="header-project">
          <input
            aria-label="Project name"
            value={project.meta.name}
            placeholder="Untitled project"
            onChange={(e) => update((d) => void (d.meta.name = e.target.value), { coalesce: 'meta.name' })}
          />
          <span
            className={`sync ${sync.state}`}
            role="status"
            aria-live="polite"
            title={sync.message ?? (server ? sync.filePath ?? '' : 'Autosaved in this browser. Export to keep a file.')}
          >
            <span className="dot" />
            <span className="sync-label">{syncLabel}</span>
          </span>
        </div>
        <div className="header-actions">
          <button type="button" className="btn ghost icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={store.undo}>
            <IconUndo />
          </button>
          <button type="button" className="btn ghost icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={store.redo}>
            <IconRedo />
          </button>
          <Menu label="Project" icon={<IconMenu />}>
            {(close) => (
              <>
                <button role="menuitem" onClick={() => (close(), newProject('', server))}>
                  <IconPlus /> New project
                </button>
                <button role="menuitem" onClick={() => (close(), void openProjectFile(server))}>
                  <IconUpload /> Open project file…
                </button>
                <button role="menuitem" onClick={() => (close(), exportProjectJson())}>
                  <IconDownload /> Export project file (.kimball.json)
                </button>
                <hr />
                <div className="menu-label">Start from an example</div>
                {EXAMPLES.map((ex) => (
                  <button role="menuitem" key={ex.id} onClick={() => (close(), startFromExample(ex.id, server))}>
                    <IconSparkle /> {ex.title}
                  </button>
                ))}
                {!server && (
                  <>
                    <hr />
                    <button role="menuitem" onClick={() => (close(), closeProject())}>
                      <IconFile /> Close project
                    </button>
                  </>
                )}
              </>
            )}
          </Menu>
          <button
            type="button"
            className="btn ghost icon"
            aria-label={`Theme: ${theme}. Switch to ${THEME_NEXT[theme]}`}
            title={`Theme: ${theme}`}
            onClick={() => setThemePref(THEME_NEXT[theme])}
          >
            {theme === 'dark' ? <IconMoon /> : theme === 'light' ? <IconSun /> : <IconMonitor />}
          </button>
          <button
            type="button"
            className="btn ghost icon"
            aria-label={coachOpen ? 'Hide coach' : 'Show coach'}
            aria-pressed={coachOpen}
            title="Coach"
            onClick={onToggleCoach}
          >
            <IconCoach />
          </button>
        </div>
      </header>
      {sync.state === 'conflict' && (
        <div className="banner" role="alert">
          <span>{sync.message} Which version do you want to keep?</span>
          <button type="button" className="btn sm" onClick={() => void keepDiskVersion()}>
            Load the file version
          </button>
          <button type="button" className="btn sm" onClick={() => void keepBrowserVersion()}>
            Keep my browser version
          </button>
        </div>
      )}
    </>
  );
}
