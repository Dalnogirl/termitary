import { Button } from '@/components/ui/button';
import type { ProfileDto } from '@termitary/protocol';
import { Link, useNavigate } from 'react-router';
import { ArchivedGameRow } from '../archive/ArchivedGameRow.js';
import { useArchivedGames } from '../archive/use-archived-games.js';
import { relativeTime } from '../lib/relative-time.js';
import { paths } from '../routes/paths.js';
import { NameEditor } from './NameEditor.js';
import { RecordDetails } from './RecordDetails.js';
import { RecordLine } from './RecordLine.js';
import { type ProfileView, useProfile, useRenameProfile } from './use-profile.js';

const Games = ({ userId }: { readonly userId: string }) => {
  const navigate = useNavigate();
  const games = useArchivedGames(userId);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Past games</h2>

      {games.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {games.error !== null && (
        <p className="text-foreground">
          Could not load past games:{' '}
          {games.error instanceof Error ? games.error.message : 'unknown error'}
        </p>
      )}

      {games.isEmpty && (
        <p className="text-muted-foreground">
          Nothing finished yet. A game lands here once it is won, lost or drawn.
        </p>
      )}

      {games.items.length > 0 && (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {games.items.map((game) => (
            <ArchivedGameRow
              key={game.gameId}
              game={game}
              onOpen={() =>
                void navigate(paths.archivedGame(game.gameId), { viewTransition: true })
              }
            />
          ))}
        </ul>
      )}

      {games.hasMore && (
        <Button
          variant="secondary"
          className="self-start"
          disabled={games.isLoadingMore}
          onClick={games.loadMore}
        >
          {games.isLoadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  );
};

const Header = ({
  profile,
  editable,
}: {
  readonly profile: ProfileDto;
  readonly editable: boolean;
}) => {
  const rename = useRenameProfile(profile.userId);

  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {editable ? (
          <NameEditor name={profile.name} rename={rename} />
        ) : (
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
        )}
        <p className="text-xs text-muted-foreground">
          Member since {relativeTime(profile.memberSince)}
        </p>
      </div>
      <RecordLine record={profile.record} />
    </header>
  );
};

const Notice = ({ children }: { readonly children: React.ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
    <p className="text-muted-foreground">{children}</p>
    <Link to={paths.lobby} viewTransition className="text-sm">
      Play online
    </Link>
  </div>
);

const Loaded = ({ view, editable }: { readonly view: ProfileView; readonly editable: boolean }) => {
  switch (view.status) {
    case 'loading':
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      );
    case 'missing':
      return <Notice>There is no player here.</Notice>;
    case 'error':
      return <Notice>Could not load this profile: {view.message}</Notice>;
    case 'ready':
      return (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-6 gap-6 max-w-3xl mx-auto w-full">
          <Header profile={view.profile} editable={editable} />
          <Games userId={view.profile.userId} />
          <RecordDetails record={view.profile.record} />
        </div>
      );
  }
};

/** Both `/profile` and `/u/:userId`; the name editor is the whole difference. */
export const ProfilePage = ({
  userId,
  editable,
}: {
  readonly userId: string;
  readonly editable: boolean;
}) => {
  const view = useProfile(userId);
  return <Loaded view={view} editable={editable} />;
};
