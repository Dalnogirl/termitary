import { type ArchivedGameDetailDto, toWire } from '@termitary/protocol';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import type { Identity } from '../domain/identity.js';
import { summarizeArchived } from './list-archived-games.js';

/**
 * Undefined covers both a game that does not exist and one the caller never
 * played, so the route answers 404 to each: a 403 would confirm the game is
 * there.
 */
export const getArchivedGame = async (
  identity: Identity,
  id: string,
  archive: ArchivedGameStore,
): Promise<ArchivedGameDetailDto | undefined> => {
  const game = await archive.get(id);
  if (game === undefined) return undefined;
  const summary = summarizeArchived(identity.playerId, game);
  return summary === undefined ? undefined : { ...summary, state: toWire(game.state) };
};
