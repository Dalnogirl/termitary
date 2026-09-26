import type { Ports } from '../domain/ports.js';
import { archiveFinished } from './archive-finished.js';

export const FINISHED_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type SweepPorts = Pick<Ports, 'rooms' | 'archive' | 'users' | 'log'>;

/**
 * Archive, then delete, always. A crash between the two leaves a room the next
 * sweep re-archives (a no-op) and deletes; a crash before the archive leaves
 * the room for the next sweep to retry. Nothing is deleted unarchived.
 */
export const sweepFinishedRooms = async (
  { rooms, archive, users, log }: SweepPorts,
  now: Date = new Date(),
): Promise<number> => {
  const cutoff = new Date(now.getTime() - FINISHED_ROOM_TTL_MS);

  let removed = 0;
  for (const room of await rooms.listFinishedBefore(cutoff)) {
    try {
      await archiveFinished(room, { archive, users });
    } catch (err) {
      log.error({ roomId: room.id, err }, 'archiving a swept game failed');
      continue;
    }
    await rooms.delete(room.id);
    removed += 1;
  }

  return removed;
};
