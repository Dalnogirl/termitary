import { readClock, toWire } from '@termitary/protocol';
import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Room } from '../domain/room.js';

export const broadcastState = (connections: ConnectionRegistry, room: Room, now: Date) =>
  connections.broadcast(room.id, {
    type: 'stateUpdated',
    roomId: room.id,
    state: toWire(room.state),
    clock: readClock(room.clock, now.getTime()),
  });
