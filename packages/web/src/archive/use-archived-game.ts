import { useQuery } from '@tanstack/react-query';
import { type ArchivedGameDetailDto, fromWire } from '@termitary/protocol';
import { useLayoutEffect } from 'react';
import { fetchArchivedGame } from '../network/archived-games-api.js';
import { gameStore } from '../store/store.js';

export type ArchivedGameView =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly game: ArchivedGameDetailDto };

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

/**
 * Loads one archived game and puts it on the board. The store write is the
 * reason this is a hook and not a bare query: the page renders the module-level
 * gameStore, so something has to own filling it.
 */
export const useArchivedGame = (gameId: string | undefined): ArchivedGameView => {
  const query = useQuery({
    queryKey: ['archived-games', gameId],
    queryFn: () => fetchArchivedGame(gameId ?? ''),
    enabled: gameId !== undefined,
    // A finished game never changes, so the focus refetch the other queries
    // want would only be a second chance to fail.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  // The board arrives at the final position; the scrub controls walk it back.
  // Before paint, not after: a cache-served detail renders on the first pass,
  // and the store still holds whichever game was open last.
  const state = query.data?.state;
  useLayoutEffect(() => {
    if (state === undefined) return;
    gameStore.getState().applyGameState(fromWire(state));
  }, [state]);

  if (query.data === null) return { status: 'missing' };
  // Data outranks the error: a refetch that fails over a detail we already have
  // leaves the board up rather than replacing it with a message.
  if (query.data !== undefined) return { status: 'ready', game: query.data };
  if (query.isLoading) return { status: 'loading' };
  return query.error === null
    ? { status: 'loading' }
    : { status: 'error', message: describe(query.error) };
};
