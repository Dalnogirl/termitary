import type { FastifyBaseLogger } from 'fastify';
import { type SeekSweepPorts, sweepExpiredSeeks } from './usecases/sweep-expired-seeks.js';

const sweepAndLog = (log: FastifyBaseLogger, ports: SeekSweepPorts): void => {
  void sweepExpiredSeeks(ports)
    .then((removed) => {
      if (removed > 0) log.info({ removed }, 'swept expired seeks');
    })
    .catch((err: unknown) => log.error({ err }, 'seek sweep failed'));
};

export const startSeekSweep = (
  log: FastifyBaseLogger,
  ports: SeekSweepPorts,
  intervalMs: number,
): NodeJS.Timeout | undefined => {
  if (intervalMs <= 0) return undefined;
  sweepAndLog(log, ports);
  // unref'd so the timer never holds the process open; onClose clears it.
  return setInterval(() => sweepAndLog(log, ports), intervalMs).unref();
};
