import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MyRoomSummaryDto, RoomSummaryDto } from '@hive/protocol';
import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { relativeTime } from '../lib/relative-time.js';
import { fetchMyRooms, fetchRooms } from '../network/rooms-api.js';
import { useCreateRoom } from '../network/use-create-room.js';

type Tab = 'mine' | 'open';

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

const Listing = ({
  isLoading,
  error,
  empty,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  empty: string;
  children: readonly React.ReactNode[];
}) => (
  <div className="flex flex-col gap-3">
    {isLoading && <p className="text-muted-foreground">Loading…</p>}
    {error !== null && (
      <p className="text-foreground">
        Could not load games: {error instanceof Error ? error.message : 'unknown error'}
      </p>
    )}
    {!isLoading && error === null && children.length === 0 && (
      <p className="text-muted-foreground">{empty}</p>
    )}
    <ul className="flex flex-col gap-2 list-none p-0 m-0">{children}</ul>
  </div>
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

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Lobby</h1>
        <Button onClick={handleCreate} disabled={createRoom.isPending}>
          {createRoom.isPending ? 'Creating…' : 'Create new game'}
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value === 'open' ? 'open' : 'mine')}
        className="gap-3"
      >
        <div className="flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="mine">Your games</TabsTrigger>
            <TabsTrigger value="open">Open games</TabsTrigger>
          </TabsList>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void active.refetch()}
          >
            Refresh
          </button>
        </div>

        <TabsContent value="mine">
          <Listing
            isLoading={mine.isLoading}
            error={mine.error}
            empty="No games in progress. Browse open games or create one."
          >
            {(mine.data ?? []).map((room) => (
              <Row
                key={room.roomId}
                roomId={room.roomId}
                detail={myRoomDetail(room)}
                action={room.playerCount === 2 ? 'Reconnect' : 'Return'}
                onOpen={() => openRoom(room.roomId)}
              />
            ))}
          </Listing>
        </TabsContent>

        <TabsContent value="open">
          <Listing
            isLoading={open.isLoading}
            error={open.error}
            empty="No open games. Create one to get started."
          >
            {(open.data ?? []).map((room: RoomSummaryDto) => (
              <Row
                key={room.roomId}
                roomId={room.roomId}
                detail={`${room.playerCount}/2 players`}
                action="Join"
                onOpen={() => openRoom(room.roomId)}
              />
            ))}
          </Listing>
        </TabsContent>
      </Tabs>
    </div>
  );
};
