import type { RoomSummaryDto } from '@hive/protocol';
import { getApiUrl } from './url.js';

export const fetchRooms = async (): Promise<readonly RoomSummaryDto[]> => {
  const res = await fetch(`${getApiUrl()}/rooms`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /rooms returned ${res.status}`);
  return (await res.json()) as readonly RoomSummaryDto[];
};
