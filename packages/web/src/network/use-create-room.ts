import { type CreateRoomResponse, CreateRoomResponseSchema } from '@hive/protocol';
import { useMutation } from '@tanstack/react-query';
import { getOrCreatePlayerId } from './player-id.js';
import { getApiUrl } from './url.js';

const createRoom = async (): Promise<CreateRoomResponse> => {
  const res = await fetch(`${getApiUrl()}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId: getOrCreatePlayerId() }),
  });
  if (!res.ok) throw new Error(`POST /rooms returned ${res.status}`);
  return CreateRoomResponseSchema.parse(await res.json());
};

export const useCreateRoom = () => useMutation({ mutationFn: createRoom });
