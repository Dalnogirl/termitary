import { ConcurrentModificationError } from '../domain/room-store.js';

/**
 * Attempts are cheap and a conflict means another handler committed, so a
 * third loss is contention nobody wins by waiting out: it reaches the client
 * as an error and the socket handler logs it.
 */
export const MAX_SAVE_ATTEMPTS = 3;

/**
 * Re-runs `attempt` when its compare-and-swap loses. Nothing merges: the
 * attempt re-reads the room and re-runs every guard, so a move that has since
 * become out of turn comes back as that rather than overwriting the winner.
 * Anything the attempt sends happens after its own save, so a retry never
 * repeats a broadcast.
 */
export const retryOnConflict = async <T>(attempt: () => Promise<T>): Promise<T> => {
  for (let remaining = MAX_SAVE_ATTEMPTS; ; remaining -= 1) {
    try {
      return await attempt();
    } catch (err) {
      if (remaining <= 1 || !(err instanceof ConcurrentModificationError)) throw err;
    }
  }
};
