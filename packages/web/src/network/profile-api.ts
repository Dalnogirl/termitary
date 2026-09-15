import type { ProfileDto, UpdateProfileRequestDto } from '@termitary/protocol';
import { getApiUrl } from './url.js';

// Null is "no such player", which the page renders rather than throws, the way
// a missing archived game does.
export const fetchProfile = async (userId: string): Promise<ProfileDto | null> => {
  const path = `/users/${encodeURIComponent(userId)}`;
  const res = await fetch(`${getApiUrl()}${path}`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
  return (await res.json()) as ProfileDto;
};

/**
 * A 400 carries the schema's own message, which is the copy the form shows, so
 * it is thrown as the error text rather than replaced with a status line.
 */
export const updateProfileName = async (name: string): Promise<ProfileDto> => {
  const body: UpdateProfileRequestDto = { name };
  const res = await fetch(`${getApiUrl()}/profile`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    const { error } = (await res.json()) as { error?: string };
    throw new Error(error ?? 'That name was rejected.');
  }
  if (!res.ok) throw new Error(`PATCH /profile returned ${res.status}`);
  return (await res.json()) as ProfileDto;
};
