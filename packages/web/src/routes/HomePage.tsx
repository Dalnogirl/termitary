import { SignedInHome } from '../home/SignedInHome.js';
import { SignedOutHome } from '../home/SignedOutHome.js';
import { useSession } from '../network/auth-client.js';

export const HomePage = () => {
  const { data, isPending } = useSession();

  // Same reasoning as RequireAuth: rendering the visitor's hero while the
  // session resolves means every returning player sees a pitch flash past.
  if (isPending) return null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {data ? <SignedInHome /> : <SignedOutHome />}
    </div>
  );
};
