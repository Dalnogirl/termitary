import type { ServerMessage } from '@hive/protocol';

export type Sender = (msg: ServerMessage) => Promise<void>;

export type ConnectionRegistry = {
  joinRoom(playerId: string, roomId: string): Promise<void>;
  leaveRoom(playerId: string): Promise<void>;
  sendTo(playerId: string, msg: ServerMessage): Promise<void>;
  broadcast(roomId: string, msg: ServerMessage): Promise<void>;
};
