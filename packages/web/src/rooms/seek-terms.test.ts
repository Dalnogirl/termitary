import type { SeekPreference } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import { acceptedRulesets, choiceFor, seekBadges, withChoice } from './seek-terms.js';

describe('withChoice', () => {
  it('drops the key for either, so the default seek stays {}', () => {
    const preference = withChoice({ ladybug: 'require' }, 'ladybug', 'either');
    expect(preference).toEqual({});
    expect('ladybug' in preference).toBe(false);
  });

  it('sets require and exclude without touching the other pieces', () => {
    const preference = withChoice({ mosquito: 'exclude' }, 'ladybug', 'require');
    expect(preference).toEqual({ ladybug: 'require', mosquito: 'exclude' });
  });

  it('round-trips through choiceFor', () => {
    expect(choiceFor(withChoice({}, 'pillbug', 'exclude'), 'pillbug')).toBe('exclude');
    expect(choiceFor({}, 'pillbug')).toBe('either');
  });
});

describe('acceptedRulesets', () => {
  it.each<[SeekPreference, number]>([
    [{}, 8],
    [{ ladybug: 'require' }, 4],
    [{ ladybug: 'require', mosquito: 'exclude' }, 2],
    [{ ladybug: 'exclude', mosquito: 'exclude', pillbug: 'exclude' }, 1],
  ])('%j accepts %i', (preference, count) => {
    expect(acceptedRulesets(preference)).toBe(count);
  });
});

describe('seekBadges', () => {
  it('has none for a seek with no opinions', () => {
    expect(seekBadges({})).toEqual([]);
  });

  it('names a required piece and negates an excluded one, in expansion order', () => {
    expect(seekBadges({ pillbug: 'exclude', ladybug: 'require' })).toEqual([
      'Ladybug',
      'No pillbug',
    ]);
  });
});
