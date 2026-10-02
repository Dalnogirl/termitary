import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { RoomStatus } from '../controller/room.js';
import { paths } from './paths.js';

// An effect rather than <Navigate>, which takes no viewTransition. Replace, so
// Back from the archive does not land on a room that is gone.
export const useArchiveRedirect = (status: RoomStatus, roomId: string | undefined): void => {
  const navigate = useNavigate();
  useEffect(() => {
    if (status !== 'archived' || roomId === undefined) return;
    void navigate(paths.archivedGame(roomId), { replace: true, viewTransition: true });
  }, [status, roomId, navigate]);
};
