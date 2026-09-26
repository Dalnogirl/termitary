import type { ClientJoinGame, OpponentPresence } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, otherPlayer } from '../domain/room.js';
import type { UserStore } from '../domain/user-store.js';
import { seatedPresence } from './seated-presence.js';
import { sendError } from './send-error.js';

// Computes the snapshot presence of `opponentId` for inclusion in
// gameJoined. Undefined opponentId → 'empty' (no one seated). Otherwise
// 'connected' iff the registry has the opponent bound to THIS room.
// Anything else — no live socket, or theoretically a socket bound to a
// different room during a race — is reported as 'disconnected', since
// from the joiner's POV the opponent is functionally absent from here.
const presenceOf = async (
  connections: ConnectionRegistry,
  users: UserStore,
  opponentId: string | undefined,
  roomId: string,
): Promise<OpponentPresence> => {
  if (opponentId === undefined) return { status: 'empty' };
  const bound = await connections.findRoomByPlayerId(opponentId);
  return seatedPresence(users, opponentId, bound === roomId ? 'connected' : 'disconnected');
};

// Rooms are born with both seats filled, so a player who holds neither has no
// way in.
export const joinGame = async (
  identity: Identity,
  msg: ClientJoinGame,
  { rooms, connections, users }: Ports,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  if (room === undefined) {
    await sendError(connections, identity, 'room not found', 'joinGame');
    return;
  }

  const color = colorOf(room, identity.playerId);
  if (color === undefined) {
    await sendError(connections, identity, 'room is full', 'joinGame');
    return;
  }

  // Re-attach: route remount, reconnect, or the first visit after pairing.
  await connections.joinRoom(identity.playerId, room.id);
  // Re-fetch right before send: in Phase 8 (DDB adapter) the awaits above
  // yield to other I/O, so the room snapshot from this handler's start may
  // be stale by now. In-memory adapter is single-task so this is currently
  // a no-op, but the protocol semantic "gameJoined carries current state"
  // is enforced here.
  const fresh = (await rooms.get(room.id)) ?? room;
  const opponent = otherPlayer(fresh, identity.playerId);
  const opponentPresence = await presenceOf(connections, users, opponent?.playerId, fresh.id);
  await connections.sendTo(identity.playerId, {
    type: 'gameJoined',
    roomId: fresh.id,
    playerColor: color,
    state: toWire(fresh.state),
    opponent: opponentPresence,
  });
  if (opponent !== undefined) {
    await connections.sendTo(opponent.playerId, {
      type: 'presenceUpdate',
      roomId: fresh.id,
      opponent: await seatedPresence(users, identity.playerId, 'connected'),
    });
  }
};
