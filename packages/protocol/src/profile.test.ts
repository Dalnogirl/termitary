import { describe, expect, it } from 'vitest';
import { ProfileNameSchema } from './profile.js';

const accepts = (raw: string, expected = raw) =>
  expect(ProfileNameSchema.parse(raw)).toBe(expected);
const rejects = (raw: string) => expect(ProfileNameSchema.safeParse(raw).success).toBe(false);

describe('ProfileNameSchema', () => {
  it('accepts an ordinary name', () => {
    accepts('Hleb');
    accepts('brisk-termite');
    accepts('two words');
    accepts('Ольга');
  });

  it('trims and collapses whitespace before measuring', () => {
    accepts('  Hleb  ', 'Hleb');
    accepts('two   words', 'two words');
    accepts(`${'a'.repeat(32)}  `, 'a'.repeat(32));
  });

  it('rejects a name outside 2 to 32 characters', () => {
    rejects('');
    rejects('   ');
    rejects('a');
    rejects('a'.repeat(33));
  });

  it('rejects what would not render as a name', () => {
    rejects('​');
    rejects('🐜');
    rejects('á'.repeat(16));
    rejects('Hleb‮');
    rejects('semi;colon');
  });
});
