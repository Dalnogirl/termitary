import { type ServerStateUpdated, readClock, toWire } from '@termitary/protocol';
import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Room } from '../domain/room.js';

export const stateUpdate = (room: Room, now: Date): ServerStateUpdated => ({
  type: 'stateUpdated',
  roomId: room.id,
  state: toWire(room.state),
  clock: readClock(room.clock, now.getTime()),
});

export const broadcastState = (connections: ConnectionRegistry, room: Room, now: Date) =>
  connections.broadcast(room.id, stateUpdate(room, now));
