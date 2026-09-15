import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router';
import { ArchivedGameRow } from '../archive/ArchivedGameRow.js';
import { useArchivedGames } from '../archive/use-archived-games.js';
import { useSession } from '../network/auth-client.js';

export const ArchivedGamesPage = () => {
  const navigate = useNavigate();
  // RequireAuth gates this route, so the session is there by the time it renders.
  const { data } = useSession();
  const games = useArchivedGames(data?.user.id ?? '');

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold tracking-tight">Past games</h1>

      {games.isLoading && <p className="text-muted-foreground">Loading…</p>}

      {games.error !== null && (
        <p className="text-foreground">
          Could not load your past games:{' '}
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
              onOpen={() => void navigate(`/archived-games/${game.gameId}`)}
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
    </div>
  );
};
