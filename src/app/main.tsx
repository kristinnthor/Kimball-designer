import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';
import { startSync } from './store/sync';

const root = createRoot(document.getElementById('root')!);

// Detect `kimball serve` (live file sync) before the first render so the right project shows up.
void startSync().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
