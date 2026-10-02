import type { RulesDemo } from './demo.js';
import { goal } from './goal.js';

/** In the order a new player needs them. */
export const CHAPTERS: readonly [RulesDemo, ...RulesDemo[]] = [goal];
