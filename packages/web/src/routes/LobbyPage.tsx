import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MyRoomSummaryDto, RoomSummaryDto } from '@hive/protocol';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { relativeTime } from '../lib/relative-time.js';
import { fetchMyRooms, fetchRooms } from '../network/rooms-api.js';
import { useCreateRoom } from '../network/use-create-room.js';

type Tab = 'mine' | 'open';

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'mine', label: 'Your games' },
  { id: 'open', label: 'Open games' },
];

const Row = ({
  roomId,
  detail,
  action,
  onOpen,
}: {
  roomId: string;
  detail: string;
  action: string;
  onOpen: () => void;
}) => (
  <li className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
    <div className="flex flex-col">
      <span className="font-mono text-sm">{roomId}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
    <Button size="sm" variant="secondary" onClick={onOpen}>
      {action}
    </Button>
  </li>
);

const myRoomDetail = (room: MyRoomSummaryDto): string => {
  const opponent = room.playerCount === 2 ? 'Opponent seated' : 'Waiting for opponent';
  return `Playing ${room.seat} · ${opponent} · ${relativeTime(room.updatedAt)}`;
};

export const LobbyPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('mine');

  const mine = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
  const open = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms });
  const active = tab === 'mine' ? mine : open;

  const createRoom = useCreateRoom();
  const openRoom = (roomId: string) => void navigate(`/play/${roomId}`);

  const handleCreate = (): void => {
    createRoom.mutate(undefined, {
      onSuccess: ({ roomId }) => openRoom(roomId),
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Could not create game');
      },
    });
  };

  const rows = (): readonly React.ReactNode[] => {
    if (tab === 'mine') {
      return (mine.data ?? []).map((room: MyRoomSummaryDto) => (
        <Row
          key={room.roomId}
          roomId={room.roomId}
          detail={myRoomDetail(room)}
          action={room.playerCount === 2 ? 'Reconnect' : 'Return'}
          onOpen={() => openRoom(room.roomId)}
        />
      ));
    }
    return (open.data ?? []).map((room: RoomSummaryDto) => (
      <Row
        key={room.roomId}
        roomId={room.roomId}
        detail={`${room.playerCount}/2 players`}
        action="Join"
        onOpen={() => openRoom(room.roomId)}
      />
    ));
  };

  const emptyMessage =
    tab === 'mine'
      ? 'No games in progress. Browse open games or create one.'
      : 'No open games. Create one to get started.';

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Lobby</h1>
        <Button onClick={handleCreate} disabled={createRoom.isPending}>
          {createRoom.isPending ? 'Creating…' : 'Create new game'}
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div role="tablist" className="flex gap-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.15em]',
                  tab === id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void active.refetch()}
          >
            Refresh
          </button>
        </div>

        {active.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {active.error && (
          <p className="text-foreground">
            Could not load games:{' '}
            {active.error instanceof Error ? active.error.message : 'unknown error'}
          </p>
        )}
        {!active.isLoading && !active.error && rows().length === 0 && (
          <p className="text-muted-foreground">{emptyMessage}</p>
        )}

        <ul className="flex flex-col gap-2 list-none p-0 m-0">{rows()}</ul>
      </section>
    </div>
  );
};
