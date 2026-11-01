import { useEffect, useRef, useState } from 'react';
import { CoachPanel } from './components/CoachPanel';
import { DemoBar } from './components/DemoBar';
import { Header } from './components/Header';
import { HelpPage } from './components/HelpPage';
import { Stepper } from './components/Stepper';
import { Toasts } from './components/Toasts';
import { Welcome } from './components/Welcome';
import { PHASE_COMPONENTS } from './phases';
import { useDemo } from './store/demo';
import { useHelpRoute, usePhase } from './store/routing';
import { store, useStore } from './store/store';

const COACH_KEY = 'kd.coach';

function readCoachPref(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) !== 'closed';
  } catch {
    return true;
  }
}

export function App() {
  const started = useStore((s) => s.started);
  const phase = usePhase();
  const help = useHelpRoute();
  const demoActive = useDemo() !== null;
  const [coachOpen, setCoachOpen] = useState(() => readCoachPref() && window.innerWidth > 1180);

  // Remember where the user is so Claude (via the project file) knows which phase they're on.
  useEffect(() => {
    if (started && help === undefined && store.getState().project.meta.currentPhase !== phase) {
      store.update((d) => void (d.meta.currentPhase = phase), { history: false });
    }
  }, [phase, started, help]);

  const firstPhase = useRef(true);
  useEffect(() => {
    const main = document.getElementById('kd-main');
    const focusedInside = !!main?.contains(document.activeElement) && document.activeElement !== main;
    if (!focusedInside) main?.scrollTo({ top: 0 });
    // Move focus to the new phase so keyboard and screen-reader users aren't left on a removed button.
    if (firstPhase.current) firstPhase.current = false;
    else if (!main?.contains(document.activeElement) || document.activeElement === document.body) main?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Text fields have their own undo; checkboxes, selects and buttons use the project's.
      const textEntry = target.closest('textarea, [contenteditable="true"], input');
      if (textEntry && !(textEntry instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(textEntry.type))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCoach = () =>
    setCoachOpen((open) => {
      try {
        localStorage.setItem(COACH_KEY, open ? 'closed' : 'open');
      } catch {
        // ignore
      }
      return !open;
    });

  if (help !== undefined || !started) {
    return (
      <>
        {help !== undefined ? <HelpPage section={help} /> : <Welcome />}
        <Toasts />
      </>
    );
  }

  const Phase = PHASE_COMPONENTS[phase];
  return (
    <div className={`app ${coachOpen ? '' : 'coach-collapsed'}${demoActive ? ' demo-active' : ''}`}>
      <Header onToggleCoach={toggleCoach} coachOpen={coachOpen} />
      <Stepper current={phase} />
      <main className="app-main" id="kd-main" tabIndex={-1}>
        <Phase />
        <DemoBar phase={phase} />
      </main>
      {coachOpen && <CoachPanel phase={phase} onClose={toggleCoach} />}
      <Toasts />
    </div>
  );
}
