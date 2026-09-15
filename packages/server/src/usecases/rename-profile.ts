import { type ProfileDto, ProfileNameSchema } from '@termitary/protocol';
import { z } from 'zod';
import type { Identity } from '../domain/identity.js';
import { type ProfilePorts, getProfile } from './get-profile.js';

export const RenameProfileBodySchema = z.object({ name: ProfileNameSchema });

export type RenameProfileResult =
  | { readonly outcome: 'renamed'; readonly profile: ProfileDto }
  | { readonly outcome: 'gone' };

/**
 * The record is re-read rather than carried over from the rename, so the page
 * that PATCHes gets the same shape it GETs and needs no second request.
 */
export const renameProfile = async (
  identity: Identity,
  name: string,
  ports: ProfilePorts,
): Promise<RenameProfileResult> => {
  const renamed = await ports.users.rename(identity.playerId, name, new Date());
  if (renamed === null) return { outcome: 'gone' };
  const profile = await getProfile(identity.playerId, ports);
  return profile === undefined ? { outcome: 'gone' } : { outcome: 'renamed', profile };
};
