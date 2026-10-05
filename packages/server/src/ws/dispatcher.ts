import type { ClientMessage } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { claimTimeout } from '../usecases/claim-timeout.js';
import { joinGame } from '../usecases/join-game.js';
import { makeMove } from '../usecases/make-move.js';
import { resign } from '../usecases/resign.js';

export const dispatchClientMessage = (
  identity: Identity,
  msg: ClientMessage,
  ports: Ports,
): Promise<void> => {
  switch (msg.type) {
    case 'joinGame':
      return joinGame(identity, msg, ports);
    case 'makeMove':
      return makeMove(identity, msg, ports);
    case 'resign':
      return resign(identity, msg, ports);
    case 'claimTimeout':
      return claimTimeout(identity, msg, ports);
    default: {
      const _exhaustive: never = msg;
      throw new Error(`unhandled client message: ${JSON.stringify(_exhaustive)}`);
    }
  }
};
