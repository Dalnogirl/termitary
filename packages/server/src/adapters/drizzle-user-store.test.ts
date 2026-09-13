import { user } from './db/auth-schema.js';
import { createDb } from './db/client.js';
import { profiles } from './db/schema.js';
import { createDrizzleUserStore } from './drizzle-user-store.js';
import { describeUserStoreContract } from './user-store.contract.js';

describeUserStoreContract('DrizzleUserStore', async () => {
  const db = createDb(':memory:');
  const seeded = new Date('2025-12-01T00:00:00.000Z');
  // better-auth writes `''` here on every sign-in, so the fixtures do too: a
  // test that passes because the adapter read `user.name` is a false pass.
  const seedAccount = (id: string) => {
    db.db
      .insert(user)
      .values({ id, name: '', email: `${id}@example.test` })
      .run();
  };

  return {
    users: createDrizzleUserStore(db.db),
    seedUser: async (id, name) => {
      seedAccount(id);
      db.db
        .insert(profiles)
        .values({ userId: id, name, createdAt: seeded, updatedAt: seeded })
        .run();
    },
    seedAccountWithoutProfile: async (id) => {
      seedAccount(id);
    },
    cleanup: () => db.close(),
  };
});
