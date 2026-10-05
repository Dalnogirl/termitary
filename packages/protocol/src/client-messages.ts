import { z } from 'zod';
import { WireMoveSchema } from './wire.js';

export const ClientJoinGameSchema = z
  .object({ type: z.literal('joinGame'), roomId: z.string().min(1) })
  .strict();
export type ClientJoinGame = z.infer<typeof ClientJoinGameSchema>;

export const ClientMakeMoveSchema = z
  .object({
    type: z.literal('makeMove'),
    roomId: z.string().min(1),
    move: WireMoveSchema,
  })
  .strict();
export type ClientMakeMove = z.infer<typeof ClientMakeMoveSchema>;

export const ClientResignSchema = z
  .object({ type: z.literal('resign'), roomId: z.string().min(1) })
  .strict();
export type ClientResign = z.infer<typeof ClientResignSchema>;

// Sent by the waiting player when the opponent's clock reads zero. The server
// judges it against its own clock, not the client's.
export const ClientClaimTimeoutSchema = z
  .object({ type: z.literal('claimTimeout'), roomId: z.string().min(1) })
  .strict();
export type ClientClaimTimeout = z.infer<typeof ClientClaimTimeoutSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  ClientJoinGameSchema,
  ClientMakeMoveSchema,
  ClientResignSchema,
  ClientClaimTimeoutSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ClientMessageKind = ClientMessage['type'];
