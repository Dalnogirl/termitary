import { ANY_GAME, type PostSeekResponseDto, type SeekPreference } from '@termitary/protocol';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { messageOf } from '../lib/message-of.js';
import { notifier } from '../lib/notify.js';
import { paths } from '../routes/paths.js';
import { useMyRooms } from './use-my-rooms.js';
import { useSeeks } from './use-seeks.js';

const showError = (fallback: string) => (err: unknown) => notifier.error(messageOf(err, fallback));

/** Everything the lobby does, so a layout only decides where it goes. */
export const useLobby = () => {
  const navigate = useNavigate();
  const [preference, setPreference] = useState<SeekPreference>(ANY_GAME);

  const rooms = useMyRooms();
  const openRoom = (roomId: string) => void navigate(paths.play(roomId), { viewTransition: true });
  const { board, play, claim, cancel } = useSeeks(openRoom);

  const enterIfPaired = (result: PostSeekResponseDto): void => {
    if (result.outcome === 'paired') openRoom(result.roomId);
  };

  const mySeek = board.data?.mine ?? null;

  return {
    preference,
    setPreference,
    rooms,
    board,
    myRooms: rooms.data ?? [],
    mySeek,
    pool: board.data?.pool ?? [],
    busy: play.isPending || claim.isPending || cancel.isPending,
    finding: play.isPending,
    openRoom,
    play: () =>
      void play.mutateAsync(preference).then(enterIfPaired, showError('Could not find a game')),
    join: (seekId: string) =>
      void claim.mutateAsync(seekId).then(enterIfPaired, showError('Could not join that game')),
    cancel: () => {
      if (mySeek === null) return;
      void cancel.mutateAsync(mySeek.seekId).catch(showError('Could not cancel your seek'));
    },
    refresh: () => {
      void board.refetch();
      void rooms.refetch();
    },
  };
};

export type Lobby = ReturnType<typeof useLobby>;
