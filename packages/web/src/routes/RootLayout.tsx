import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Toaster } from 'sonner';
import { Logo } from '../brand/Logo.js';
import { signOut, useSession } from '../network/auth-client.js';
import { SettingsDialog } from '../settings/SettingsDialog.js';
import { paths } from './paths.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }), 'no-underline');

const SessionBadge = () => {
  const navigate = useNavigate();
  const { data } = useSession();

  if (!data) return null;

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    await navigate(paths.signin, { replace: true, viewTransition: true });
  };

  return (
    <div className="flex items-center gap-3">
      <NavLink
        to={paths.profile(data.user.id)}
        viewTransition
        className="text-xs text-muted-foreground no-underline hover:text-foreground"
      >
        {data.user.email}
      </NavLink>
      <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
};

export const RootLayout = () => (
  <div className="flex h-dvh w-dvw flex-col bg-background text-foreground overflow-hidden">
    <nav className="flex items-center gap-6 border-b border-border bg-background px-5 py-3">
      <NavLink to={paths.home} viewTransition className="no-underline text-foreground">
        <Logo size="nav" />
      </NavLink>
      <ul className="flex items-center gap-2 list-none p-0 m-0">
        <li>
          <NavLink to={paths.hotseat} viewTransition className={navLinkClass}>
            Hotseat
          </NavLink>
        </li>
        <li>
          <NavLink to={paths.lobby} viewTransition className={navLinkClass}>
            Play online
          </NavLink>
        </li>
      </ul>
      <div className="ml-auto flex items-center gap-2">
        <SessionBadge />
        <SettingsDialog />
      </div>
    </nav>
    <main className="page-transition-root flex-1 flex flex-col min-h-0">
      <Outlet />
    </main>
    <Toaster theme="dark" richColors closeButton />
  </div>
);
