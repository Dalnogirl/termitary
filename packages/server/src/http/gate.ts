import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Identity } from '../domain/identity.js';
import type { IdentityExtractor } from '../ws/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null;
  }
}

export type Gate = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export const gateIdentity =
  (extract: IdentityExtractor): Gate =>
  async (req, reply) => {
    const identity = await extract(req);
    if (identity === null) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    req.identity = identity;
  };

// The gate hook either sets req.identity or sends 401. Reaching a handler
// without identity is a framework invariant violation, not a runtime branch.
export const requireIdentity = (req: FastifyRequest): Identity => {
  if (req.identity === null) throw new Error('unreachable: gate did not set identity');
  return req.identity;
};
