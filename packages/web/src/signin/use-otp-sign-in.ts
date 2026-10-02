import type { AuthProviderId } from '@termitary/protocol';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { messageOf } from '../lib/message-of.js';
import { notifier } from '../lib/notify.js';
import { authClient } from '../network/auth-client.js';

export const providerLabel: Record<AuthProviderId, string> = {
  google: 'Google',
  github: 'GitHub',
};

export type OtpStep = 'email' | 'otp';

export type OtpSignIn = {
  readonly step: OtpStep;
  readonly email: string;
  readonly setEmail: (email: string) => void;
  readonly otp: string;
  readonly setOtp: (otp: string) => void;
  readonly error: string | null;
  readonly pending: boolean;
  readonly emailRef: RefObject<HTMLInputElement | null>;
  readonly otpRef: RefObject<HTMLInputElement | null>;
  readonly signInWith: (provider: AuthProviderId) => Promise<void>;
  readonly requestOtp: () => Promise<void>;
  readonly submitOtp: () => Promise<void>;
  readonly changeEmail: () => void;
};

export const useOtpSignIn = (landingPath: string): OtpSignIn => {
  const navigate = useNavigate();
  const [step, setStep] = useState<OtpStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  // Focus by ref rather than autoFocus: biome's a11y rule bans the attribute,
  // and this also moves focus to the code field when the step advances.
  useEffect(() => {
    const field = step === 'email' ? emailRef : otpRef;
    field.current?.focus();
  }, [step]);

  const fail = (message: string): void => {
    setError(message);
    notifier.error(message);
  };

  const attempt = async (run: () => Promise<void>): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      await run();
    } catch (err) {
      fail(messageOf(err, 'Could not reach the server'));
    } finally {
      setPending(false);
    }
  };

  const signInWith = (provider: AuthProviderId): Promise<void> =>
    attempt(async () => {
      // `landingPath` rides on the callback URL rather than router state: the
      // provider round trip is a full-page navigation and state does not
      // survive it, so a bounce from /play/<id> would otherwise land on the
      // lobby.
      const { error: apiError } = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${landingPath}`,
      });
      // Only reached when the redirect never happens; on success the browser
      // has already left the page.
      if (apiError) fail(apiError.message ?? `Could not sign in with ${providerLabel[provider]}`);
    });

  const requestOtp = (): Promise<void> =>
    attempt(async () => {
      const { error: apiError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (apiError) {
        fail(apiError.message ?? 'Could not send the code');
        return;
      }
      setStep('otp');
    });

  const submitOtp = (): Promise<void> =>
    attempt(async () => {
      const { error: apiError } = await authClient.signIn.emailOtp({ email, otp });
      if (apiError) {
        fail(apiError.message ?? 'That code was not accepted');
        return;
      }
      await navigate(landingPath, { replace: true, viewTransition: true });
    });

  const changeEmail = (): void => {
    setStep('email');
    setOtp('');
    setError(null);
  };

  return {
    step,
    email,
    setEmail,
    otp,
    setOtp,
    error,
    pending,
    emailRef,
    otpRef,
    signInWith,
    requestOtp,
    submitOtp,
    changeEmail,
  };
};
