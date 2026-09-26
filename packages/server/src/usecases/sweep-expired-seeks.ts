import type { Ports } from '../domain/ports.js';

export type SeekSweepPorts = Pick<Ports, 'seeks'>;

// Nothing to archive and no state to parse: an unpaired seek is five columns
// and a player who never got a game, so it leaves as a plain delete.
export const sweepExpiredSeeks = async (
  { seeks }: SeekSweepPorts,
  now: Date = new Date(),
): Promise<number> => seeks.deleteExpiredBefore(now);
