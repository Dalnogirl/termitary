import { user } from './db/auth-schema.js';
import { createDb } from './db/client.js';
import { createDrizzleUserStore } from './drizzle-user-store.js';
import { describeUserStoreContract } from './user-store.contract.js';

describeUserStoreContract('DrizzleUserStore', async () => {
  const db = createDb(':memory:');
  return {
    users: createDrizzleUserStore(db.db),
    seedUser: async (id, name) => {
      db.db
        .insert(user)
        .values({ id, name, email: `${id}@example.test` })
        .run();
    },
    cleanup: () => db.close(),
  };
});
