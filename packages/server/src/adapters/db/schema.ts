import type { SeekPreference, WireGameState, WireRuleset } from '@termitary/protocol';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema.js';

// Hand-written game tables. `auth-schema.ts` is CLI output and gets rewritten
// whole by `pnpm db:generate-schema`, so nothing hand-authored survives there.
// That is also why this warning lives here: `user.name` and `user.image` are
// better-auth's columns and nothing in this app reads either. A display name
// is in `profiles` below, reached through `UserStore`. An OTP sign-up leaves
// `user.name` as `''` and `user.image` null; a Google or GitHub sign-up fills
// both from the provider. Neither is read, and neither can be dropped while
// better-auth owns the model.

// One row per account, created on first sign-in. Cascade rather than set null:
// a deleted account takes its profile with it, and the archive still renders
// because it snapshots names instead of joining.
export const profiles = sqliteTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type ProfileRow = typeof profiles.$inferSelect;

// Bump when `state` changes shape. WireGameStateSchema is strict, so old rows
// stop parsing; this is what a read-time upgrade would branch on.
export const CURRENT_STATE_VERSION = 2;

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    // Null is an empty seat, so deleting an account unseats the player and
    // leaves the opponent's game intact.
    whiteUserId: text('white_user_id').references(() => user.id, { onDelete: 'set null' }),
    blackUserId: text('black_user_id').references(() => user.id, { onDelete: 'set null' }),
    // Denormalized from state.status so the lobby list doesn't parse every game.
    status: text('status', { enum: ['in_progress', 'finished'] }).notNull(),
    state: text('state', { mode: 'json' }).$type<WireGameState>().notNull(),
    stateVersion: integer('state_version').notNull(),
    // The pieces themselves, not a preset name: a named preset that later
    // changed its contents would rewrite the rules of games already stored
    // under it. Null is a row written before the column, and reads as base.
    // `state` carries its own copy since S-6.4; this column is the one a query
    // can reach, and the room store takes it as the authority on read.
    ruleset: text('ruleset', { mode: 'json' }).$type<WireRuleset>(),
    // Optimistic concurrency: every `save` carries the version it read and
    // writes `WHERE version = ?`, so a lost compare-and-swap is a conflict.
    version: integer('version').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  // `.references()` emits a foreign key, not an index, so both seat columns
  // would otherwise be unindexed. Two separate indexes, not a composite: a
  // composite sorted by white first cannot answer `listSeatedBy`'s black half.
  (table) => [
    index('rooms_white_idx').on(table.whiteUserId),
    index('rooms_black_idx').on(table.blackUserId),
  ],
);

export type RoomRow = typeof rooms.$inferSelect;

// Five columns and no game. Cascade rather than set null: a seek whose seeker
// is gone can never pair, where a room with an empty seat is still a game the
// opponent can return to.
export const seeks = sqliteTable(
  'seeks',
  {
    id: text('id').primaryKey(),
    seekerUserId: text('seeker_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // One key per expansion the seeker had an opinion about. An absent key is
    // "either", so a row written before a new expansion existed reads as
    // accepting it, and no migration rewrites stored preferences.
    preference: text('preference', { mode: 'json' }).$type<SeekPreference>().notNull(),
    visibility: text('visibility', { enum: ['pool', 'private'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  // `created_at` sits directly behind `visibility` so the index serves the
  // ordering every pool read asks for. The expiry filter is deliberately not
  // in it: a range column ahead of the sort key would cost the ordering, and
  // matching reads the whole pool anyway, since compatibility is a predicate
  // in TypeScript rather than SQL.
  (table) => [
    index('seeks_seeker_idx').on(table.seekerUserId),
    index('seeks_pool_idx').on(table.visibility, table.createdAt),
  ],
);

export type SeekRow = typeof seeks.$inferSelect;

// Rooms are wiped within a day, so their version column never has to mean
// anything. These rows are permanent and WireGameStateSchema is strict, so a
// change to GameState invalidates every row already written; the answer then
// is one migration that rewrites the table, not read-time upgraders.
export const CURRENT_ARCHIVE_STATE_VERSION = 2;

export const archivedGames = sqliteTable(
  'archived_games',
  {
    // The room id. A room is archived once and then deleted, so the ids never
    // collide and a re-archive is an insert that does nothing.
    id: text('id').primaryKey(),
    whiteUserId: text('white_user_id').references(() => user.id, { onDelete: 'set null' }),
    blackUserId: text('black_user_id').references(() => user.id, { onDelete: 'set null' }),
    // Snapshotted, because a deleted account takes its name with it and the
    // FK above goes null. The FKs stay for joins that want the current name.
    whiteName: text('white_name'),
    blackName: text('black_name'),
    result: text('result', { enum: ['white-wins', 'black-wins', 'draw'] }).notNull(),
    endReason: text('end_reason', { enum: ['queen-surrounded', 'resignation'] }).notNull(),
    state: text('state', { mode: 'json' }).$type<WireGameState>().notNull(),
    stateVersion: integer('state_version').notNull(),
    moveCount: integer('move_count').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }).notNull(),
  },
  // Two indexes rather than a composite, for the reason the seat indexes on
  // `rooms` already carry: a listing reads one seat column at a time.
  (table) => [
    index('archived_games_white_idx').on(table.whiteUserId, table.finishedAt),
    index('archived_games_black_idx').on(table.blackUserId, table.finishedAt),
  ],
);

export type ArchivedGameRow = typeof archivedGames.$inferSelect;
