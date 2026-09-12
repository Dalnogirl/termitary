import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import { seatIds, toArchivedGame } from '../domain/archived-game.js';
import { type Room, isFinished } from '../domain/room.js';
import type { UserStore } from '../domain/user-store.js';

export type ArchivePorts = { readonly archive: ArchivedGameStore; readonly users: UserStore };

/**
 * Records a room that has just finished. Throws, so a caller that has already
 * committed the move can swallow it and leave the game to the sweep backstop.
 */
export const archiveFinished = async (
  room: Room,
  { archive, users }: ArchivePorts,
): Promise<void> => {
  if (!isFinished(room)) return;
  const names = await users.namesOf(seatIds(room));
  await archive.record(toArchivedGame(room, names));
};
