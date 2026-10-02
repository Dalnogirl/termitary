import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavLink, type NavLinkProps, Outlet, useLocation, useNavigate } from 'react-router';
import { Logo } from '../brand/Logo.js';
import { Notifications } from '../lib/notify.js';
import { signOut, useSession } from '../network/auth-client.js';
import { SettingsDialog } from '../settings/SettingsDialog.js';
import { paths } from './paths.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }), 'no-underline');

type PageLinkProps = Omit<NavLinkProps, 'to' | 'viewTransition'> & { to: string };

// A transition into the page already showing cross-fades it into itself.
const PageLink = ({ to, ...props }: PageLinkProps) => {
  const { pathname } = useLocation();
  return <NavLink to={to} viewTransition={pathname !== to} {...props} />;
};

const SessionBadge = () => {
  const navigate = useNavigate();
  const { data, isPending } = useSession();

  if (isPending) return null;

  if (!data) {
    return (
      <PageLink to={paths.signin} className={navLinkClass}>
        Sign in
      </PageLink>
    );
  }

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    await navigate(paths.signin, { replace: true, viewTransition: true });
  };

  return (
    <div className="flex items-center gap-3">
      <PageLink
        to={paths.profile(data.user.id)}
        className="text-xs text-muted-foreground no-underline hover:text-foreground"
      >
        {data.user.email}
      </PageLink>
      <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
};

export const RootLayout = () => (
  <div className="flex h-dvh w-dvw flex-col bg-background text-foreground overflow-hidden">
    <nav className="flex items-center gap-6 border-b border-border bg-background px-5 py-3">
      <PageLink to={paths.home} className="no-underline text-foreground">
        <Logo size="nav" />
      </PageLink>
      <ul className="flex items-center gap-2 list-none p-0 m-0">
        <li>
          <PageLink to={paths.hotseat} className={navLinkClass}>
            Hotseat
          </PageLink>
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
    <Notifications />
  </div>
);
