import type { ArchivedGameDetailDto, ArchivedGameSummaryDto, Page } from '@termitary/protocol';
import { getApiUrl } from './url.js';

export const fetchPlayerGames = async (
  userId: string,
  before?: string,
): Promise<Page<ArchivedGameSummaryDto>> => {
  const query = before === undefined ? '' : `?before=${encodeURIComponent(before)}`;
  const path = `/users/${encodeURIComponent(userId)}/games`;
  const res = await fetch(`${getApiUrl()}${path}${query}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
  return (await res.json()) as Page<ArchivedGameSummaryDto>;
};

// Only a game that never existed is a 404 now, so null is "nothing to show
// you" rather than an error worth a boundary.
export const fetchArchivedGame = async (gameId: string): Promise<ArchivedGameDetailDto | null> => {
  const res = await fetch(`${getApiUrl()}/archived-games/${encodeURIComponent(gameId)}`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /archived-games/${gameId} returned ${res.status}`);
  return (await res.json()) as ArchivedGameDetailDto;
};
