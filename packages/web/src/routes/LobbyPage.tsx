import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ANY_GAME, type PostSeekResponseDto, type SeekPreference } from '@termitary/protocol';
import type * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { fetchMyRooms } from '../network/rooms-api.js';
import { useSeeks } from '../network/use-seeks.js';
import { RoomRow, myRoomAction, myRoomDetail } from '../rooms/RoomRow.js';
import { SeekOptions } from '../rooms/SeekOptions.js';
import { SeekRow } from '../rooms/SeekRow.js';
import { expansionsIn } from '../rooms/expansions.js';
import { paths } from './paths.js';

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
        Could not load: {error instanceof Error ? error.message : 'unknown error'}
      </p>
    )}
    {!isLoading && error === null && children.length === 0 && (
      <p className="text-muted-foreground">{empty}</p>
    )}
    <ul className="flex flex-col gap-2 list-none p-0 m-0">{children}</ul>
  </div>
);

const showError = (fallback: string) => (err: unknown) =>
  void toast.error(err instanceof Error ? err.message : fallback);

export const LobbyPage = () => {
  const navigate = useNavigate();
  const [preference, setPreference] = useState<SeekPreference>(ANY_GAME);

  const mine = useQuery({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });
  const openRoom = (roomId: string) => void navigate(paths.play(roomId), { viewTransition: true });
  const { board, play, claim, cancel } = useSeeks(openRoom);

  const enterIfPaired = (result: PostSeekResponseDto): void => {
    if (result.outcome === 'paired') openRoom(result.roomId);
  };

  const busy = play.isPending || claim.isPending || cancel.isPending;
  const myRooms = mine.data ?? [];
  const mySeek = board.data?.mine ?? null;
  const pool = board.data?.pool ?? [];

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 min-h-0 content-start items-start gap-8 p-6 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Your games</h1>
          <Listing
            isLoading={mine.isLoading}
            error={mine.error}
            empty="No games in progress. Find one below."
          >
            {myRooms.map((room) => (
              <RoomRow
                key={room.roomId}
                roomId={room.roomId}
                detail={myRoomDetail(room)}
                badges={expansionsIn(room.ruleset).map((e) => e.label)}
                action={myRoomAction(room)}
                onOpen={() => openRoom(room.roomId)}
              />
            ))}
          </Listing>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Find a game</h2>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                void board.refetch();
                void mine.refetch();
              }}
            >
              Refresh
            </button>
          </div>

          {mySeek === null ? (
            <Button
              size="lg"
              className="self-start"
              disabled={busy}
              onClick={() =>
                play.mutateAsync(preference).then(enterIfPaired, showError('Could not find a game'))
              }
            >
              {play.isPending ? 'Finding a game…' : 'Play'}
            </Button>
          ) : (
            // One seek at a time: Play is replaced rather than disabled, so a
            // second post cannot race the pairing the lobby is waiting on.
            <div className="flex items-center gap-3">
              <Button size="lg" disabled>
                Looking for an opponent…
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void cancel
                    .mutateAsync(mySeek.seekId)
                    .catch(showError('Could not cancel your seek'))
                }
              >
                Cancel
              </Button>
            </div>
          )}

          <Listing
            isLoading={board.isLoading}
            error={board.error}
            empty="Nobody is waiting. Press Play and your seek is the first one here."
          >
            {[
              ...(mySeek === null ? [] : [<SeekRow key={mySeek.seekId} seek={mySeek} mine />]),
              ...pool.map((seek) => (
                <SeekRow
                  key={seek.seekId}
                  seek={seek}
                  mine={false}
                  disabled={busy}
                  onJoin={() =>
                    claim
                      .mutateAsync(seek.seekId)
                      .then(enterIfPaired, showError('Could not join that game'))
                  }
                />
              )),
            ]}
          </Listing>
        </section>
      </div>

      <aside className="md:sticky md:top-6">
        <SeekOptions preference={preference} onChange={setPreference} locked={mySeek !== null} />
      </aside>
    </div>
  );
};
