import type { SeatedPresence } from '@termitary/protocol';
import type { UserStore } from '../domain/user-store.js';

// Shown where a seat is still held but the account behind it is gone. Keeping
// the seat visible matters more than the name: dropping to 'empty' would read
// as a free seat, which the opponent's resign would then be refused against.
const DELETED = 'Deleted player';

/** Presence for a seated player, carrying the id their profile link needs. */
export const seatedPresence = async (
  users: Pick<UserStore, 'namesOf'>,
  userId: string,
  status: SeatedPresence['status'],
): Promise<SeatedPresence> => {
  const names = await users.namesOf([userId]);
  return { status, userId, name: names.get(userId) ?? DELETED };
};
