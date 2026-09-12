// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteError } from './RouteError.js';

const Boom = () => {
  throw new Error('render exploded');
};

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: '/',
            ErrorBoundary: RouteError,
            children: [
              { index: true, Component: () => <p>home</p> },
              { path: 'boom', Component: Boom },
            ],
          },
        ],
        { initialEntries: [path] },
      )}
    />,
  );

describe('RouteError', () => {
  beforeEach(() => {
    // React logs the caught error itself; silencing keeps the run readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('stays out of the way while the route renders', () => {
    renderAt('/');
    expect(screen.getByText('home')).toBeDefined();
  });

  it('replaces a throwing route with the message and a way out', () => {
    renderAt('/boom');

    expect(screen.getByText('render exploded')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to lobby' }).getAttribute('href')).toBe('/lobby');
  });

  it('leaves the stack in the console', () => {
    renderAt('/boom');

    const logged = vi.mocked(console.error).mock.calls.flat();
    expect(logged.some((arg) => arg instanceof Error && arg.message === 'render exploded')).toBe(
      true,
    );
  });
});
