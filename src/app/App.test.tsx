// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PHASES, createProject, loadExample } from '../core';

beforeAll(() => {
  // jsdom lacks these browser APIs.
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  Element.prototype.scrollTo ??= function scrollTo() {};
});

afterEach(cleanup);

async function setup() {
  const [{ App }, { store }] = await Promise.all([import('./App'), import('./store/store')]);
  return { App, store };
}

describe('App', () => {
  it('shows the welcome screen until a project is started', async () => {
    const { App, store } = await setup();
    store.reset();
    render(<App />);
    expect(screen.getByRole('heading', { name: /start a new project/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Coffee analytics' } });
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(store.getState().started).toBe(true);
    expect(store.getState().project.meta.name).toBe('Coffee analytics');
  });

  it('renders every phase of a full example without crashing', async () => {
    const { App, store } = await setup();
    store.replace(loadExample('retail'), { resetHistory: true });
    render(<App />);
    for (const phase of PHASES) {
      await act(async () => {
        window.location.hash = `/${phase.id}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(screen.getByRole('heading', { level: 1, name: phase.title })).toBeTruthy();
      if (phase.id === 'bubbles') expect(document.querySelector('.diagram svg [data-dimension-id="dm_date"]')).toBeTruthy();
      if (phase.id === 'matrix') expect(screen.getAllByRole('checkbox', { checked: true }).length).toBe(21);
    }
  });

  it('renders every phase of an empty project with helpful empty states', async () => {
    const { App, store } = await setup();
    store.replace(createProject('Empty'), { resetHistory: true });
    render(<App />);
    for (const phase of PHASES) {
      await act(async () => {
        window.location.hash = `/${phase.id}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(screen.getByRole('heading', { level: 1, name: phase.title })).toBeTruthy();
    }
  });

  it('adds a business process from the quick-add chips and shows it in the stepper', async () => {
    const { App, store } = await setup();
    store.replace(createProject('Quick'), { resetHistory: true });
    render(<App />);
    await act(async () => {
      window.location.hash = '/processes';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: /^Orders$/ }));
    expect(store.getState().project.processes.map((p) => p.name)).toEqual(['Orders']);
    expect(screen.getByText('1 business process')).toBeTruthy();
  });
});
