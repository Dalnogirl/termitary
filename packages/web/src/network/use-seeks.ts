import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PostSeekResponseDto, SeekBoardDto } from '@termitary/protocol';
import { useEffect, useRef } from 'react';
import { fetchMyRooms } from './rooms-api.js';
import { cancelSeek, claimSeek, fetchSeekBoard, seekGame } from './seeks-api.js';

const SEEKS_KEY = ['seeks'];
const MY_ROOMS_KEY = ['rooms', 'mine'];

// Nothing pushes a pairing to the player who was waiting, so while they hold a
// seek the board is polled for it disappearing.
const WAITING_POLL_MS = 3_000;

// The server deletes the claimed seek before it writes the room, so the first
// look can land in between.
const ROOM_CHECKS = 3;
const ROOM_CHECK_GAP_MS = 1_000;

const fetchRoomsNow = (queryClient: QueryClient) =>
  queryClient.fetchQuery({ queryKey: MY_ROOMS_KEY, queryFn: fetchMyRooms, staleTime: 0 });

/** Null when the rooms could not be read, which leaves nothing to diff against. */
const roomIds = (queryClient: QueryClient): Promise<ReadonlySet<string> | null> =>
  fetchRoomsNow(queryClient).then(
    (rooms) => new Set(rooms.map((room) => room.roomId)),
    () => null,
  );

/** The room that was not there while the seek stood, or undefined if none turned up. */
const findPairedRoom = async (
  queryClient: QueryClient,
  known: Promise<ReadonlySet<string> | null>,
  isAbandoned: () => boolean,
): Promise<string | undefined> => {
  const before = await known;
  if (before === null) {
    // Without a snapshot any room could be the new one. Refresh the list so
    // the game at least shows up there.
    await queryClient.invalidateQueries({ queryKey: MY_ROOMS_KEY });
    return undefined;
  }
  for (let check = 0; check < ROOM_CHECKS && !isAbandoned(); check++) {
    if (check > 0) await new Promise((resolve) => setTimeout(resolve, ROOM_CHECK_GAP_MS));
    const rooms = await fetchRoomsNow(queryClient).catch(() => []);
    const paired = rooms.find((room) => !before.has(room.roomId));
    if (paired !== undefined) return paired.roomId;
  }
  return undefined;
};

type WaitingSeek = {
  readonly seekId: string;
  readonly knownRooms: Promise<ReadonlySet<string> | null>;
};

/** `onPaired` fires when someone takes the seek this player left on the board. */
export const useSeeks = (onPaired: (roomId: string) => void) => {
  const queryClient = useQueryClient();
  const board = useQuery({
    queryKey: SEEKS_KEY,
    queryFn: fetchSeekBoard,
    refetchInterval: (query) => (query.state.data?.mine ? WAITING_POLL_MS : false),
  });

  const onPairedRef = useRef(onPaired);
  useEffect(() => {
    onPairedRef.current = onPaired;
  }, [onPaired]);

  // Cleared only once a search finishes, so StrictMode's second run of the
  // effect restarts the search its first cleanup abandoned.
  const waiting = useRef<WaitingSeek | null>(null);
  const mineId = board.data?.mine?.seekId ?? null;
  useEffect(() => {
    if (mineId !== null) {
      if (waiting.current?.seekId !== mineId) {
        waiting.current = { seekId: mineId, knownRooms: roomIds(queryClient) };
      }
      return;
    }
    const gone = waiting.current;
    if (gone === null) return;

    let abandoned = false;
    void findPairedRoom(queryClient, gone.knownRooms, () => abandoned).then((roomId) => {
      if (abandoned) return;
      waiting.current = null;
      if (roomId !== undefined) onPairedRef.current(roomId);
    });
    return () => {
      abandoned = true;
    };
  }, [mineId, queryClient]);

  const setMine = (mine: SeekBoardDto['mine']) =>
    queryClient.setQueryData<SeekBoardDto>(SEEKS_KEY, (current) => ({
      pool: current?.pool ?? [],
      mine,
    }));

  // A poll already in flight answers from before this post, and landing after
  // it would put the old seek back.
  const holdPolls = () => queryClient.cancelQueries({ queryKey: SEEKS_KEY });

  const onPosted = (result: PostSeekResponseDto): void => {
    if (result.outcome === 'waiting') {
      setMine(result.seek);
      return;
    }
    // Paired: the page navigates away, and the lobby it comes back to should
    // already list the game.
    void queryClient.invalidateQueries({ queryKey: MY_ROOMS_KEY });
  };
  const refreshBoard = () => queryClient.invalidateQueries({ queryKey: SEEKS_KEY });

  const play = useMutation({
    mutationFn: seekGame,
    onMutate: holdPolls,
    onSuccess: onPosted,
    onError: refreshBoard,
  });
  const claim = useMutation({
    mutationFn: claimSeek,
    onMutate: holdPolls,
    onSuccess: onPosted,
    onError: refreshBoard,
  });
  const cancel = useMutation({
    mutationFn: cancelSeek,
    onMutate: holdPolls,
    onSuccess: (outcome) => {
      if (outcome !== 'cancelled') return;
      // The player's own cancel won, so no game came of the seek and there is
      // nothing to look for.
      waiting.current = null;
      setMine(null);
    },
    onSettled: refreshBoard,
  });

  return { board, play, claim, cancel };
};
