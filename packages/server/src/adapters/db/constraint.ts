type SqliteConstraint =
  | 'SQLITE_CONSTRAINT_PRIMARYKEY'
  | 'SQLITE_CONSTRAINT_UNIQUE'
  | 'SQLITE_CONSTRAINT_FOREIGNKEY';

// better-sqlite3 sets a stable `code`; the message text names the table and
// would drift with the schema.
export const violates = (err: unknown, constraint: SqliteConstraint): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === constraint;
