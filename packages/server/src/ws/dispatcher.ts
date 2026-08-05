import type { ClientMessage } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import {
  handleCreateGame,
  handleJoinGame,
  handleLeaveGame,
  handleMakeMove,
} from '../handlers/index.js';

export const dispatchClientMessage = (
  identity: Identity,
  msg: ClientMessage,
  ports: Ports,
): Promise<void> => {
  switch (msg.type) {
    case 'createGame':
      return handleCreateGame(identity, msg, ports);
    case 'joinGame':
      return handleJoinGame(identity, msg, ports);
    case 'makeMove':
      return handleMakeMove(identity, msg, ports);
    case 'leaveGame':
      return handleLeaveGame(identity, msg, ports);
    default: {
      const _exhaustive: never = msg;
      throw new Error(`unhandled client message: ${JSON.stringify(_exhaustive)}`);
    }
  }
};
