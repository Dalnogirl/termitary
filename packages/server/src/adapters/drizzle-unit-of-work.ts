import type { UnitOfWork, WriteOp } from '../domain/unit-of-work.js';
import type { Db } from './db/client.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// Synchronous, because better-sqlite3 runs a transaction synchronously and
// refuses a callback that returns a promise. So an op is a plain function the
// commit calls, never an awaited store method.
type SqliteWrite = (tx: Tx) => void;

export const toWriteOp = (write: SqliteWrite): WriteOp => write as unknown as WriteOp;

const toSqliteWrite = (op: WriteOp): SqliteWrite => op as unknown as SqliteWrite;

export const createDrizzleUnitOfWork = (db: Db): UnitOfWork => ({
  commit: async (ops) => {
    db.transaction((tx) => {
      for (const op of ops) toSqliteWrite(op)(tx);
    });
  },
});
