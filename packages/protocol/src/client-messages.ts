import { z } from 'zod';
import { WireMoveSchema } from './wire.js';

export const ClientCreateGameSchema = z.object({ type: z.literal('createGame') }).strict();
export type ClientCreateGame = z.infer<typeof ClientCreateGameSchema>;

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

export const ClientLeaveGameSchema = z
  .object({ type: z.literal('leaveGame'), roomId: z.string().min(1) })
  .strict();
export type ClientLeaveGame = z.infer<typeof ClientLeaveGameSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  ClientCreateGameSchema,
  ClientJoinGameSchema,
  ClientMakeMoveSchema,
  ClientLeaveGameSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ClientMessageKind = ClientMessage['type'];
