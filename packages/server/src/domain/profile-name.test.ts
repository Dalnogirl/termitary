import { ProfileNameSchema } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import { generateProfileName } from './profile-name.js';

describe('generateProfileName', () => {
  it('joins two words with a hyphen', () => {
    expect(generateProfileName(() => 0)).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('picks by index, so the same draw gives the same name', () => {
    expect(generateProfileName(() => 1)).toBe(generateProfileName(() => 1));
    expect(generateProfileName(() => 0)).not.toBe(generateProfileName(() => 1));
  });

  it('produces a name the schema accepts, whichever words come up', () => {
    for (let i = 0; i < 500; i++) {
      expect(ProfileNameSchema.safeParse(generateProfileName()).success).toBe(true);
    }
  });
});
