import { Button } from '@/components/ui/button';
import type { MyRoomSummaryDto } from '@hive/protocol';
import { relativeTime } from '../lib/relative-time.js';

export const RoomRow = ({
  roomId,
  detail,
  action,
  onOpen,
}: {
  readonly roomId: string;
  readonly detail: string;
  readonly action: string;
  readonly onOpen: () => void;
}) => (
  <li className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
    <div className="flex flex-col">
      <span className="font-mono text-sm">{roomId}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
    <Button size="sm" variant="secondary" onClick={onOpen}>
      {action}
    </Button>
  </li>
);

export const myRoomDetail = (room: MyRoomSummaryDto): string => {
  const opponent = room.playerCount === 2 ? 'Opponent seated' : 'Waiting for opponent';
  return `Playing ${room.seat} · ${opponent} · ${relativeTime(room.updatedAt)}`;
};

export const myRoomAction = (room: MyRoomSummaryDto): string =>
  room.playerCount === 2 ? 'Reconnect' : 'Return';
