import type { ClientJoinGame, OpponentPresence } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, isFull, otherPlayer, seatPlayer, touch } from '../domain/room.js';
import type { UserStore } from '../domain/user-store.js';
import { retryOnConflict } from './retry-on-conflict.js';
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

export const joinGame = (identity: Identity, msg: ClientJoinGame, ports: Ports): Promise<void> =>
  retryOnConflict(() => attemptJoin(identity, msg, ports));

const attemptJoin = async (
  identity: Identity,
  msg: ClientJoinGame,
  { rooms, connections, users }: Ports,
): Promise<void> => {
  const current = await rooms.getForUpdate(msg.roomId);
  if (current === undefined) {
    await sendError(connections, identity, 'room not found', 'joinGame');
    return;
  }
  const { value: room, version } = current;

  const existingColor = colorOf(room, identity.playerId);
  if (existingColor !== undefined) {
    // Re-attach: the same player is rejoining (route remount, reconnect,
    // or "Play online" → /play navigation). Re-bind the connection to the
    // room and notify the opponent that we are back.
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
      playerColor: existingColor,
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
    return;
  }

  if (isFull(room)) {
    await sendError(connections, identity, 'room is full', 'joinGame');
    return;
  }

  const updated = touch(seatPlayer(room, identity), new Date());
  await rooms.save(updated, version);
  await connections.joinRoom(identity.playerId, updated.id);

  const color = colorOf(updated, identity.playerId);
  if (color === undefined) {
    throw new Error('invariant: just-seated player has no color');
  }

  const wireState = toWire(updated.state);
  const opponent = otherPlayer(updated, identity.playerId);
  const opponentPresence = await presenceOf(connections, users, opponent?.playerId, updated.id);
  await connections.sendTo(identity.playerId, {
    type: 'gameJoined',
    roomId: updated.id,
    playerColor: color,
    state: wireState,
    opponent: opponentPresence,
  });

  if (opponent !== undefined) {
    // allSettled: state and presence are independent channels. A failure
    // delivering one must not block the other — particularly important
    // because a dropped opponent socket will surface as a sendTo failure
    // here, but the opponent's own close handler will run shortly and
    // self-heal the joiner's presence view via presenceUpdate. The name
    // lookup belongs inside for the same reason: it can only cost the
    // presence message, never the state the opponent's board needs.
    await Promise.allSettled([
      connections.sendTo(opponent.playerId, {
        type: 'stateUpdated',
        roomId: updated.id,
        state: wireState,
      }),
      seatedPresence(users, identity.playerId, 'connected').then((joiner) =>
        connections.sendTo(opponent.playerId, {
          type: 'presenceUpdate',
          roomId: updated.id,
          opponent: joiner,
        }),
      ),
    ]);
  }
};
