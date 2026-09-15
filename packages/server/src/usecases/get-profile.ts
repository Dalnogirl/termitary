import type { PlayerRecordDto, ProfileDto } from '@termitary/protocol';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import { type PlayerRecord, computeRecord } from '../domain/player-record.js';
import type { UserStore } from '../domain/user-store.js';

export type ProfilePorts = {
  readonly users: UserStore;
  readonly archive: ArchivedGameStore;
};

const toRecordDto = (record: PlayerRecord): PlayerRecordDto => ({
  ...record,
  lastPlayedAt: record.lastPlayedAt?.getTime() ?? null,
});

/** Undefined for an account that never existed and one that is gone; both are a 404. */
export const getProfile = async (
  userId: string,
  { users, archive }: ProfilePorts,
): Promise<ProfileDto | undefined> => {
  const profile = await users.get(userId);
  if (profile === null) return undefined;
  const outcomes = await archive.outcomesForPlayer(userId);
  return {
    userId: profile.userId,
    name: profile.name,
    memberSince: profile.createdAt.getTime(),
    record: toRecordDto(computeRecord(outcomes)),
  };
};
