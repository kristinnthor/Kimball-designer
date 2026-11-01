import { useState } from 'react';
import { EXAMPLES } from '../../core';
import { newProject, openProjectFile, startFromExample } from '../actions';
import { startDemo } from '../store/demo';
import { helpHref } from '../store/routing';
import { IconArrowRight, IconHelp, IconPlay, IconUpload, LogoMark } from './icons';

export function Welcome() {
  const [name, setName] = useState('');
  return (
    <main className="welcome">
      <div className="welcome-inner">
        <div className="welcome-hero">
          <LogoMark size={88} />
          <div>
            <h1>
              Kimball <span>Designer</span>
            </h1>
            <p>From first interview to bus matrix. A guided path through Kimball requirements gathering.</p>
            <div className="journey" aria-label="The journey">
              <span className="stage-chip discover">Discover</span>
              <span aria-hidden="true">→</span>
              <span className="stage-chip model">Model</span>
              <span aria-hidden="true">→</span>
              <span className="stage-chip deliver">Deliver</span>
            </div>
          </div>
        </div>

        <div className="welcome-actions">
          <form
            className="card accent-fact"
            onSubmit={(e) => {
              e.preventDefault();
              newProject(name, false);
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Start a new project</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              Ten short phases take you from kickoff to bubble diagrams and an enterprise bus matrix. Everything stays in
              your browser until you export it.
            </p>
            <div className="field">
              <label htmlFor="kd-new-name">Project name</label>
              <input
                id="kd-new-name"
                className="input title"
                placeholder="e.g. Retail analytics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button type="submit" className="btn primary">
                Start <IconArrowRight />
              </button>
              <button type="button" className="btn ghost" onClick={() => void openProjectFile(false)}>
                <IconUpload /> Open a .kimball.json file
              </button>
            </div>
          </form>

          <div className="card">
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Or explore an example</h2>
            <p className="hint" style={{ marginBottom: 12 }}>
              Complete projects you can browse phase by phase.
            </p>
            <div className="example-list">
              {EXAMPLES.map((ex) => (
                <button key={ex.id} type="button" className="example" onClick={() => startFromExample(ex.id, false)}>
                  <strong>{ex.title}</strong>
                  <span>{ex.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="welcome-help">
          <span>New here?</span>
          <button type="button" className="btn sm" onClick={() => void startDemo('tour', false)}>
            <IconPlay /> Take the 3-minute tour
          </button>
          <a className="btn sm ghost" href={helpHref()}>
            <IconHelp /> Help, demos and what you get
          </a>
        </div>
        <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
          Working with Claude? Run <code>kimball serve</code> from the skill so this UI and Claude edit the same project file.
        </p>
      </div>
    </main>
  );
}
