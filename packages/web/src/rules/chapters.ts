import { ant } from './ant.js';
import { beetle } from './beetle.js';
import { climbing } from './climbing.js';
import type { RulesDemo } from './demo.js';
import { freedom } from './freedom.js';
import { goal } from './goal.js';
import { grasshopper } from './grasshopper.js';
import { oneHive } from './one-hive.js';
import { placing } from './placing.js';
import { queen } from './queen.js';
import { spider } from './spider.js';

export type RulesSection = {
  /** The section's anchor; never a chapter id. */
  readonly id: string;
  readonly title: string;
  readonly chapters: readonly [RulesDemo, ...RulesDemo[]];
};

/** In the order a new player needs them. */
export const SECTIONS: readonly [RulesSection, ...RulesSection[]] = [
  { id: 'core-rules', title: 'Core rules', chapters: [goal, placing, oneHive, freedom, climbing] },
  { id: 'pieces', title: 'Pieces', chapters: [queen, beetle, grasshopper, spider, ant] },
];

export const CHAPTERS: readonly [RulesDemo, ...RulesDemo[]] = [
  SECTIONS[0].chapters[0],
  ...SECTIONS.flatMap(({ chapters }) => chapters).slice(1),
];
