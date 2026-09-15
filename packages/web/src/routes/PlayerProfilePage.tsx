import { useParams } from 'react-router';
import { useSession } from '../network/auth-client.js';
import { ProfilePage } from '../profile/ProfilePage.js';

export const PlayerProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { data } = useSession();
  // Your own id through this route is still your profile, editor included, so
  // a link to yourself from a game row is not a read-only dead end.
  return <ProfilePage userId={userId ?? ''} editable={userId === data?.user.id} />;
};
