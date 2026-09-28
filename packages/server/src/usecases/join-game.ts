import type { ClientJoinGame, OpponentPresence } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, playerAcross } from '../domain/room.js';
import type { UserStore } from '../domain/user-store.js';
import { answerMissingRoom } from './answer-missing-room.js';
import { seatedPresence } from './seated-presence.js';
import { sendError } from './send-error.js';

// Computes the snapshot presence of `opponentId` for inclusion in
// gameJoined: 'connected' iff the registry has the opponent bound to THIS room.
// Anything else — no live socket, or theoretically a socket bound to a
// different room during a race — is reported as 'disconnected', since
// from the joiner's POV the opponent is functionally absent from here.
const presenceOf = async (
  connections: ConnectionRegistry,
  users: UserStore,
  opponentId: string,
  roomId: string,
): Promise<OpponentPresence> => {
  const bound = await connections.findRoomByPlayerId(opponentId);
  return seatedPresence(users, opponentId, bound === roomId ? 'connected' : 'disconnected');
};

// Rooms are born with both seats filled, so a player who holds neither has no
// way in.
export const joinGame = async (
  identity: Identity,
  msg: ClientJoinGame,
  ports: Ports,
): Promise<void> => {
  const { rooms, connections, users } = ports;
  const room = await rooms.get(msg.roomId);
  if (room === undefined) {
    await answerMissingRoom(identity, msg.roomId, 'joinGame', ports);
    return;
  }

  const color = colorOf(room, identity.playerId);
  if (color === undefined) {
    await sendError(connections, identity, 'room is full', 'joinGame');
    return;
  }

  // Re-attach: route remount, reconnect, or the first visit after pairing.
  await connections.joinRoom(identity.playerId, room.id);
  // Re-fetch right before send: the awaits above yield, so a move can land in
  // between, and gameJoined must carry current state.
  const fresh = (await rooms.get(room.id)) ?? room;
  const opponent = playerAcross(fresh, color);
  const opponentPresence = await presenceOf(connections, users, opponent.playerId, fresh.id);
  await connections.sendTo(identity.playerId, {
    type: 'gameJoined',
    roomId: fresh.id,
    playerColor: color,
    state: toWire(fresh.state),
    opponent: opponentPresence,
  });
  await connections.sendTo(opponent.playerId, {
    type: 'presenceUpdate',
    roomId: fresh.id,
    opponent: await seatedPresence(users, identity.playerId, 'connected'),
  });
};
