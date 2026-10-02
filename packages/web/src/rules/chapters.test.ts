import { describe, expect, it } from 'vitest';
import { interaction } from '../controller/interaction.js';
import { gameStore } from '../store/store.js';
import { CHAPTERS } from './chapters.js';
import { startOf } from './demo.js';
import { perform } from './player.js';

// One list per `select` step, in script order.
const SHOWN_TARGETS: Record<string, readonly (readonly string[])[]> = {
  goal: [
    [
      '-2,0',
      '-2,1',
      '-1,-1',
      '-1,2',
      '0,-1',
      '0,2',
      '1,-1',
      '1,2',
      '2,-2',
      '2,1',
      '2,2',
      '3,-2',
      '3,2',
      '4,-2',
      '4,0',
      '4,1',
      '5,-2',
      '5,-1',
    ],
  ],
};

const shownTargets = (demoId: string): (readonly string[])[] => {
  const demo = CHAPTERS.find(({ id }) => id === demoId);
  if (demo === undefined) throw new Error(`no demo ${demoId}`);

  gameStore.getState().applyGameState(startOf(demo));
  const shown: (readonly string[])[] = [];
  for (const step of demo.script) {
    perform(step);
    if (step.kind === 'select') {
      shown.push([...interaction(gameStore.getState(), null).targets.keys()].sort());
    }
  }
  return shown;
};

describe('rules chapters', () => {
  it('has a distinct id per chapter', () => {
    const ids = CHAPTERS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CHAPTERS.map((demo) => [demo.id, demo] as const))('replays %s setup', (_, demo) => {
    expect(() => startOf(demo)).not.toThrow();
  });

  it.each(CHAPTERS.map(({ id }) => id))('%s lights the pinned targets', (id) => {
    const expected = SHOWN_TARGETS[id]?.map((targets) => [...targets].sort());
    expect(shownTargets(id)).toEqual(expected);
  });

  it('ends the goal demo with the black queen surrounded', () => {
    shownTargets('goal');
    const { liveGame } = gameStore.getState();
    expect(liveGame.status === 'finished' && liveGame.result).toBe('white-wins');
  });
});
