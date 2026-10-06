import { cn } from '@/lib/utils';
import type { Color } from '@termitary/engine';
import {
  type ClockSnapshot,
  formatDeadline,
  formatRealtime,
  onFirstMove,
  remainingAt,
} from './clock-face.js';
import { useTickingNow } from './use-ticking-now.js';

const REALTIME_TICK_MS = 100;
const DEADLINE_TICK_MS = 30_000;
const LOW_MS = 10_000;

type Props = {
  readonly snapshot: ClockSnapshot;
  readonly side: Color;
};

export const GameClock = ({ snapshot, side }: Props) => {
  const { timeControl } = snapshot.reading;
  const ticking = side === snapshot.toMove;
  const tickMs = timeControl.kind === 'realtime' ? REALTIME_TICK_MS : DEADLINE_TICK_MS;
  const now = useTickingNow(ticking ? tickMs : null);
  const ms = remainingAt(snapshot, side, now);
  if (ms === null) return null;

  const realtime = timeControl.kind === 'realtime';
  const firstMove = onFirstMove(snapshot, side);
  return (
    // role=timer is not a live region, so the ticks stay silent to a screen reader.
    <span
      role="timer"
      aria-label={`${side} clock`}
      className={cn(
        'inline-flex flex-col items-end leading-tight tabular-nums whitespace-nowrap',
        realtime ? 'text-base md:text-lg font-semibold' : 'text-xs md:text-sm',
        ticking ? 'text-foreground' : 'text-muted-foreground',
        ticking && realtime && ms < LOW_MS && 'text-destructive',
      )}
    >
      {realtime ? formatRealtime(ms) : formatDeadline(ms)}
      {firstMove && (
        <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
          to start
        </span>
      )}
    </span>
  );
};
