/**
 * A keyset page resumes after one row, identified by the timestamp it is
 * ordered on and the id that breaks a tie. Opaque to the client, which only
 * ever hands it back.
 */
export type KeysetCursor = {
  readonly at: Date;
  readonly id: string;
};

export const encodeCursor = ({ at, id }: KeysetCursor): string =>
  Buffer.from(`${at.getTime()}|${id}`).toString('base64url');

/** Undefined for anything that is not a cursor this encoded; callers answer 400. */
export const decodeCursor = (raw: string): KeysetCursor | undefined => {
  const parts = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const [millis, id] = parts;
  if (parts.length !== 2 || millis === undefined || !id) return undefined;
  const at = Number(millis);
  return Number.isSafeInteger(at) ? { at: new Date(at), id } : undefined;
};
