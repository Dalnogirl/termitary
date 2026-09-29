import type { Ports } from '../domain/ports.js';
import { otherPlayer } from '../domain/room.js';
import { seatedPresence } from './seated-presence.js';

export const announceDisconnect = async (playerId: string, ports: Ports): Promise<void> => {
  const roomId = await ports.connections.findRoomByPlayerId(playerId);
  if (roomId === undefined) return;
  const room = await ports.rooms.get(roomId);
  if (room === undefined) return;
  const opp = otherPlayer(room, playerId);
  if (opp === undefined) return;
  await ports.connections.sendTo(opp.playerId, {
    type: 'presenceUpdate',
    roomId,
    opponent: await seatedPresence(ports.users, playerId, 'disconnected'),
  });
};
