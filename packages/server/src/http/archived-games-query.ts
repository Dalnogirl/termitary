import type { ArchivedGamesRequestDto } from '@termitary/protocol';
import { z } from 'zod';
import { decodeCursor } from './keyset-cursor.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// The cursor is the one part of this the client hands back, so it is the part
// zod parses: a string that does not decode is a 400, not a 500 further down.
const CursorSchema = z.string().transform((raw, ctx) => {
  const cursor = decodeCursor(raw);
  if (cursor === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'malformed cursor' });
    return z.NEVER;
  }
  return { finishedAt: cursor.at, id: cursor.id };
});

// Keyed by the request type, so a field the web sends and this ignores fails
// to compile.
export const ArchivedGamesQuerySchema = z.object({
  before: CursorSchema.optional(),
  // Asking for more than the cap is answered with the cap rather than refused;
  // the cursor is what the caller pages with either way.
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_LIMIT)
    .transform((n) => Math.min(n, MAX_LIMIT)),
} satisfies Record<keyof ArchivedGamesRequestDto, z.ZodTypeAny>);
