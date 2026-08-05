import { z } from 'zod';

export const ServerPongSchema = z
  .object({
    type: z.literal('pong'),
  })
  .strict();
export type ServerPong = z.infer<typeof ServerPongSchema>;

export const ServerErrorSchema = z
  .object({
    type: z.literal('error'),
    message: z.string(),
  })
  .strict();
export type ServerError = z.infer<typeof ServerErrorSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ServerPongSchema,
  ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
