import { BASE_RULESET, type Ruleset } from '@termitary/engine';
import {
  WireGameStateSchema,
  WireRulesetSchema,
  fromWire,
  fromWireRuleset,
  toWire,
  toWireRuleset,
} from '@termitary/protocol';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  ConcurrentModificationError,
  RoomAlreadyExistsError,
  type RoomOverview,
  type RoomStore,
} from '../domain/room-store.js';
import type { Room } from '../domain/room.js';
import type { Db } from './db/client.js';
import { CURRENT_STATE_VERSION, type RoomRow, rooms as roomsTable } from './db/schema.js';

const seat = (userId: string | null) => (userId === null ? undefined : { playerId: userId });

const rulesetOf = (stored: RoomRow['ruleset']) =>
  stored === null ? BASE_RULESET : fromWireRuleset(WireRulesetSchema.parse(stored));

// The listing never throws over one room: an unreadable ruleset costs that row
// its badge, where `rulesetOf` would cost everyone the lobby.
const overviewRulesetOf = (stored: RoomRow['ruleset']): Ruleset => {
  try {
    return rulesetOf(stored);
  } catch {
    return BASE_RULESET;
  }
};

// The column wins over the copy inside `state`: a room stored between S-6.3
// and S-6.4 has its ruleset in the column and nowhere else.
const toRoom = (row: RoomRow): Room => {
  const ruleset = rulesetOf(row.ruleset);
  return {
    id: row.id,
    ruleset,
    state: fromWire(WireGameStateSchema.parse(row.state), ruleset),
    players: { white: seat(row.whiteUserId), black: seat(row.blackUserId) },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const overviewColumns = {
  id: roomsTable.id,
  whiteUserId: roomsTable.whiteUserId,
  blackUserId: roomsTable.blackUserId,
  status: roomsTable.status,
  updatedAt: roomsTable.updatedAt,
  ruleset: roomsTable.ruleset,
};

type OverviewRow = Pick<
  RoomRow,
  'id' | 'whiteUserId' | 'blackUserId' | 'status' | 'updatedAt' | 'ruleset'
>;

const toOverview = (row: OverviewRow): RoomOverview => ({
  id: row.id,
  players: { white: seat(row.whiteUserId), black: seat(row.blackUserId) },
  status: row.status,
  updatedAt: row.updatedAt,
  ruleset: overviewRulesetOf(row.ruleset),
});

const mutableColumns = (room: Room) => ({
  whiteUserId: room.players.white?.playerId ?? null,
  blackUserId: room.players.black?.playerId ?? null,
  status: room.state.status,
  state: toWire(room.state),
  stateVersion: CURRENT_STATE_VERSION,
  ruleset: toWireRuleset(room.ruleset),
});

const insertColumns = (room: Room) => ({
  ...mutableColumns(room),
  id: room.id,
  version: 1,
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
});

// createdAt is deliberately absent: an update leaves the room's real start
// alone, whatever the caller is carrying.
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

  getForUpdate: async (id) => {
    const row = db.select().from(roomsTable).where(eq(roomsTable.id, id)).get();
    return row === undefined ? undefined : { value: toRoom(row), version: row.version };
  },

  // An update rather than an upsert: a room deleted since the read stays
  // deleted, which is the conflict a cancel racing a join has to lose.
  save: async (room, expected) => {
    const { changes } = db
      .update(roomsTable)
      .set(updateColumns(room))
      .where(and(eq(roomsTable.id, room.id), eq(roomsTable.version, expected)))
      .run();
    if (changes === 0) throw new ConcurrentModificationError(room.id);
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

  listFinishedBefore: async (cutoff): Promise<readonly Room[]> =>
    db
      .select()
      .from(roomsTable)
      .where(and(lt(roomsTable.updatedAt, cutoff), eq(roomsTable.status, 'finished')))
      .all()
      .map(toRoom),
});
