import { listValidMoves } from '@termitary/engine';
import { type Room, play } from '../domain/room.js';

/** Both sides make a first move, a second apart, so the clock is running. */
export const startedRoom = (room: Room): Room =>
  (['white', 'black'] as const).reduce((r, color) => {
    if (r.state.status === 'finished') throw new Error('game is over');
    const move = listValidMoves(r.state)[0];
    if (move === undefined) throw new Error('no legal move');
    return play(r, color, move, new Date(r.updatedAt.getTime() + 1000));
  }, room);
