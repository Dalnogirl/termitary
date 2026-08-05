import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Identity } from '../domain/identity.js';

// TODO(phase-4/phase-7): replace query-string playerId with an authenticated
// principal — JWT verify (Phase 4) → Cognito JWT (Phase 7). The Identity
// type is the abstraction boundary; only this function changes.
export const extractIdentity = (req: FastifyRequest): Identity => {
  const url = new URL(req.url, 'http://localhost');
  const requested = url.searchParams.get('playerId');
  const playerId = requested && requested.length > 0 ? requested : randomUUID();
  return { playerId };
};
