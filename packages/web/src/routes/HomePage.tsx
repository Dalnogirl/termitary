import { SignedOutHome } from '../home/SignedOutHome.js';
import { useSession } from '../network/auth-client.js';
import { LobbyPage } from './LobbyPage.js';

export const HomePage = () => {
  const { data, isPending } = useSession();

  // Same reasoning as RequireAuth: rendering the visitor's hero while the
  // session resolves means every returning player sees a pitch flash past.
  if (isPending) return null;

  if (data) return <LobbyPage />;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      <SignedOutHome />
    </div>
  );
};
