import { Button } from '@/components/ui/button';
import type { ArchivedGameSummaryDto } from '@termitary/protocol';
import { Link } from 'react-router';
import { paths } from '../routes/paths.js';
import { archivedDetail, opponentName, opponentOf } from './summary.js';

// A deleted account keeps the name the game snapshotted but has no profile to
// open, so that one renders as text.
const Opponent = ({ game }: { readonly game: ArchivedGameSummaryDto }) => {
  const userId = opponentOf(game).userId;
  const name = opponentName(game);
  return userId === null ? (
    <span>{name}</span>
  ) : (
    <Link to={paths.profile(userId)} className="no-underline text-foreground hover:underline">
      {name}
    </Link>
  );
};

export const ArchivedGameRow = ({
  game,
  onOpen,
}: {
  readonly game: ArchivedGameSummaryDto;
  readonly onOpen: () => void;
}) => (
  <li className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
    <div className="flex flex-col">
      <span className="text-sm">
        vs <Opponent game={game} />
      </span>
      <span className="text-xs text-muted-foreground">{archivedDetail(game)}</span>
    </div>
    <Button size="sm" variant="secondary" onClick={onOpen}>
      Review
    </Button>
  </li>
);
