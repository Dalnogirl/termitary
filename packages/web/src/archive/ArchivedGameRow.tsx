import { Button } from '@/components/ui/button';
import type { ArchivedGameSummaryDto } from '@termitary/protocol';
import { archivedDetail, opponentName } from './summary.js';

export const ArchivedGameRow = ({
  game,
  onOpen,
}: {
  readonly game: ArchivedGameSummaryDto;
  readonly onOpen: () => void;
}) => (
  <li className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
    <div className="flex flex-col">
      <span className="text-sm">vs {opponentName(game)}</span>
      <span className="text-xs text-muted-foreground">{archivedDetail(game)}</span>
    </div>
    <Button size="sm" variant="secondary" onClick={onOpen}>
      Review
    </Button>
  </li>
);
