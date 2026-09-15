import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './keyset-cursor.js';

describe('keyset cursors', () => {
  it('round-trips the row it was cut from', () => {
    const cursor = { at: new Date(1738368000000), id: 'r1' };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('survives an id carrying the characters base64url escapes', () => {
    const cursor = { at: new Date(0), id: 'a+b/c=' };

    expect(encodeCursor(cursor)).not.toMatch(/[+/=]/);
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['not base64 at all', 'not-a-cursor'],
    ['a single field', Buffer.from('1000').toString('base64url')],
    ['more fields than it has', Buffer.from('1000|r1|extra').toString('base64url')],
    ['an empty id', Buffer.from('1000|').toString('base64url')],
    ['a timestamp that is not a number', Buffer.from('soon|r1').toString('base64url')],
    ['a timestamp past the safe range', Buffer.from('1e400|r1').toString('base64url')],
  ])('rejects %s', (_, raw) => {
    expect(decodeCursor(raw)).toBeUndefined();
  });
});
