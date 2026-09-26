import { z } from 'zod';

const ExpansionChoiceSchema = z.enum(['require', 'exclude']);
export type ExpansionChoice = z.infer<typeof ExpansionChoiceSchema>;

/**
 * What a seeker will accept, one entry per expansion they had an opinion
 * about. An absent key is "either", so `{}` is the default seek and a row
 * stored before a new expansion existed reads as accepting it either way.
 *
 * The keys are spelled out rather than built from the engine's
 * `EXPANSION_PIECES`, because a zod object built over a loop loses the
 * per-key types. `seek-preference.test.ts` holds the two in step.
 */
export const SeekPreferenceSchema = z
  .object({
    ladybug: ExpansionChoiceSchema.optional(),
    mosquito: ExpansionChoiceSchema.optional(),
    pillbug: ExpansionChoiceSchema.optional(),
  })
  .strict();

export type SeekPreference = z.infer<typeof SeekPreferenceSchema>;

export const ANY_GAME: SeekPreference = {};
