import { pino } from 'pino';
import { env } from '../env.js';

// Pretty output is dev-only; production emits JSON for a collector to parse.
// `colorize` is explicit because pino-pretty defaults it to "stdout is a TTY",
// and `pnpm dev` pipes every child through pnpm, so it never is.
const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname,reqId,method,url,status,ms',
    singleLine: true,
  },
};

export const log = pino({
  ...(env.nodeEnv === 'development' ? { transport: devTransport } : {}),
});
