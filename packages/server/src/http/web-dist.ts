import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

// Resolved from this module rather than the working directory, which a process
// supervisor owns and we do not.
export const WEB_DIST = fileURLToPath(new URL('../../../web/dist/', import.meta.url));

// Every API route lives under /api, so one prefix is the whole exclusion and
// anything else is an SPA deep link. Without it the URL alone cannot say
// whether /archived-games/:id means the API's route or react-router's.
const isApiPath = (path: string): boolean =>
  path === '/api' || path.startsWith('/api/') || path === '/ws';

// Static had its chance already, so a path naming a file is a missing asset
// rather than a deep link. A tab left open across a redeploy asks for a chunk
// that is gone, and a page in its place is an HTML parse error where a 404
// would have said what happened.
const namesAFile = (path: string): boolean => path.slice(path.lastIndexOf('/')).includes('.');

/**
 * The built SPA, on the same origin as the API. That is what makes the session
 * cookie a same-origin cookie, and why nothing here configures CORS.
 *
 * A checkout that has never run `pnpm build` has no dist, which is the normal
 * state under `pnpm dev` and never acceptable in production.
 */
export const serveWebDist = async (app: FastifyInstance, root: string): Promise<void> => {
  if (!existsSync(root)) {
    if (env.nodeEnv === 'production') {
      throw new Error(`No web bundle at ${root}. Run \`pnpm build\` before booting.`);
    }
    app.log.info({ dir: root }, 'no web bundle; serving the API alone');
    return;
  }

  await app.register(fastifyStatic, { root });
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? '';
    // HEAD as well as GET: @fastify/static answers HEAD for a real file, and an
    // uptime check or a link preview would otherwise see deep links 404.
    const readingAPage = req.method === 'GET' || req.method === 'HEAD';
    if (!readingAPage || isApiPath(path) || namesAFile(path)) {
      return reply.code(404).send({ error: 'not-found' });
    }
    return reply.sendFile('index.html');
  });
};
