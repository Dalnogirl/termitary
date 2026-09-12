import { inArray } from 'drizzle-orm';
import type { UserStore } from '../domain/user-store.js';
import { user } from './db/auth-schema.js';
import type { Db } from './db/client.js';

export const createDrizzleUserStore = (db: Db): UserStore => ({
  namesOf: async (ids) => {
    if (ids.length === 0) return new Map();
    const rows = db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...ids]))
      .all();
    return new Map(rows.map((row) => [row.id, row.name]));
  },
});
