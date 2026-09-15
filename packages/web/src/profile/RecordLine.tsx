import type { PlayerRecordDto } from '@termitary/protocol';
import { relativeTime } from '../lib/relative-time.js';

const Figure = ({ children }: { readonly children: React.ReactNode }) => (
  <span className="text-foreground tabular-nums">{children}</span>
);

/** The record in one sentence. The rest of it is a disclosure under the games. */
export const RecordLine = ({ record }: { readonly record: PlayerRecordDto }) => {
  const { played, wins, losses, draws, winRate } = record.overall;

  if (played === 0) return <p className="text-sm text-muted-foreground">No finished games yet.</p>;

  return (
    <p className="text-sm text-muted-foreground">
      <Figure>{played}</Figure> games · <Figure>{wins}</Figure>W <Figure>{losses}</Figure>L{' '}
      <Figure>{draws}</Figure>D · <Figure>{Math.round(winRate * 100)}%</Figure> won
      {record.lastPlayedAt !== null && <> · last played {relativeTime(record.lastPlayedAt)}</>}
    </p>
  );
};
