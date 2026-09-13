// A checked-in list rather than a dependency: two arrays are smaller than any
// package that would generate them, and these words are chosen to pass
// ProfileNameSchema and to read as a nickname rather than a container id.
const ADJECTIVES = [
  'amber',
  'brisk',
  'clever',
  'dusty',
  'eager',
  'fearless',
  'golden',
  'humble',
  'idle',
  'jolly',
  'keen',
  'lively',
  'mellow',
  'nimble',
  'olive',
  'patient',
  'quiet',
  'rugged',
  'stubborn',
  'tidy',
  'upbeat',
  'velvet',
  'wary',
  'zesty',
] as const;

const NOUNS = [
  'acacia',
  'beetle',
  'chamber',
  'drone',
  'ember',
  'forager',
  'grasshopper',
  'hopper',
  'ladybug',
  'mandible',
  'mound',
  'nymph',
  'pillbug',
  'queen',
  'ranger',
  'soldier',
  'spider',
  'termite',
  'tunnel',
  'worker',
] as const;

export type RandomInt = (exclusiveMax: number) => number;

const defaultRandomInt: RandomInt = (exclusiveMax) => Math.floor(Math.random() * exclusiveMax);

const pick = <T>(words: readonly T[], randomInt: RandomInt): T => {
  const word = words[randomInt(words.length)];
  if (word === undefined) throw new Error('randomInt returned an out-of-range index');
  return word;
};

/**
 * A `brisk-termite` shaped name. Names are not unique, so a collision is not
 * an error and there is nothing to retry.
 */
export const generateProfileName = (randomInt: RandomInt = defaultRandomInt): string =>
  `${pick(ADJECTIVES, randomInt)}-${pick(NOUNS, randomInt)}`;
