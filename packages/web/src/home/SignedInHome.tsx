import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { fetchMyRooms } from '../network/rooms-api.js';
import { useCreateRoom } from '../network/use-create-room.js';
import { RoomRow, myRoomAction, myRoomDetail } from '../rooms/RoomRow.js';

const SHOWN = 3;

export const SignedInHome = () => {
  const navigate = useNavigate();
  const mine = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
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

  const rooms = mine.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your games</h1>
        <Button onClick={handleCreate} disabled={createRoom.isPending}>
          {createRoom.isPending ? 'Creating…' : 'Create new game'}
        </Button>
      </div>

      {mine.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {mine.error !== null && (
        <p>
          Could not load your games:{' '}
          {mine.error instanceof Error ? mine.error.message : 'unknown error'}
        </p>
      )}

      {!mine.isLoading && mine.error === null && rooms.length === 0 && (
        <p className="text-muted-foreground">
          Nothing in progress. Create a game, or take a seat in one from the{' '}
          <Link to="/lobby" className="underline underline-offset-4">
            lobby
          </Link>
          .
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rooms.slice(0, SHOWN).map((room) => (
          <RoomRow
            key={room.roomId}
            roomId={room.roomId}
            detail={myRoomDetail(room)}
            action={myRoomAction(room)}
            onOpen={() => openRoom(room.roomId)}
          />
        ))}
      </ul>

      <div className="flex gap-4 text-sm">
        <Link to="/lobby" className="text-muted-foreground hover:text-foreground">
          {rooms.length > SHOWN ? `All ${rooms.length} games and open seats` : 'Open games'} →
        </Link>
        <Link to="/hotseat" className="text-muted-foreground hover:text-foreground">
          Play someone next to you →
        </Link>
      </div>
    </div>
  );
};
