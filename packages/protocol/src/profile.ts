import { z } from 'zod';

export const PROFILE_NAME_MIN = 2;
export const PROFILE_NAME_MAX = 32;

// A rendering rule, not a moderation one. Stacked combining marks make a name
// as tall as a lobby row, and homoglyphs let two names render identically, so
// the allowed set is deliberately narrow. Names are not unique, so nothing
// here pretends to stop impersonation.
const ALLOWED = /^[\p{Letter}\p{Number} _-]+$/u;

/** Trimmed, with runs of whitespace collapsed. Callers get the stored form. */
export const ProfileNameSchema = z
  .string()
  .transform((raw) => raw.trim().replace(/\s+/g, ' '))
  .refine((name) => name.length >= PROFILE_NAME_MIN && name.length <= PROFILE_NAME_MAX, {
    message: `Name must be ${PROFILE_NAME_MIN} to ${PROFILE_NAME_MAX} characters.`,
  })
  .refine((name) => ALLOWED.test(name), {
    message: 'Name may use letters, digits, spaces, hyphens and underscores.',
  });

export type ProfileName = z.infer<typeof ProfileNameSchema>;
