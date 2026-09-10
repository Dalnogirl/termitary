import type { CreateRoomResponseDto } from '@hive/protocol';
import { useMutation } from '@tanstack/react-query';
import { getApiUrl } from './url.js';

const createRoom = async (): Promise<CreateRoomResponseDto> => {
  // No body: the server seats req.identity, taken from the session cookie.
  const res = await fetch(`${getApiUrl()}/rooms`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`POST /rooms returned ${res.status}`);
  return (await res.json()) as CreateRoomResponseDto;
};

export const useCreateRoom = () => useMutation({ mutationFn: createRoom });
