import { Button } from '@/components/ui/button';
import type { SeekDto } from '@termitary/protocol';
import { relativeTime } from '../lib/relative-time.js';
import { Badge } from './Badge.js';
import { seekBadges } from './seek-terms.js';

type Props = { readonly seek: SeekDto } & (
  | { readonly mine: true }
  | { readonly mine: false; readonly disabled: boolean; readonly onJoin: () => void }
);

// Your own seek is cancelled from beside the Play button, so its row only
// marks it on the board.
export const SeekRow = (props: Props) => {
  const { seek } = props;
  const badges = seekBadges(seek.preference);
  const age = relativeTime(seek.createdAt);
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-col">
        <span className="flex items-center gap-2 text-sm">
          {badges.length === 0 ? 'Any pieces' : badges.map((b) => <Badge key={b}>{b}</Badge>)}
        </span>
        <span className="text-xs text-muted-foreground">
          {props.mine ? `Your seek · posted ${age}` : `Posted ${age}`}
        </span>
      </div>
      {!props.mine && (
        <Button size="sm" variant="secondary" disabled={props.disabled} onClick={props.onJoin}>
          Join
        </Button>
      )}
    </li>
  );
};
