import type { SeekDto } from '@termitary/protocol';
import { relativeTime } from '../lib/relative-time.js';
import { Badge } from './Badge.js';
import { LoadError, RowAction, rowClass } from './lobby-rows.js';
import { seekBadges } from './seek-terms.js';
import type { Lobby } from './use-lobby.js';

type RowProps = {
  readonly seek: SeekDto;
  readonly disabled: boolean;
  readonly onJoin: () => void;
};

const SeekRow = ({ seek, disabled, onJoin }: RowProps) => {
  const badges = seekBadges(seek.preference);
  return (
    <li>
      <button type="button" className={rowClass} disabled={disabled} onClick={onJoin}>
        <span className="flex flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {badges.length === 0 ? 'Any pieces' : badges.map((b) => <Badge key={b}>{b}</Badge>)}
          </span>
          <span className="text-xs text-muted-foreground">
            Waiting since {relativeTime(seek.createdAt)}
          </span>
        </span>
        <RowAction>Join</RowAction>
      </button>
    </li>
  );
};

/** Other players' seeks. Nothing renders while there are none. */
export const SeekList = ({ lobby }: { readonly lobby: Lobby }) => {
  const { board, pool } = lobby;
  if (board.error === null && pool.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Open seeks
      </h2>
      {board.error !== null && <LoadError error={board.error} />}
      <ul className="m-0 flex list-none flex-col p-0">
        {pool.map((seek) => (
          <SeekRow
            key={seek.seekId}
            seek={seek}
            disabled={lobby.busy}
            onJoin={() => lobby.join(seek.seekId)}
          />
        ))}
      </ul>
    </section>
  );
};
