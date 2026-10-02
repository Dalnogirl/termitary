import type { GameState, Move, Ruleset } from '@termitary/engine';
import { replayFrames } from '@termitary/engine';
import type { Selection } from '../store/store.js';

/** One beat of a demo. A pause holds the board still for a beat. */
export type DemoStep =
  | { readonly kind: 'select'; readonly selection: NonNullable<Selection> }
  | { readonly kind: 'move'; readonly move: Move }
  | { readonly kind: 'pause' };

export type RulesDemo = {
  /** Also the chapter's URL hash. */
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  readonly ruleset: Ruleset;
  /** Replayed to reach the position, never animated. */
  readonly setup: readonly Move[];
  readonly script: readonly DemoStep[];
};

export const startOf = (demo: RulesDemo): GameState => {
  const frames = replayFrames(demo.setup, demo.ruleset);
  const start = frames.at(-1);
  if (start === undefined) throw new Error(`demo ${demo.id} replayed to nothing`);
  return start;
};
