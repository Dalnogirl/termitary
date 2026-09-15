import { type ArchivedGameDetailDto, toWire } from '@termitary/protocol';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import { archivedSeatOf } from '../domain/archived-game.js';
import type { Identity } from '../domain/identity.js';
import { summarizeArchived } from './list-player-games.js';

/**
 * Any signed-in player may open any archived game, so a game linked from a
 * profile they did not play in still opens. The summary is written from the
 * caller's seat when they held one, and from white's when they did not.
 */
export const getArchivedGame = async (
  identity: Identity,
  id: string,
  archive: ArchivedGameStore,
): Promise<ArchivedGameDetailDto | undefined> => {
  const game = await archive.get(id);
  if (game === undefined) return undefined;
  const seat = archivedSeatOf(game.players, identity.playerId) ?? 'white';
  return { ...summarizeArchived(seat, game), state: toWire(game.state) };
};
