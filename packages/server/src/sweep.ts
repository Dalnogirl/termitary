import type { FastifyBaseLogger } from 'fastify';
import { type SeekSweepPorts, sweepExpiredSeeks } from './usecases/sweep-expired-seeks.js';
import { type RoomSweepPorts, sweepTimedOutRooms } from './usecases/sweep-timed-out-rooms.js';

type SweepPorts = SeekSweepPorts & RoomSweepPorts;

const sweepAndLog = (log: FastifyBaseLogger, ports: SweepPorts): void => {
  void sweepExpiredSeeks(ports)
    .then((removed) => {
      if (removed > 0) log.info({ removed }, 'swept expired seeks');
    })
    .catch((err: unknown) => log.error({ err }, 'seek sweep failed'));
  void sweepTimedOutRooms(ports)
    .then((finished) => {
      if (finished > 0) log.info({ finished }, 'finished games out of time');
    })
    .catch((err: unknown) => log.error({ err }, 'timeout sweep failed'));
};

export const startSweep = (
  log: FastifyBaseLogger,
  ports: SweepPorts,
  intervalMs: number,
): NodeJS.Timeout | undefined => {
  if (intervalMs <= 0) return undefined;
  sweepAndLog(log, ports);
  // unref'd so the timer never holds the process open; onClose clears it.
  return setInterval(() => sweepAndLog(log, ports), intervalMs).unref();
};
