import { Button } from '@/components/ui/button';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../network/auth-client.js';
import { useAuthProviders } from '../network/use-auth-providers.js';
import { providerLabel, useOtpSignIn } from '../signin/use-otp-sign-in.js';
import { ProviderIcon } from './ProviderIcon.js';
import { paths } from './paths.js';

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// Sign-in doubles as sign-up: better-auth creates the user row on first OTP
// verification for an unseen email, so there is no separate registration flow.
export const SignInPage = () => {
  const location = useLocation();
  const session = useSession();
  const socialProviders = useAuthProviders();

  // Where RequireAuth bounced us from, or the lobby on a direct visit.
  const target = (location.state as { from?: string } | null)?.from ?? paths.home;
  const {
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
  } = useOtpSignIn(target);

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
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void requestOtp();
            }}
          >
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
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitOtp();
            }}
          >
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
              onClick={changeEmail}
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
