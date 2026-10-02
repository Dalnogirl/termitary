// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifier } from '../lib/notify.js';
import { authClient } from '../network/auth-client.js';
import { useOtpSignIn } from './use-otp-sign-in.js';

vi.mock('../network/auth-client.js', () => ({
  authClient: {
    signIn: { social: vi.fn(), emailOtp: vi.fn() },
    emailOtp: { sendVerificationOtp: vi.fn() },
  },
}));
vi.mock('../lib/notify.js', () => ({ notifier: { error: vi.fn(), info: vi.fn() } }));

const sendCode = vi.mocked(authClient.emailOtp.sendVerificationOtp);
const verifyCode = vi.mocked(authClient.signIn.emailOtp);
const social = vi.mocked(authClient.signIn.social);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ok = { data: null, error: null } as never;
const refused = (message: string) => ({ data: null, error: { message } }) as never;

const renderSignIn = (target = '/play/abc') => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/signin']}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ signIn: useOtpSignIn(target), location: useLocation() }), {
    wrapper,
  });
};

const atCodeStep = async () => {
  sendCode.mockResolvedValue(ok);
  const hook = renderSignIn();
  act(() => hook.result.current.signIn.setEmail('ada@example.com'));
  await act(() => hook.result.current.signIn.requestOtp());
  return hook;
};

describe('useOtpSignIn', () => {
  it('sends a sign-in code to the typed address, then asks for it', async () => {
    const hook = await atCodeStep();

    expect(sendCode).toHaveBeenCalledWith({ email: 'ada@example.com', type: 'sign-in' });
    expect(hook.result.current.signIn.step).toBe('otp');
    expect(hook.result.current.signIn.pending).toBe(false);
  });

  it('stays on the email step with the server’s reason when the send is refused', async () => {
    sendCode.mockResolvedValue(refused('Too many requests'));
    const hook = renderSignIn();

    await act(() => hook.result.current.signIn.requestOtp());

    expect(hook.result.current.signIn.step).toBe('email');
    expect(hook.result.current.signIn.error).toBe('Too many requests');
    expect(notifier.error).toHaveBeenCalledWith('Too many requests');
  });

  it('lands on the target once the code is accepted', async () => {
    const hook = await atCodeStep();
    verifyCode.mockResolvedValue(ok);
    act(() => hook.result.current.signIn.setOtp('123456'));

    await act(() => hook.result.current.signIn.submitOtp());

    expect(verifyCode).toHaveBeenCalledWith({ email: 'ada@example.com', otp: '123456' });
    expect(hook.result.current.location.pathname).toBe('/play/abc');
  });

  it('keeps the code step open when the code is refused', async () => {
    const hook = await atCodeStep();
    verifyCode.mockResolvedValue(refused('Invalid OTP'));

    await act(() => hook.result.current.signIn.submitOtp());

    expect(hook.result.current.signIn.step).toBe('otp');
    expect(hook.result.current.signIn.error).toBe('Invalid OTP');
    expect(hook.result.current.location.pathname).toBe('/signin');
  });

  it('reports an unreachable server and lets the player try again', async () => {
    sendCode.mockRejectedValue(new TypeError('Failed to fetch'));
    const hook = renderSignIn();

    await act(() => hook.result.current.signIn.requestOtp());

    expect(hook.result.current.signIn.error).toBe('Failed to fetch');
    expect(hook.result.current.signIn.pending).toBe(false);
  });

  it('names the provider when a social sign-in is refused without a reason', async () => {
    social.mockResolvedValue({ data: null, error: {} } as never);
    const hook = renderSignIn();

    await act(() => hook.result.current.signIn.signInWith('github'));

    expect(hook.result.current.signIn.error).toBe('Could not sign in with GitHub');
  });

  it('drops the code and the error when the player goes back for another address', async () => {
    const hook = await atCodeStep();
    verifyCode.mockResolvedValue(refused('Invalid OTP'));
    act(() => hook.result.current.signIn.setOtp('000000'));
    await act(() => hook.result.current.signIn.submitOtp());

    act(() => hook.result.current.signIn.changeEmail());

    expect(hook.result.current.signIn.step).toBe('email');
    expect(hook.result.current.signIn.otp).toBe('');
    expect(hook.result.current.signIn.error).toBeNull();
    expect(hook.result.current.signIn.email).toBe('ada@example.com');
  });

  it('moves focus to the code field when the step advances', async () => {
    sendCode.mockResolvedValue(ok);
    const hook = renderSignIn();
    const codeField = document.body.appendChild(document.createElement('input'));
    hook.result.current.signIn.otpRef.current = codeField;

    try {
      await act(() => hook.result.current.signIn.requestOtp());
      expect(document.activeElement).toBe(codeField);
    } finally {
      codeField.remove();
    }
  });
});
