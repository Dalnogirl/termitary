import type { ArchivedGameSummaryDto, ArchivedPlayerDto } from '@termitary/protocol';
import { relativeTime } from '../lib/relative-time.js';

/** The seat opposite the one the row is written from: the profile owner's opponent. */
export const opponentOf = (game: ArchivedGameSummaryDto): ArchivedPlayerDto =>
  game.seat === 'white' ? game.players.black : game.players.white;

export const opponentName = (game: ArchivedGameSummaryDto): string =>
  opponentOf(game).name ?? 'Unknown opponent';

const won = (game: ArchivedGameSummaryDto): boolean =>
  game.result === (game.seat === 'white' ? 'white-wins' : 'black-wins');

// Third person throughout, your own profile included. The alternative is a
// viewer argument that every caller but one would ignore.
export const outcomeLabel = (game: ArchivedGameSummaryDto): string => {
  if (game.result === 'draw') return 'Draw';
  return won(game) ? 'Won' : 'Lost';
};

export const endReasonLabel = (game: ArchivedGameSummaryDto): string => {
  if (game.endReason === 'resignation') {
    return won(game) ? 'opponent resigned' : 'resigned';
  }
  return game.result === 'draw' ? 'both queens surrounded' : 'queen surrounded';
};

export const archivedDetail = (game: ArchivedGameSummaryDto): string =>
  [
    `${outcomeLabel(game)}, ${endReasonLabel(game)}`,
    `playing ${game.seat}`,
    `${game.moveCount} moves`,
    relativeTime(game.finishedAt),
  ].join(' · ');
