import type { MyRoomSummaryDto } from '@termitary/protocol';
import { getApiUrl } from './url.js';

export const fetchMyRooms = async (): Promise<readonly MyRoomSummaryDto[]> => {
  const res = await fetch(`${getApiUrl()}/rooms/mine`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /rooms/mine returned ${res.status}`);
  return (await res.json()) as readonly MyRoomSummaryDto[];
};
