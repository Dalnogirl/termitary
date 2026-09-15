import { z } from 'zod';
import { WireGameStateSchema } from './wire.js';

const PlayerColorSchema = z.enum(['white', 'black']);

// A seated opponent, present or not. `userId` addresses their profile; names
// are not unique, so the name alone cannot.
const SeatedPresenceSchema = z
  .object({
    status: z.enum(['connected', 'disconnected']),
    userId: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

// Snapshot used at join time. Reachable cases:
//   - 'empty'         no opponent seated yet
//   - 'connected'     opponent seated and a live socket is bound to this room
//   - 'disconnected'  opponent seated but no live socket (dropped before re-attach)
const PresenceSnapshotSchema = z.union([
  z.object({ status: z.literal('empty') }).strict(),
  SeatedPresenceSchema,
]);
// Transitions only: a vacancy (empty) is communicated by room teardown,
// not by a presenceUpdate event.
const PresenceEventSchema = SeatedPresenceSchema;
// Client-side type for the local presence field; same shape as the snapshot.
export const OpponentPresenceSchema = PresenceSnapshotSchema;
export type OpponentPresence = z.infer<typeof OpponentPresenceSchema>;
export type SeatedPresence = z.infer<typeof SeatedPresenceSchema>;

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
