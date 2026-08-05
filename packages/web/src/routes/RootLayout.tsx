import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavLink, Outlet } from 'react-router';
import { Toaster } from 'sonner';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }), 'no-underline');

export const RootLayout = () => (
  <div className="flex h-dvh w-dvw flex-col bg-background text-foreground overflow-hidden">
    <nav className="flex items-center gap-6 border-b border-border bg-background px-5 py-3">
      <span className="text-base font-bold tracking-[0.2em] uppercase">Hive</span>
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
    </nav>
    <main className="flex-1 flex flex-col min-h-0">
      <Outlet />
    </main>
    <Toaster theme="dark" richColors closeButton />
  </div>
);
