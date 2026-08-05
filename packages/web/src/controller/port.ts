import type { Move } from '@hive/engine';

export type Controller = {
  readonly commitMove: (move: Move) => void;
};
