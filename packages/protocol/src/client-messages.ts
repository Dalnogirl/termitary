import { z } from 'zod';

export const ClientPingSchema = z
  .object({
    type: z.literal('ping'),
  })
  .strict();
export type ClientPing = z.infer<typeof ClientPingSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [ClientPingSchema]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
