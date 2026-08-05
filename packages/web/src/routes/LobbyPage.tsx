import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { type WsClient, createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { fetchRooms } from '../network/rooms-api.js';
import { getWsUrl } from '../network/url.js';

export const LobbyPage = () => {
  const navigate = useNavigate();
  const {
    data: rooms,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
  });

  // Ephemeral create-game WS, owned by the lobby. Same useRef + useEffect
  // cleanup pattern as the earlier RootLayout version: unmount or HMR
  // closes any in-flight socket so we don't leak.
  const [creating, setCreating] = useState(false);
  const clientRef = useRef<WsClient | null>(null);

  useEffect(
    () => () => {
      clientRef.current?.close();
      clientRef.current = null;
    },
    [],
  );

  const handleCreate = (): void => {
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

  const joinable = (rooms ?? []).filter((r) => r.status === 'in_progress' && r.playerCount < 2);

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Lobby</h1>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create new game'}
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Open games</h2>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void refetch()}
          >
            Refresh
          </button>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <p className="text-foreground">
            Could not load games: {error instanceof Error ? error.message : 'unknown error'}
          </p>
        )}
        {!isLoading && !error && joinable.length === 0 && (
          <p className="text-muted-foreground">No open games. Create one to get started.</p>
        )}

        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {joinable.map((room) => (
            <li
              key={room.roomId}
              className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="font-mono text-sm">{room.roomId}</span>
                <span className="text-xs text-muted-foreground">{room.playerCount}/2 players</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigate(`/play/${room.roomId}`)}
              >
                Join
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
