import type { Move } from '@termitary/engine';

export type Controller = {
  readonly commitMove: (move: Move) => void;
};
