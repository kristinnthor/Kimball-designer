import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_VERSION } from '../core/version';

function App() {
  return (
    <main>
      <h1>Kimball Designer</h1>
      <p>Version {APP_VERSION}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
