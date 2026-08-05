import { z } from 'zod';
import { WireGameStateSchema } from './wire.js';

const PlayerColorSchema = z.enum(['white', 'black']);

// Snapshot used at join time. Reachable values:
//   - 'empty'         no opponent seated yet
//   - 'connected'     opponent seated and a live socket is bound to this room
//   - 'disconnected'  opponent seated but no live socket (dropped before re-attach)
const PresenceSnapshotSchema = z.enum(['empty', 'connected', 'disconnected']);
// Transitions only: a vacancy (empty) is communicated by room teardown,
// not by a presenceUpdate event.
const PresenceEventSchema = z.enum(['connected', 'disconnected']);
// Client-side type for the local presence field; same shape as the snapshot.
export const OpponentPresenceSchema = PresenceSnapshotSchema;
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
    opponent: PresenceSnapshotSchema,
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
    opponent: PresenceEventSchema,
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
