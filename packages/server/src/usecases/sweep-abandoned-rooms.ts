import type { RoomStore } from '../domain/room-store.js';

export const ABANDONED_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export const sweepAbandonedRooms = async (
  rooms: RoomStore,
  now: Date = new Date(),
): Promise<number> => rooms.deleteAbandonedBefore(new Date(now.getTime() - ABANDONED_ROOM_TTL_MS));
