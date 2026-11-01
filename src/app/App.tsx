import { useEffect, useState } from 'react';
import { CoachPanel } from './components/CoachPanel';
import { Header } from './components/Header';
import { Stepper } from './components/Stepper';
import { Toasts } from './components/Toasts';
import { Welcome } from './components/Welcome';
import { PHASE_COMPONENTS } from './phases';
import { usePhase } from './store/routing';
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
  const [coachOpen, setCoachOpen] = useState(() => readCoachPref() && window.innerWidth > 1180);

  // Remember where the user is so Claude (via the project file) knows which phase they're on.
  useEffect(() => {
    if (started && store.getState().project.meta.currentPhase !== phase) {
      store.update((d) => void (d.meta.currentPhase = phase), { history: false });
    }
  }, [phase, started]);

  useEffect(() => {
    document.getElementById('kd-main')?.scrollTo({ top: 0 });
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
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

  if (!started) {
    return (
      <>
        <Welcome />
        <Toasts />
      </>
    );
  }

  const Phase = PHASE_COMPONENTS[phase];
  return (
    <div className={`app ${coachOpen ? '' : 'coach-collapsed'}`}>
      <Header onToggleCoach={toggleCoach} coachOpen={coachOpen} />
      <Stepper current={phase} />
      <main className="app-main" id="kd-main" tabIndex={-1}>
        <Phase />
      </main>
      {coachOpen && <CoachPanel phase={phase} onClose={toggleCoach} />}
      <Toasts />
    </div>
  );
}
