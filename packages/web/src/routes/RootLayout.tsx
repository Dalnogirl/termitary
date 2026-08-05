import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type WsClient, createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { getWsUrl } from '../network/url.js';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }), 'no-underline');

export const RootLayout = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  // The ephemeral create-game WS is owned by the component, so its lifetime
  // matches the component's. Without this, navigating away (or HMR) mid-create
  // leaks the socket.
  const clientRef = useRef<WsClient | null>(null);

  useEffect(
    () => () => {
      clientRef.current?.close();
      clientRef.current = null;
    },
    [],
  );

  const handlePlayOnline = (): void => {
    if (creating) return;
    setCreating(true);
    const client = createWsClient({ url: getWsUrl(), playerId: getOrCreatePlayerId() });
    clientRef.current = client;

    const finish = (): void => {
      if (clientRef.current !== client) return;
      client.close();
      clientRef.current = null;
      setCreating(false);
    };

    client.on('gameCreated', (msg) => {
      const { roomId } = msg;
      finish();
      void navigate(`/play/${roomId}`);
    });
    client.on('error', (msg) => {
      finish();
      console.error('failed to create game:', msg.message);
    });
    client.send({ type: 'createGame' });
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <nav className="flex items-center gap-6 border-b border-border bg-background px-5 py-3">
        <span className="text-base font-bold tracking-[0.2em] uppercase">Hive</span>
        <ul className="flex items-center gap-2 list-none p-0 m-0">
          <li>
            <NavLink to="/hotseat" className={navLinkClass}>
              Hotseat
            </NavLink>
          </li>
        </ul>
        <Button size="sm" variant="secondary" onClick={handlePlayOnline} disabled={creating}>
          {creating ? 'Creating…' : 'Play online'}
        </Button>
      </nav>
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
};
