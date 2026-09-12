import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ArchivedGameDetailDto } from '@termitary/protocol';
import type * as React from 'react';
import { Link, useParams } from 'react-router';
import { archivedDetail, opponentName } from '../archive/summary.js';
import { useArchivedGame } from '../archive/use-archived-game.js';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { reviewController } from '../controller/review.js';
import { GameLayout } from './GameLayout.js';

const Notice = ({ children }: { readonly children: React.ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
    <p className="text-muted-foreground">{children}</p>
    <Link
      to="/archived-games"
      className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline')}
    >
      Past games
    </Link>
  </div>
);

const Review = ({ game }: { readonly game: ArchivedGameDetailDto }) => (
  <RoomProvider myColor={game.seat}>
    <InputProvider controller={reviewController}>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground">
          <span>
            <span className="text-foreground">vs {opponentName(game)}</span> ·{' '}
            {archivedDetail(game)}
          </span>
          <Link to="/archived-games" className="no-underline hover:text-foreground">
            All past games
          </Link>
        </div>
        <GameLayout showGameOver={false} returnLabel="Back to final position" />
      </div>
    </InputProvider>
  </RoomProvider>
);

export const ArchivedGamePage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const view = useArchivedGame(gameId);

  switch (view.status) {
    case 'loading':
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      );
    case 'missing':
      return <Notice>This game does not exist, or you did not play in it.</Notice>;
    case 'error':
      return <Notice>Could not load this game: {view.message}</Notice>;
    case 'ready':
      return <Review game={view.game} />;
  }
};
