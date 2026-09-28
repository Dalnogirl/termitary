import type { OpponentPresence } from '@termitary/protocol';
import type { UserStore } from '../domain/user-store.js';

// Shown where a seat is still held but the account behind it is gone.
const DELETED = 'Deleted player';

/** Presence for a seated player, carrying the id their profile link needs. */
export const seatedPresence = async (
  users: Pick<UserStore, 'namesOf'>,
  userId: string,
  status: OpponentPresence['status'],
): Promise<OpponentPresence> => {
  const names = await users.namesOf([userId]);
  return { status, userId, name: names.get(userId) ?? DELETED };
};
