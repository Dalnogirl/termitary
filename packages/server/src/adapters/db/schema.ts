import type { WireGameState } from '@hive/protocol';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema.js';

// Hand-written game tables. `auth-schema.ts` is CLI output and gets rewritten
// whole by `pnpm db:generate-schema`, so nothing hand-authored survives there.

// Bump when `state` changes shape. WireGameStateSchema is strict, so old rows
// stop parsing; this is what a read-time upgrade would branch on.
export const CURRENT_STATE_VERSION = 1;

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    // Null is an empty seat, which is also what leaveGame produces, so deleting
    // an account unseats the player and leaves the opponent's game intact.
    whiteUserId: text('white_user_id').references(() => user.id, { onDelete: 'set null' }),
    blackUserId: text('black_user_id').references(() => user.id, { onDelete: 'set null' }),
    // Denormalized from state.status so the lobby list doesn't parse every game.
    status: text('status', { enum: ['in_progress', 'finished'] }).notNull(),
    state: text('state', { mode: 'json' }).$type<WireGameState>().notNull(),
    stateVersion: integer('state_version').notNull(),
    // Incremented, never compared: this is not working optimistic concurrency.
    // See the TODO in domain/room-store.ts.
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
