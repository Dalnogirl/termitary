import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import type { SeatChoice } from '@termitary/protocol';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useSession } from '../network/auth-client.js';
import { fetchMyRooms } from '../network/rooms-api.js';
import { useCreateRoom } from '../network/use-create-room.js';
import { CreateRoomDialog } from '../rooms/CreateRoomDialog.js';
import { RoomRow, myRoomAction, myRoomDetail } from '../rooms/RoomRow.js';
import { paths } from '../routes/paths.js';
import { HomeHero } from './HomeHero.js';

const SHOWN = 3;

const linkClass = 'text-muted-foreground hover:text-foreground no-underline';

export const SignedInHome = () => {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const mine = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
  const createRoom = useCreateRoom();

  const openRoom = (roomId: string) => void navigate(paths.play(roomId), { viewTransition: true });

  const handleCreate = async (seat: SeatChoice): Promise<boolean> => {
    try {
      const { roomId } = await createRoom.mutateAsync(seat);
      openRoom(roomId);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create game');
      return false;
    }
  };

  const rooms = mine.data ?? [];
  const settled = !mine.isLoading && mine.error === null;

  return (
    <HomeHero height="full">
      <h1 className="text-3xl font-bold tracking-tight">Your games</h1>

      {mine.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mine.error !== null && (
        <p className="text-sm">
          Could not load your games:{' '}
          {mine.error instanceof Error ? mine.error.message : 'unknown error'}
        </p>
      )}

      {settled && rooms.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing in progress. Start one and the board fills the screen. The game behind this panel
          is live in the meantime, so click a piece if you want a move against yourself.
        </p>
      )}

      {rooms.length > 0 && (
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
      )}

      <div className="flex flex-wrap gap-2">
        <CreateRoomDialog
          triggerLabel="Create new game"
          triggerSize="lg"
          isPending={createRoom.isPending}
          onCreate={handleCreate}
        />
        <Link
          to={paths.hotseat}
          viewTransition
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
        >
          Play on this device
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link to={paths.lobby} viewTransition className={`${linkClass} text-xs`}>
          {rooms.length > SHOWN ? `All ${rooms.length} of your games` : 'Open games'} and free seats
          →
        </Link>
        {session && (
          <Link
            to={paths.profile(session.user.id)}
            viewTransition
            className={`${linkClass} text-xs`}
          >
            Your profile and past games →
          </Link>
        )}
      </div>
    </HomeHero>
  );
};
