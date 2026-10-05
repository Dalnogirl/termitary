import {
  type Clock,
  type TimeControl,
  clockDefect,
  remaining,
  timeControlOf,
} from '@termitary/clock';
import { z } from 'zod';

const WireSideSchema = z.enum(['white', 'black']);

const UntimedSchema = z.object({ kind: z.literal('untimed') }).strict();
const CorrespondenceSchema = z
  .object({ kind: z.literal('correspondence'), daysPerMove: z.union([z.literal(1), z.literal(3)]) })
  .strict();
const RealtimeSchema = z
  .object({
    kind: z.literal('realtime'),
    initialMs: z.number().int().positive(),
    incrementMs: z.number().int().nonnegative(),
  })
  .strict();

export const WireTimeControlSchema = z.discriminatedUnion('kind', [
  UntimedSchema,
  CorrespondenceSchema,
  RealtimeSchema,
]);
export type WireTimeControl = z.infer<typeof WireTimeControlSchema>;

const clockCommon = {
  phase: z.enum(['pre_start', 'running']),
  toMove: WireSideSchema,
  turnStartedAt: z.number().int(),
  log: z.array(z.object({ side: WireSideSchema, remainingMs: z.number().int() }).strict()),
};

// A stored clock. Structure alone admits clocks no sequence of charges could
// produce, so the parse ends in the clock's own invariant check.
export const WireClockSchema = z
  .discriminatedUnion('kind', [
    UntimedSchema.extend(clockCommon),
    CorrespondenceSchema.extend(clockCommon),
    RealtimeSchema.extend({
      ...clockCommon,
      bankMs: z.object({ white: z.number().int(), black: z.number().int() }).strict(),
    }),
  ])
  .superRefine((clock, ctx) => {
    const defect = clockDefect(clock);
    if (defect !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: defect });
  });
export type WireClock = z.infer<typeof WireClockSchema>;

/**
 * Both sides' time as of one instant. Null for an untimed game, which has no
 * time to show.
 */
export const WireClockReadingSchema = z
  .object({
    timeControl: WireTimeControlSchema,
    remainingMs: z.object({ white: z.number(), black: z.number() }).strict().nullable(),
  })
  .strict();
export type WireClockReading = z.infer<typeof WireClockReadingSchema>;

export const toWireClock = (clock: Clock): WireClock => ({ ...clock, log: [...clock.log] });

export const toWireTimeControl = (control: TimeControl): WireTimeControl => ({ ...control });

export const readClock = (clock: Clock, now: number): WireClockReading => ({
  timeControl: toWireTimeControl(timeControlOf(clock)),
  remainingMs:
    clock.kind === 'untimed'
      ? null
      : { white: remaining(clock, 'white', now), black: remaining(clock, 'black', now) },
});
