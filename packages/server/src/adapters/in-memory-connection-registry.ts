import type { ServerMessage } from '@hive/protocol';
import type { ConnectionRegistry, Sender } from '../domain/connection-registry.js';

export type InMemoryConnectionRegistry = ConnectionRegistry & {
  bind(playerId: string, sender: Sender): void;
  unbind(playerId: string): void;
};

export const createInMemoryConnectionRegistry = (): InMemoryConnectionRegistry => {
  const senders = new Map<string, Sender>();
  const playerRoom = new Map<string, string>();
  const roomPlayers = new Map<string, Set<string>>();

  const removeFromRoom = (playerId: string): void => {
    const roomId = playerRoom.get(playerId);
    if (roomId === undefined) return;
    playerRoom.delete(playerId);
    const set = roomPlayers.get(roomId);
    if (set === undefined) return;
    set.delete(playerId);
    if (set.size === 0) roomPlayers.delete(roomId);
  };

  const dispatch = async (playerId: string, msg: ServerMessage): Promise<void> => {
    const send = senders.get(playerId);
    if (send !== undefined) await send(msg);
  };

  return {
    bind(playerId, sender) {
      senders.set(playerId, sender);
    },
    unbind(playerId) {
      senders.delete(playerId);
      removeFromRoom(playerId);
    },
    joinRoom: async (playerId, roomId) => {
      removeFromRoom(playerId);
      playerRoom.set(playerId, roomId);
      let set = roomPlayers.get(roomId);
      if (set === undefined) {
        set = new Set();
        roomPlayers.set(roomId, set);
      }
      set.add(playerId);
    },
    leaveRoom: async (playerId) => {
      removeFromRoom(playerId);
    },
    sendTo: async (playerId, msg) => {
      await dispatch(playerId, msg);
    },
    broadcast: async (roomId, msg) => {
      const set = roomPlayers.get(roomId);
      if (set === undefined) return;
      await Promise.all([...set].map((pid) => dispatch(pid, msg)));
    },
  };
};
