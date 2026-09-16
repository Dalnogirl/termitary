import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateRoomRequestDto, CreateRoomResponseDto } from '@termitary/protocol';
import { getApiUrl } from './url.js';

const createRoom = async (body: CreateRoomRequestDto): Promise<CreateRoomResponseDto> => {
  // The creator is req.identity, taken from the session cookie; the body
  // carries only what they chose, the seat and the pieces.
  const res = await fetch(`${getApiUrl()}/rooms`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /rooms returned ${res.status}`);
  return (await res.json()) as CreateRoomResponseDto;
};

export const useCreateRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRoom,
    // `['rooms']` prefix-matches `['rooms', 'mine']`, so one call covers both
    // lobby tabs. Without it the 10s staleTime hides the new room from the
    // tab it lands in.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
};
