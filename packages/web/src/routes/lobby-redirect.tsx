import { Navigate, type RouteObject } from 'react-router';
import { paths } from './paths.js';

// The lobby lived here before it moved to /, and old links and bookmarks still
// point at it. Replace, so Back leaves the dead URL instead of bouncing off it.
export const lobbyRedirect: RouteObject = {
  path: '/lobby',
  element: <Navigate to={paths.home} replace />,
};
