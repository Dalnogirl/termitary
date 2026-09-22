import { EXPANSION_PIECES } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { ANY_GAME, type SeekPreference, SeekPreferenceSchema } from './seek-preference.js';

// Three choices per expansion, so the whole space is 27 preferences. Small
// enough to assert over exhaustively rather than sample.
const ALL_PREFERENCES: readonly SeekPreference[] = (() => {
  let preferences: SeekPreference[] = [{}];
  for (const piece of EXPANSION_PIECES) {
    preferences = preferences.flatMap((base) => [
      base,
      { ...base, [piece]: 'require' },
      { ...base, [piece]: 'exclude' },
    ]);
  }
  return preferences;
})();

describe('the preference space', () => {
  it('has 27 members', () => {
    expect(ALL_PREFERENCES).toHaveLength(27);
    expect(new Set(ALL_PREFERENCES.map((p) => JSON.stringify(p))).size).toBe(27);
  });

  // The schema spells its keys out, so this is what catches an expansion
  // added to the engine and never given a preference key.
  it('is what the schema accepts', () => {
    for (const preference of ALL_PREFERENCES) {
      expect(SeekPreferenceSchema.parse(preference)).toEqual(preference);
    }
  });

  it('rejects a choice the control cannot produce', () => {
    expect(SeekPreferenceSchema.safeParse({ ladybug: 'either' }).success).toBe(false);
    expect(SeekPreferenceSchema.safeParse({ queen: 'require' }).success).toBe(false);
  });

  it('takes the default seek', () => {
    expect(SeekPreferenceSchema.parse(ANY_GAME)).toEqual({});
  });
});
