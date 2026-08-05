import { z } from 'zod';

export const RoomSummarySchema = z
  .object({
    roomId: z.string().min(1),
    playerCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    status: z.enum(['in_progress', 'finished']),
  })
  .strict();
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const RoomSummaryListSchema = z.array(RoomSummarySchema);
export type RoomSummaryList = z.infer<typeof RoomSummaryListSchema>;
