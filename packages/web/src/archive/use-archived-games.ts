import { useInfiniteQuery } from '@tanstack/react-query';
import type { ArchivedGameSummaryDto } from '@termitary/protocol';
import { fetchPlayerGames } from '../network/archived-games-api.js';

export type ArchivedGamesList = {
  readonly items: readonly ArchivedGameSummaryDto[];
  readonly isLoading: boolean;
  readonly error: unknown;
  /** A page that summarizes to nothing still carries a cursor, so this is not `items.length === 0`. */
  readonly isEmpty: boolean;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: () => void;
};

export const useArchivedGames = (userId: string): ArchivedGamesList => {
  const query = useInfiniteQuery({
    queryKey: ['player-games', userId],
    queryFn: ({ pageParam }) => fetchPlayerGames(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = (query.data?.pages ?? []).flatMap((page) => page.items);

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    isEmpty: !query.isLoading && query.error === null && items.length === 0 && !query.hasNextPage,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
};
