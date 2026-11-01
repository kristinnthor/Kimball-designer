// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HELP_SECTIONS, PHASES, createProject, loadExample } from '../core';

beforeAll(() => {
  // jsdom lacks these browser APIs.
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  Element.prototype.scrollTo ??= function scrollTo() {};
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  window.scrollTo = () => {};
});

afterEach(cleanup);

async function setup() {
  const [{ App }, { store }] = await Promise.all([import('./App'), import('./store/store')]);
  return { App, store };
}

/** Navigates the hash router and lets React re-render. */
async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

/** Lets hash changes made by the app itself reach the router. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
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

  it('opens Help from the header and goes back to the same phase', async () => {
    const { App, store } = await setup();
    store.replace(loadExample('retail'), { resetHistory: true });
    render(<App />);
    await go('/grain');
    expect(screen.getByRole('link', { name: 'Help and demos' }).getAttribute('href')).toBe('#/help');

    await go('/help/deliverables');
    expect(screen.getByRole('heading', { level: 1, name: 'How Kimball Designer works' })).toBeTruthy();
    for (const s of HELP_SECTIONS) expect(document.getElementById(`help-${s.id}`), s.id).toBeTruthy();
    expect(document.querySelector('.help .diagram svg')).toBeTruthy();
    const toc = screen.getByRole('navigation', { name: 'Help contents' });
    expect(within(toc).getByRole('link', { name: 'What you get' }).getAttribute('aria-current')).toBe('location');
    expect(store.getState().project.meta.currentPhase).toBe('grain');

    fireEvent.click(screen.getByRole('button', { name: /back to your project/i }));
    await settle();
    expect(window.location.hash).toBe('#/grain');
    expect(screen.getByRole('heading', { level: 1, name: 'Grain' })).toBeTruthy();
  });

  it('shows Help without a project and returns to the welcome screen', async () => {
    const { App, store } = await setup();
    store.reset();
    render(<App />);
    await go('/help');
    expect(screen.getByRole('heading', { level: 1, name: 'How Kimball Designer works' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back to start/i }));
    await settle();
    expect(screen.getByRole('heading', { name: /start a new project/i })).toBeTruthy();
  });

  it('runs a demo from Help with a step-by-step bar', async () => {
    const { App, store } = await setup();
    store.reset();
    render(<App />);
    await go('/help/demos');
    fireEvent.click(screen.getByRole('button', { name: 'Start demo: Model your first business process' }));
    await settle();
    expect(store.getState().project.meta.name).toBe('Coffee shop analytics');
    expect(screen.getByRole('heading', { level: 1, name: 'Kickoff' })).toBeTruthy();

    const bar = screen.getByRole('region', { name: 'Demo: Model your first business process' });
    expect(within(bar).getByText('Step 1 of 11')).toBeTruthy();
    expect(within(bar).queryByText('Done')).toBeNull();
    act(() => store.update((d) => void Object.assign(d.meta, { purpose: 'Best sellers by hour', scopeIn: 'Till sales' })));
    expect(within(bar).getByText('Done')).toBeTruthy();

    fireEvent.click(within(bar).getByRole('button', { name: 'Next demo step' }));
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Stakeholders' })).toBeTruthy();
    expect(within(bar).getByText('Step 2 of 11')).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: 'Back: previous demo step' }));
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Kickoff' })).toBeTruthy();

    fireEvent.click(within(bar).getByRole('button', { name: 'Exit demo' }));
    expect(screen.queryByRole('region', { name: /^Demo:/ })).toBeNull();
  });
});
