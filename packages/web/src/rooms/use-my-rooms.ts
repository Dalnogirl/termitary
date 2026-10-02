import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchMyRooms } from '../network/rooms-api.js';

export const myRoomsQuery = queryOptions({ queryKey: ['rooms', 'mine'], queryFn: fetchMyRooms });

export const useMyRooms = () => useQuery(myRoomsQuery);
