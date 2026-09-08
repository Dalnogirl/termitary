import { type RoomSummary, RoomSummaryListSchema } from '@hive/protocol';
import { getApiUrl } from './url.js';

export const fetchRooms = async (): Promise<readonly RoomSummary[]> => {
  const res = await fetch(`${getApiUrl()}/rooms`, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET /rooms returned ${res.status}`);
  // Validate at the boundary even though the server controls the shape:
  // protocol drift between deploys is the most likely source of a
  // mismatch and we'd rather surface that here than as a render-time crash.
  return RoomSummaryListSchema.parse(await res.json());
};
