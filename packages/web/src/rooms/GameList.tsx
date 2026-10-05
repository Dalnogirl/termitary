import type { MyRoomSummaryDto } from '@termitary/protocol';
import { PieceTile } from '../board/PieceTile.js';
import { relativeTime } from '../lib/relative-time.js';
import { Badge } from './Badge.js';
import { expansionsIn } from './expansions.js';
import { LoadError, RowAction, rowClass } from './lobby-rows.js';
import type { Lobby } from './use-lobby.js';

const GameRow = ({ room, onOpen }: { readonly room: MyRoomSummaryDto; onOpen: () => void }) => (
  <li>
    <button type="button" className={rowClass} onClick={onOpen}>
      <PieceTile type="queen" color={room.seat} />
      <span className="flex flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          Playing {room.seat}
          {expansionsIn(room.ruleset).map((e) => (
            <Badge key={e.piece}>{e.label}</Badge>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">
          Last move {relativeTime(room.updatedAt)}
        </span>
      </span>
      <RowAction>Resume</RowAction>
    </button>
  </li>
);

// Refresh lives here rather than with the seeks, which hide when there are
// none, and the pool is only polled while the player holds a seek.
export const GameList = ({ lobby }: { readonly lobby: Lobby }) => {
  const { rooms, myRooms } = lobby;
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between px-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your games
        </h2>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={lobby.refresh}
        >
          Refresh
        </button>
      </div>
      {rooms.isLoading && <p className="m-0 px-3 py-2 text-sm text-muted-foreground">Loading…</p>}
      {rooms.error !== null && <LoadError error={rooms.error} />}
      {!rooms.isLoading && rooms.error === null && myRooms.length === 0 && (
        <p className="m-0 px-3 py-2 text-sm text-muted-foreground">
          Nothing in progress yet. Press Play and your first game lands here.
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {myRooms.map((room) => (
          <GameRow key={room.roomId} room={room} onOpen={() => lobby.openRoom(room.roomId)} />
        ))}
      </ul>
    </section>
  );
};
