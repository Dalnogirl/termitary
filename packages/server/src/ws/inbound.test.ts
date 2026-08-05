import { describe, expect, it } from 'vitest';
import { parseInbound } from './inbound.js';

describe('parseInbound', () => {
  it('returns the parsed message on valid input', () => {
    const result = parseInbound(JSON.stringify({ type: 'joinGame', roomId: 'r1' }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.message.type).toBe('joinGame');
  });

  it('flags invalid JSON', () => {
    const result = parseInbound('not json');
    expect(result).toEqual({ ok: false, error: 'invalid JSON' });
  });

  it('flags schema violations', () => {
    const result = parseInbound(JSON.stringify({ type: 'unknown' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('accepts Buffer input', () => {
    const result = parseInbound(Buffer.from(JSON.stringify({ type: 'joinGame', roomId: 'r1' })));
    expect(result.ok).toBe(true);
  });
});
