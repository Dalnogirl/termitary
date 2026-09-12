import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Toaster } from 'sonner';
import { signOut, useSession } from '../network/auth-client.js';
import { SettingsDialog } from '../settings/SettingsDialog.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }), 'no-underline');

const SessionBadge = () => {
  const navigate = useNavigate();
  const { data } = useSession();

  if (!data) return null;

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    await navigate('/signin', { replace: true });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">{data.user.email}</span>
      <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
};

export const RootLayout = () => (
  <div className="flex h-dvh w-dvw flex-col bg-background text-foreground overflow-hidden">
    <nav className="flex items-center gap-6 border-b border-border bg-background px-5 py-3">
      <NavLink
        to="/"
        className="text-base font-bold tracking-[0.2em] uppercase no-underline text-foreground"
      >
        Termitary
      </NavLink>
      <ul className="flex items-center gap-2 list-none p-0 m-0">
        <li>
          <NavLink to="/hotseat" className={navLinkClass}>
            Hotseat
          </NavLink>
        </li>
        <li>
          <NavLink to="/lobby" className={navLinkClass}>
            Play online
          </NavLink>
        </li>
      </ul>
      <div className="ml-auto flex items-center gap-2">
        <SessionBadge />
        <SettingsDialog />
      </div>
    </nav>
    <main className="flex-1 flex flex-col min-h-0">
      <Outlet />
    </main>
    <Toaster theme="dark" richColors closeButton />
  </div>
);
