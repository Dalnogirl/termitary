import type {
  PostSeekRequestDto,
  PostSeekResponseDto,
  SeekBoardDto,
  SeekPreference,
} from '@termitary/protocol';
import { getApiUrl } from './url.js';

// The server's 409 codes, as the copy a toast shows. A code missing here falls
// back to the status line.
const REFUSALS: Readonly<Record<string, string>> = {
  'seek-gone': 'Someone else took that game first.',
  'seek-incompatible': 'That seek wants different pieces.',
  'seek-own': 'That one is your own seek.',
};

export const fetchSeekBoard = async (): Promise<SeekBoardDto> => {
  const res = await fetch(`${getApiUrl()}/seeks`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /seeks returned ${res.status}`);
  return (await res.json()) as SeekBoardDto;
};

const postSeek = async (body: PostSeekRequestDto): Promise<PostSeekResponseDto> => {
  const res = await fetch(`${getApiUrl()}/seeks`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const { error } = (await res.json()) as { error?: string };
    throw new Error(REFUSALS[error ?? ''] ?? 'POST /seeks returned 409');
  }
  if (!res.ok) throw new Error(`POST /seeks returned ${res.status}`);
  return (await res.json()) as PostSeekResponseDto;
};

/** Pairs with the first compatible seek on the board, or stands one there. */
export const seekGame = (preference: SeekPreference): Promise<PostSeekResponseDto> =>
  postSeek({ preference });

// No preference: clicking a listing is agreeing to its terms, so the options
// disclosure has no say and the claim cannot come back incompatible.
export const claimSeek = (seekId: string): Promise<PostSeekResponseDto> => postSeek({ seekId });

/**
 * `gone` is a 404: the seek paired or expired before the cancel reached it, so
 * the lobby still has to look for the game it may have become.
 */
export const cancelSeek = async (seekId: string): Promise<'cancelled' | 'gone'> => {
  const path = `/seeks/${encodeURIComponent(seekId)}`;
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE', credentials: 'include' });
  if (res.status === 404) return 'gone';
  if (!res.ok) throw new Error(`DELETE ${path} returned ${res.status}`);
  return 'cancelled';
};
