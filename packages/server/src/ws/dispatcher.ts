import type { ClientMessage } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { createGame, joinGame, leaveGame, makeMove } from '../usecases/index.js';

export const dispatchClientMessage = (
  identity: Identity,
  msg: ClientMessage,
  ports: Ports,
): Promise<void> => {
  switch (msg.type) {
    case 'createGame':
      return createGame(identity, msg, ports);
    case 'joinGame':
      return joinGame(identity, msg, ports);
    case 'makeMove':
      return makeMove(identity, msg, ports);
    case 'leaveGame':
      return leaveGame(identity, msg, ports);
    default: {
      const _exhaustive: never = msg;
      throw new Error(`unhandled client message: ${JSON.stringify(_exhaustive)}`);
    }
  }
};
