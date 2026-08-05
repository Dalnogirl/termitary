import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './better-auth.js';

// Mount better-auth's Web-Fetch handler at /api/auth/* by translating
// Fastify req/reply ↔ Web Request/Response. Registered as an encapsulated
// plugin so the raw-buffer content-type parser only scopes to /api/auth/*
// and doesn't shadow the JSON parser used by /rooms et al.
export const registerAuth = async (app: FastifyInstance, auth: Auth): Promise<void> => {
  await app.register(async (scope) => {
    scope.addContentTypeParser(
      ['application/json', 'application/x-www-form-urlencoded'],
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );

    scope.route({
      method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      url: '/api/auth/*',
      handler: async (req: FastifyRequest, reply: FastifyReply) => {
        const url = new URL(req.url, originFromRequest(req));
        const init: RequestInit = {
          method: req.method,
          headers: toHeaders(req.headers),
        };
        if (methodHasBody(req.method) && req.body) {
          // Node 22 fetch accepts Buffer/Uint8Array at runtime, but
          // @types/node's BodyInit narrows out BufferSource; decode to string.
          init.body = (req.body as Buffer).toString('utf8');
        }
        const request = new Request(url, init);
        const response = await auth.handler(request);
        reply.status(response.status);
        // Set-Cookie is the only multi-value response header better-auth
        // emits; Headers.forEach collapses it to a comma-joined string,
        // which breaks browser parsing once Date commas appear. Send the
        // array separately and skip set-cookie in the generic loop.
        const setCookies = response.headers.getSetCookie();
        if (setCookies.length > 0) reply.header('set-cookie', setCookies);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') return;
          reply.header(key, value);
        });
        const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
        return reply.send(body);
      },
    });
  });
};

const originFromRequest = (req: FastifyRequest): string => {
  // Use the inbound host so cookies bind correctly across localhost vs
  // 127.0.0.1, but pin scheme to http for S-4.1 — local-only, no proxy in
  // front. Phase-6 (Fargate behind ALB) introduces a trustProxy env switch;
  // honoring x-forwarded-proto without that switch lets any client spoof
  // the scheme used in better-auth's CSRF/origin checks.
  const host = req.headers.host ?? 'localhost';
  return `http://${host}`;
};

const toHeaders = (h: FastifyRequest['headers']): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(h)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.append(key, String(value));
    }
  }
  return headers;
};

const methodHasBody = (method: string): boolean => method !== 'GET' && method !== 'HEAD';
