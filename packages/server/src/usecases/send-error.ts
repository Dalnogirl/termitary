import type { ConnectionRegistry } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';

export const sendError = (
  connections: ConnectionRegistry,
  identity: Identity,
  message: string,
  requestKind?: string,
): Promise<void> =>
  connections.sendTo(
    identity.playerId,
    requestKind === undefined
      ? { type: 'error', message }
      : { type: 'error', message, requestKind },
  );
