import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as authSchema from './auth-schema.js';
import * as gameSchema from './schema.js';

// Both halves of the database in one namespace: better-auth's generated
// tables plus the hand-written game tables. `createAuth` gets `authSchema`
// alone, since its adapter maps better-auth model names onto tables and has
// no business seeing ours.
const schema = { ...authSchema, ...gameSchema };

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type DbHandle = {
  readonly db: Db;
  readonly close: () => void;
};

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../migrations');

export const createDb = (url: string): DbHandle => {
  if (url !== ':memory:') {
    const path = isAbsolute(url) ? url : resolve(process.cwd(), url);
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(url);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, close: () => sqlite.close() };
};
