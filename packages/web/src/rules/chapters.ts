import { climbing } from './climbing.js';
import type { RulesDemo } from './demo.js';
import { freedom } from './freedom.js';
import { goal } from './goal.js';
import { oneHive } from './one-hive.js';
import { placing } from './placing.js';

/** In the order a new player needs them. */
export const CHAPTERS: readonly [RulesDemo, ...RulesDemo[]] = [
  goal,
  placing,
  oneHive,
  freedom,
  climbing,
];
