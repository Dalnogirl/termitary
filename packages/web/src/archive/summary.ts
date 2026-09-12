import type { ArchivedGameSummaryDto } from '@termitary/protocol';
import { relativeTime } from '../lib/relative-time.js';

export const opponentName = (game: ArchivedGameSummaryDto): string => {
  const opponent = game.seat === 'white' ? game.players.black : game.players.white;
  return opponent ?? 'Unknown opponent';
};

const won = (game: ArchivedGameSummaryDto): boolean =>
  game.result === (game.seat === 'white' ? 'white-wins' : 'black-wins');

export const outcomeLabel = (game: ArchivedGameSummaryDto): string => {
  if (game.result === 'draw') return 'Draw';
  return won(game) ? 'You won' : 'You lost';
};

export const endReasonLabel = (game: ArchivedGameSummaryDto): string => {
  if (game.endReason === 'resignation') {
    return won(game) ? 'opponent resigned' : 'you resigned';
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
