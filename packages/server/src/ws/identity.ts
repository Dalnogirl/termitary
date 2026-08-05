import type { FastifyRequest } from 'fastify';
import type { Auth } from '../adapters/auth/better-auth.js';
import { getUserIdFromHeaders } from '../adapters/auth/session.js';
import type { Identity } from '../domain/identity.js';

// DIP seam: ws/* sees only (req) => Promise<Identity | null>; the rest of
// the server doesn't know better-auth exists. Swapping to JWT or Cognito
// (Phase 7) changes only this factory + adapters/auth/session.ts.
export type IdentityExtractor = (req: FastifyRequest) => Promise<Identity | null>;

export const createIdentityExtractor =
  (auth: Auth): IdentityExtractor =>
  async (req) => {
    const userId = await getUserIdFromHeaders(auth, req.headers);
    return userId === null ? null : { playerId: userId };
  };
