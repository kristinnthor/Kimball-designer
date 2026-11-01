import { phaseDef, type PhaseId } from '../../core';
import { demoDef, exitDemo, goToStep, useDemo } from '../store/demo';
import { goToPhase } from '../store/routing';
import { useProject } from '../store/store';
import { IconArrowLeft, IconArrowRight, IconCheck, IconClose } from './icons';
import { CodeBlock, Rich } from './Rich';

/** The step-by-step guide shown at the bottom of the workspace while a demo runs. */
export function DemoBar({ phase }: { phase: PhaseId }) {
  const demo = useDemo();
  const project = useProject();
  const def = demo && demoDef(demo.id);
  if (!demo || !def) return null;

  const step = def.steps[demo.step]!;
  const total = def.steps.length;
  const last = demo.step === total - 1;
  const done = step.done?.(project) ?? false;
  const away = step.phase && step.phase !== phase;

  return (
    <section className="demo-bar" aria-label={`Demo: ${def.title}`}>
      <div className="demo-head">
        <span className="demo-kicker">Demo · {def.title}</span>
        <span className="demo-count">
          Step {demo.step + 1} of {total}
        </span>
        <button type="button" className="btn ghost icon sm" aria-label="Exit demo" title="Exit demo" onClick={() => exitDemo()}>
          <IconClose />
        </button>
      </div>
      <ol className="demo-dots" aria-hidden="true">
        {def.steps.map((s, i) => (
          <li key={s.title} className={i < demo.step ? 'past' : i === demo.step ? 'now' : ''} />
        ))}
      </ol>
      <div className="demo-step" aria-live="polite">
        <h2>
          {step.title}
          {done && (
            <span className="badge success">
              <IconCheck size={12} strokeWidth={3} /> Done
            </span>
          )}
        </h2>
        <p>
          <Rich text={step.body} />
        </p>
        {step.code && <CodeBlock code={step.code} label={step.title} />}
      </div>
      <div className="demo-actions">
        {away && (
          <button type="button" className="btn sm ghost" onClick={() => goToPhase(step.phase!)}>
            Back to {phaseDef(step.phase!).title}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn sm" aria-label="Back: previous demo step" disabled={demo.step === 0} onClick={() => goToStep(demo.step - 1)}>
          <IconArrowLeft /> Back
        </button>
        {last ? (
          <button type="button" className="btn sm primary" aria-label="Finish demo" onClick={() => exitDemo(true)}>
            Finish <IconCheck />
          </button>
        ) : (
          <button type="button" className="btn sm primary" aria-label="Next demo step" onClick={() => goToStep(demo.step + 1)}>
            Next <IconArrowRight />
          </button>
        )}
      </div>
    </section>
  );
}
