import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import type { AuthProviderId } from '@termitary/protocol';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { authClient, useSession } from '../network/auth-client.js';
import { fetchAuthProviders } from '../network/auth-providers-api.js';
import { ProviderIcon } from './ProviderIcon.js';

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const messageOf = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const providerLabel: Record<AuthProviderId, string> = {
  google: 'Google',
  github: 'GitHub',
};

// Sign-in doubles as sign-up: better-auth creates the user row on first OTP
// verification for an unseen email, so there is no separate registration flow.
export const SignInPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  // A deployment without credentials returns an empty list and the page is the
  // email form it was before. A failed fetch is the same thing: no buttons.
  const providers = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: fetchAuthProviders,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const socialProviders = providers.data?.providers ?? [];

  // Where RequireAuth bounced us from, or the lobby on a direct visit.
  const target = (location.state as { from?: string } | null)?.from ?? '/lobby';

  // Focus by ref rather than autoFocus: biome's a11y rule bans the attribute,
  // and this also moves focus to the code field when the step advances.
  useEffect(() => {
    const field = step === 'email' ? emailRef : otpRef;
    field.current?.focus();
  }, [step]);

  const fail = (message: string): void => {
    setError(message);
    toast.error(message);
  };

  const signInWith = async (provider: AuthProviderId): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      // `target` rides on the callback URL rather than router state: the
      // provider round trip is a full-page navigation and state does not
      // survive it, so a bounce from /play/<id> would otherwise land on the
      // lobby.
      const { error: apiError } = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${target}`,
      });
      // Only reached when the redirect never happens; on success the browser
      // has already left the page.
      if (apiError) fail(apiError.message ?? `Could not sign in with ${providerLabel[provider]}`);
    } catch (err) {
      fail(messageOf(err, 'Could not reach the server'));
    } finally {
      setPending(false);
    }
  };

  const requestOtp = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { error: apiError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
      if (apiError) {
        fail(apiError.message ?? 'Could not send the code');
        return;
      }
      setStep('otp');
    } catch (err) {
      fail(messageOf(err, 'Could not reach the server'));
    } finally {
      setPending(false);
    }
  };

  const submitOtp = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { error: apiError } = await authClient.signIn.emailOtp({ email, otp });
      if (apiError) {
        fail(apiError.message ?? 'That code was not accepted');
        return;
      }
      await navigate(target, { replace: true, viewTransition: true });
    } catch (err) {
      fail(messageOf(err, 'Could not reach the server'));
    } finally {
      setPending(false);
    }
  };

  // Already signed in: nothing to do here. Covers the back button after a
  // sign-in and a bookmarked /signin.
  if (!session.isPending && session.data) return <Navigate to={target} replace />;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>

        {step === 'email' && socialProviders.length > 0 && (
          <div className="flex flex-col gap-3">
            {socialProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void signInWith(provider)}
              >
                <ProviderIcon provider={provider} />
                Continue with {providerLabel[provider]}
              </Button>
            ))}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        {step === 'email' ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => void requestOtp(e)}>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(e) => void submitOtp(e)}>
            <input
              ref={otpRef}
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputClass} font-mono tracking-[0.3em]`}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sent to {email}. In dev the code is printed to the server console.
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? 'Verifying…' : 'Sign in'}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep('email');
                setOtp('');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="text-sm text-foreground">{error}</p>}
      </div>
    </div>
  );
};
