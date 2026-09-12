import type { ServerMessage } from '@hive/protocol';

export type Sender = (msg: ServerMessage) => Promise<void>;

export type ConnectionRegistry = {
  joinRoom(playerId: string, roomId: string): Promise<void>;
  leaveRoom(playerId: string): Promise<void>;
  sendTo(playerId: string, msg: ServerMessage): Promise<void>;
  broadcast(roomId: string, msg: ServerMessage): Promise<void>;
  // Returns the room a player is currently bound to via a live socket
  // (i.e. presence, not seat). Undefined if the player has no live
  // connection or has not joined any room. Used by socket-close to
  // notify the opponent before unbinding.
  findRoomByPlayerId(playerId: string): Promise<string | undefined>;
};

export type ConnectionLifecycle = {
  bind(playerId: string, sender: Sender): void;
  // Both take the sender the caller bound, not just the player: a reload can
  // open the replacement socket before the old one's close handler runs, and
  // the superseded socket must not answer for, or tear down, the live one.
  isBound(playerId: string, sender: Sender): boolean;
  unbind(playerId: string, sender: Sender): void;
};
