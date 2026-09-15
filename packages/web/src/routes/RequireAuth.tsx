import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../network/auth-client.js';
import { paths } from './paths.js';

// Gates the routes that talk to the server. /hotseat stays outside: it runs
// entirely in the engine and never opens a socket.
export const RequireAuth = () => {
  const { data, isPending } = useSession();
  const location = useLocation();

  // Rendering the redirect while the session is still resolving flashes the
  // sign-in form on every load for an already-authenticated user.
  if (isPending) return null;

  if (!data) {
    // Full location, not just pathname: a deep link's query and hash are part
    // of where the user was trying to go.
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={paths.signin} replace state={{ from }} />;
  }

  return <Outlet />;
};
