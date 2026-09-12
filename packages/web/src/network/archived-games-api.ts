import type { ArchivedGameDetailDto, ArchivedGameSummaryDto, Page } from '@termitary/protocol';
import { getApiUrl } from './url.js';

export const fetchArchivedGames = async (
  before?: string,
): Promise<Page<ArchivedGameSummaryDto>> => {
  const query = before === undefined ? '' : `?before=${encodeURIComponent(before)}`;
  const res = await fetch(`${getApiUrl()}/archived-games${query}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /archived-games returned ${res.status}`);
  return (await res.json()) as Page<ArchivedGameSummaryDto>;
};

// A game the caller never played is a 404 alongside one that never existed, so
// null is "nothing to show you" rather than an error worth a boundary.
export const fetchArchivedGame = async (gameId: string): Promise<ArchivedGameDetailDto | null> => {
  const res = await fetch(`${getApiUrl()}/archived-games/${encodeURIComponent(gameId)}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /archived-games/${gameId} returned ${res.status}`);
  return (await res.json()) as ArchivedGameDetailDto;
};
