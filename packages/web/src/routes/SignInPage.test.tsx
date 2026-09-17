// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthProvidersDto } from '@termitary/protocol';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInPage } from './SignInPage.js';

type SocialArgs = { provider: string; callbackURL: string };
const social = vi.fn(async (_args: SocialArgs) => ({ error: null }));

vi.mock('../network/auth-client.js', () => ({
  authClient: {
    // Deferred: vi.mock factories run before the const above is initialised.
    signIn: { social: (args: SocialArgs) => social(args) },
    emailOtp: { sendVerificationOtp: vi.fn() },
  },
  useSession: () => ({ data: null, isPending: false }),
}));

const providers = vi.fn<() => Promise<AuthProvidersDto>>();
vi.mock('../network/auth-providers-api.js', () => ({
  fetchAuthProviders: () => providers(),
}));

afterEach(cleanup);

beforeEach(() => {
  social.mockClear();
  providers.mockResolvedValue({ providers: ['google', 'github'] });
});

// The page reads `location.state.from`, so it is rendered through a router
// entry that carries one, the way RequireAuth hands it over.
const renderAt = (from?: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter
        initialEntries={[{ pathname: '/signin', ...(from ? { state: { from } } : {}) }]}
      >
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('SignInPage social sign-in', () => {
  it('renders a button per live provider', async () => {
    renderAt();

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeDefined();
  });

  it('sends the deep link as the callback URL, since router state does not survive the round trip', async () => {
    renderAt('/play/abc?x=1');

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    await waitFor(() =>
      expect(social).toHaveBeenCalledWith({
        provider: 'google',
        callbackURL: `${window.location.origin}/play/abc?x=1`,
      }),
    );
  });

  it('falls back to the lobby on a direct visit', async () => {
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    await waitFor(() =>
      expect(social).toHaveBeenCalledWith({
        provider: 'github',
        callbackURL: `${window.location.origin}/lobby`,
      }),
    );
  });

  it('shows the email form alone when nothing is configured', async () => {
    providers.mockResolvedValue({ providers: [] });
    renderAt();

    expect(await screen.findByRole('button', { name: 'Send code' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Continue with/ })).toBeNull();
  });

  it('keeps the email form usable when the provider fetch fails', async () => {
    providers.mockRejectedValue(new Error('offline'));
    renderAt();

    expect(await screen.findByRole('button', { name: 'Send code' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Continue with/ })).toBeNull();
  });
});
