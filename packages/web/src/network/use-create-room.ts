import { type CreateRoomResponse, CreateRoomResponseSchema } from '@hive/protocol';
import { useMutation } from '@tanstack/react-query';
import { getApiUrl } from './url.js';

const createRoom = async (): Promise<CreateRoomResponse> => {
  // No body: the server seats req.identity, taken from the session cookie.
  const res = await fetch(`${getApiUrl()}/rooms`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`POST /rooms returned ${res.status}`);
  return CreateRoomResponseSchema.parse(await res.json());
};

export const useCreateRoom = () => useMutation({ mutationFn: createRoom });
