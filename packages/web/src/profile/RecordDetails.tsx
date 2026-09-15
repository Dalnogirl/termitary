import type { PlayerRecordDto, SeatRecordDto } from '@termitary/protocol';

const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

const seatLine = (seat: SeatRecordDto): string =>
  seat.played === 0 ? 'no games' : `${percent(seat.winRate)} of ${seat.played}`;

const Row = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

/**
 * Closed by default: the games are what a profile is opened for, and the
 * numbers above the list already answer the question most visits have.
 */
export const RecordDetails = ({ record }: { readonly record: PlayerRecordDto }) => (
  <details className="border-t border-border pt-3">
    <summary className="cursor-pointer text-xs text-muted-foreground">Full record</summary>
    <div className="pt-3 text-sm">
      <Row label="Games" value={String(record.overall.played)} />
      <Row
        label="Won / lost / drawn"
        value={`${record.overall.wins} / ${record.overall.losses} / ${record.overall.draws}`}
      />
      <Row label="Win rate" value={percent(record.overall.winRate)} />
      <Row label="As white" value={seatLine(record.asWhite)} />
      <Row label="As black" value={seatLine(record.asBlack)} />
      <Row label="Longest win streak" value={String(record.longestWinStreak)} />
      <Row label="Average moves" value={String(Math.round(record.averageMoves))} />
      <Row
        label="Queen surrounded / resignation"
        value={`${record.endings.queenSurrounded} / ${record.endings.resignation}`}
      />
    </div>
  </details>
);
