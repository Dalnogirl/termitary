import type { MyRoomSummaryDto, RoomSummaryDto } from '@termitary/protocol';
import { getApiUrl } from './url.js';

export const fetchRooms = async (): Promise<readonly RoomSummaryDto[]> => {
  const res = await fetch(`${getApiUrl()}/rooms`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /rooms returned ${res.status}`);
  return (await res.json()) as readonly RoomSummaryDto[];
};

export const fetchMyRooms = async (): Promise<readonly MyRoomSummaryDto[]> => {
  const res = await fetch(`${getApiUrl()}/rooms/mine`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /rooms/mine returned ${res.status}`);
  return (await res.json()) as readonly MyRoomSummaryDto[];
};

export const cancelRoom = async (roomId: string): Promise<void> => {
  const res = await fetch(`${getApiUrl()}/rooms/${roomId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`DELETE /rooms/${roomId} returned ${res.status}`);
};
