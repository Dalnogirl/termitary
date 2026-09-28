import { z } from 'zod';
import { WireGameStateSchema } from './wire.js';

const PlayerColorSchema = z.enum(['white', 'black']);

// The player in the other seat, present or not. Every room is born with both
// seats filled, so there is always one. `userId` addresses their profile;
// names are not unique, so the name alone cannot.
export const OpponentPresenceSchema = z
  .object({
    status: z.enum(['connected', 'disconnected']),
    userId: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();
export type OpponentPresence = z.infer<typeof OpponentPresenceSchema>;

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
    opponent: OpponentPresenceSchema,
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

export const ServerPresenceUpdateSchema = z
  .object({
    type: z.literal('presenceUpdate'),
    roomId: z.string().min(1),
    opponent: OpponentPresenceSchema,
  })
  .strict();
export type ServerPresenceUpdate = z.infer<typeof ServerPresenceUpdateSchema>;

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
  ServerPresenceUpdateSchema,
  ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
