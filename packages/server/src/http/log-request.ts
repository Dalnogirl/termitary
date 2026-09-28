import type { FastifyReply, FastifyRequest } from 'fastify';

// Status picks the level so pino-pretty colours the line: 2xx green, 4xx
// yellow, 5xx red. The fields repeat the message so JSON output stays queryable
// and the pretty transport ignores them.
export const logRequest = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const status = reply.statusCode;
  const ms = Math.round(reply.elapsedTime * 10) / 10;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  req.log[level](
    { method: req.method, url: req.url, status, ms },
    `${req.method} ${req.url} ${status} ${ms}ms`,
  );
};
