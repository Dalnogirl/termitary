import { user } from '../adapters/db/auth-schema.js';
import { createDb } from '../adapters/db/client.js';
import { createDrizzleArchivedGameStore } from '../adapters/drizzle-archived-game-store.js';
import { createDrizzleRoomStore } from '../adapters/drizzle-room-store.js';
import { createDrizzleUserStore } from '../adapters/drizzle-user-store.js';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import type { RoomStore } from '../domain/room-store.js';
import type { UserStore } from '../domain/user-store.js';

export type TestStores = {
  readonly rooms: RoomStore;
  readonly archive: ArchivedGameStore;
  readonly users: UserStore;
  readonly close: () => void;
};

export type TestPlayer = string | { readonly id: string; readonly name: string };

/**
 * The real stores over one in-memory database. Seats are a foreign key, so
 * every player a test seats has to be seeded here first; a bare string seeds a
 * player whose display name is their id.
 */
export const createTestStores = (players: readonly TestPlayer[] = []): TestStores => {
  const db = createDb(':memory:');
  for (const player of players) {
    const { id, name } = typeof player === 'string' ? { id: player, name: player } : player;
    db.db
      .insert(user)
      .values({ id, name, email: `${id}@example.test` })
      .run();
  }
  return {
    rooms: createDrizzleRoomStore(db.db),
    archive: createDrizzleArchivedGameStore(db.db),
    users: createDrizzleUserStore(db.db),
    close: () => db.close(),
  };
};
