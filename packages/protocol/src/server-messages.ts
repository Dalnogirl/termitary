import { z } from 'zod';
import { WireGameStateSchema } from './wire.js';

const PlayerColorSchema = z.enum(['white', 'black']);

export const ServerConnectedSchema = z
  .object({ type: z.literal('connected'), playerId: z.string().min(1) })
  .strict();
export type ServerConnected = z.infer<typeof ServerConnectedSchema>;

export const ServerGameJoinedSchema = z
  .object({
    type: z.literal('gameJoined'),
    roomId: z.string().min(1),
    playerColor: PlayerColorSchema,
    state: WireGameStateSchema,
  })
  .strict();
export type ServerGameJoined = z.infer<typeof ServerGameJoinedSchema>;

export const ServerStateUpdatedSchema = z
  .object({
    type: z.literal('stateUpdated'),
    roomId: z.string().min(1),
    state: WireGameStateSchema,
  })
  .strict();
export type ServerStateUpdated = z.infer<typeof ServerStateUpdatedSchema>;

export const ServerErrorSchema = z
  .object({
    type: z.literal('error'),
    message: z.string(),
    requestKind: z.string().optional(),
  })
  .strict();
export type ServerError = z.infer<typeof ServerErrorSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ServerConnectedSchema,
  ServerGameJoinedSchema,
  ServerStateUpdatedSchema,
  ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
