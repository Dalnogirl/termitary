import { Button } from '@/components/ui/button';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { authClient, useSession } from '../network/auth-client.js';

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

const messageOf = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

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
      await navigate(target, { replace: true });
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
