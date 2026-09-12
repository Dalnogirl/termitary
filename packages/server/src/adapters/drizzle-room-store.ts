import { WireGameStateSchema, fromWire, toWire } from '@termitary/protocol';
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { RoomAlreadyExistsError, type RoomOverview, type RoomStore } from '../domain/room-store.js';
import type { Room } from '../domain/room.js';
import type { Db } from './db/client.js';
import { CURRENT_STATE_VERSION, type RoomRow, rooms as roomsTable } from './db/schema.js';

const seat = (userId: string | null) => (userId === null ? undefined : { playerId: userId });

const toRoom = (row: RoomRow): Room => ({
  id: row.id,
  state: fromWire(WireGameStateSchema.parse(row.state)),
  players: { white: seat(row.whiteUserId), black: seat(row.blackUserId) },
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const overviewColumns = {
  id: roomsTable.id,
  whiteUserId: roomsTable.whiteUserId,
  blackUserId: roomsTable.blackUserId,
  status: roomsTable.status,
  updatedAt: roomsTable.updatedAt,
};

type OverviewRow = Pick<RoomRow, 'id' | 'whiteUserId' | 'blackUserId' | 'status' | 'updatedAt'>;

const toOverview = (row: OverviewRow): RoomOverview => ({
  id: row.id,
  players: { white: seat(row.whiteUserId), black: seat(row.blackUserId) },
  status: row.status,
  updatedAt: row.updatedAt,
});

const mutableColumns = (room: Room) => ({
  whiteUserId: room.players.white?.playerId ?? null,
  blackUserId: room.players.black?.playerId ?? null,
  status: room.state.status,
  state: toWire(room.state),
  stateVersion: CURRENT_STATE_VERSION,
});

const insertColumns = (room: Room) => ({
  ...mutableColumns(room),
  id: room.id,
  version: 1,
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
});

// createdAt is deliberately absent: the conflict branch leaves the room's real
// start alone, whatever the caller is carrying. version is set by hand because
// $onUpdate does not fire on an upsert's conflict branch.
const updateColumns = (room: Room) => ({
  ...mutableColumns(room),
  version: sql`${roomsTable.version} + 1`,
  updatedAt: room.updatedAt,
});

// better-sqlite3 sets a stable `code`; the message text names the table and
// would drift with the schema.
const isPrimaryKeyViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';

export const createDrizzleRoomStore = (db: Db): RoomStore => ({
  create: async (room) => {
    try {
      db.insert(roomsTable).values(insertColumns(room)).run();
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
    db.insert(roomsTable)
      .values(insertColumns(room))
      .onConflictDoUpdate({ target: roomsTable.id, set: updateColumns(room) })
      .run();
  },

  delete: async (id) => {
    db.delete(roomsTable).where(eq(roomsTable.id, id)).run();
  },

  // Projected, not whole rooms: the lobby never parses a game, so one
  // unreadable row cannot fail the listing for every user.
  listSeatedBy: async (playerId): Promise<readonly RoomOverview[]> =>
    db
      .select(overviewColumns)
      .from(roomsTable)
      .where(
        and(
          eq(roomsTable.status, 'in_progress'),
          or(eq(roomsTable.whiteUserId, playerId), eq(roomsTable.blackUserId, playerId)),
        ),
      )
      .orderBy(desc(roomsTable.updatedAt))
      .all()
      .map(toOverview),

  listOpenExcluding: async (playerId): Promise<readonly RoomOverview[]> =>
    db
      .select(overviewColumns)
      .from(roomsTable)
      .where(
        and(
          eq(roomsTable.status, 'in_progress'),
          or(isNull(roomsTable.whiteUserId), isNull(roomsTable.blackUserId)),
          // `IS NOT`, not `ne()`: on an empty seat `white_user_id != ?` is
          // NULL and drops the row, which is the open room we want to keep.
          sql`${roomsTable.whiteUserId} IS NOT ${playerId}`,
          sql`${roomsTable.blackUserId} IS NOT ${playerId}`,
        ),
      )
      .orderBy(desc(roomsTable.createdAt))
      .all()
      .map(toOverview),

  listFinishedBefore: async (cutoff): Promise<readonly Room[]> =>
    db
      .select()
      .from(roomsTable)
      .where(and(lt(roomsTable.updatedAt, cutoff), eq(roomsTable.status, 'finished')))
      .all()
      .map(toRoom),

  deleteAbandonedBefore: async (cutoff) =>
    db
      .delete(roomsTable)
      .where(
        and(
          lt(roomsTable.updatedAt, cutoff),
          or(isNull(roomsTable.whiteUserId), isNull(roomsTable.blackUserId)),
        ),
      )
      .run().changes,
});
