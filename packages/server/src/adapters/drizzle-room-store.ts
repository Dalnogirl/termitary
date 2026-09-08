import { WireGameStateSchema, fromWire, toWire } from '@hive/protocol';
import { eq, sql } from 'drizzle-orm';
import { RoomAlreadyExistsError, type RoomStore } from '../domain/room-store.js';
import type { Room } from '../domain/room.js';
import type { Db } from './db/client.js';
import { CURRENT_STATE_VERSION, type RoomRow, rooms as roomsTable } from './db/schema.js';

const seat = (userId: string | null) => (userId === null ? undefined : { playerId: userId });

const toRoom = (row: RoomRow): Room => ({
  id: row.id,
  state: fromWire(WireGameStateSchema.parse(row.state)),
  players: { white: seat(row.whiteUserId), black: seat(row.blackUserId) },
});

const mutableColumns = (room: Room) => ({
  whiteUserId: room.players.white?.playerId ?? null,
  blackUserId: room.players.black?.playerId ?? null,
  status: room.state.status,
  state: toWire(room.state),
  stateVersion: CURRENT_STATE_VERSION,
});

const insertColumns = (room: Room, now: Date) => ({
  ...mutableColumns(room),
  id: room.id,
  version: 1,
  createdAt: now,
  updatedAt: now,
});

// $onUpdate does not fire on the conflict branch of an upsert, so version and
// updatedAt are set by hand.
const updateColumns = (room: Room, now: Date) => ({
  ...mutableColumns(room),
  version: sql`${roomsTable.version} + 1`,
  updatedAt: now,
});

const isPrimaryKeyViolation = (err: unknown): boolean =>
  err instanceof Error && err.message.includes('UNIQUE constraint failed: rooms.id');

export const createDrizzleRoomStore = (db: Db, now: () => Date = () => new Date()): RoomStore => ({
  create: async (room) => {
    try {
      db.insert(roomsTable).values(insertColumns(room, now())).run();
    } catch (err) {
      if (isPrimaryKeyViolation(err)) throw new RoomAlreadyExistsError(room.id);
      throw err;
    }
  },

  get: async (id) => {
    const row = db.select().from(roomsTable).where(eq(roomsTable.id, id)).get();
    return row === undefined ? undefined : toRoom(row);
  },

  save: async (room) => {
    const stamp = now();
    db.insert(roomsTable)
      .values(insertColumns(room, stamp))
      .onConflictDoUpdate({ target: roomsTable.id, set: updateColumns(room, stamp) })
      .run();
  },

  delete: async (id) => {
    db.delete(roomsTable).where(eq(roomsTable.id, id)).run();
  },

  list: async () => db.select().from(roomsTable).all().map(toRoom),
});
