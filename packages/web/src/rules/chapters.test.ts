import { type HexCoord, listValidMoves, topPieceAt } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { sharedEdge } from '../board/hex.js';
import { coordKey, interaction, sameCoord } from '../controller/interaction.js';
import { type Annotation, annotationStore } from '../store/annotations.js';
import { gameStore } from '../store/store.js';
import { CHAPTERS } from './chapters.js';
import { type RulesDemo, startOf } from './demo.js';
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
  placing: [
    ['0,0'],
    ['-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0'],
    ['-1,0', '-1,1', '0,-1'],
    [],
    [],
    ['-1,-1', '-1,1', '-2,-1', '-2,1', '-3,0', '-3,1', '0,-1'],
  ],
  'one-hive': [
    [],
    [
      '-1,-1',
      '-1,1',
      '-2,1',
      '0,-1',
      '0,1',
      '1,-1',
      '1,1',
      '2,-1',
      '2,1',
      '3,-1',
      '3,1',
      '4,-1',
      '4,0',
    ],
  ],
  'freedom-to-move': [
    [
      '-1,-1',
      '-1,3',
      '-2,0',
      '-2,3',
      '-3,1',
      '-3,2',
      '-3,3',
      '0,-1',
      '0,-2',
      '0,2',
      '1,-3',
      '1,0',
      '2,-3',
      '2,0',
      '3,-3',
      '3,0',
      '4,-1',
      '4,-2',
      '4,-3',
    ],
  ],
  climbing: [
    ['0,-1', '0,0', '1,0', '2,-1'],
    ['0,0', '0,1', '1,-1', '1,1', '2,-1', '2,0'],
  ],
  queen: [
    ['-1,1', '0,-1'],
    ['-1,0', '1,-1'],
  ],
  beetle: [
    ['-1,1', '0,-1', '0,0'],
    ['-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0'],
  ],
  grasshopper: [
    [
      '-1,0',
      '-1,3',
      '-2,2',
      '-2,3',
      '0,-1',
      '0,2',
      '1,-2',
      '1,1',
      '2,-2',
      '2,1',
      '3,-2',
      '3,0',
      '4,-1',
      '4,-2',
    ],
    ['-1,0', '1,0'],
  ],
  spider: [['-1,2', '2,-1']],
  ant: [
    [
      '-1,-1',
      '-2,0',
      '-2,1',
      '0,-1',
      '0,1',
      '1,-1',
      '1,1',
      '2,-1',
      '2,1',
      '3,-2',
      '3,0',
      '4,-1',
      '4,-2',
    ],
  ],
};

const shownTargets = (demoId: string): (readonly string[])[] => {
  const demo = demoById(demoId);

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

const demoById = (demoId: string): RulesDemo => {
  const demo = CHAPTERS.find(({ id }) => id === demoId);
  if (demo === undefined) throw new Error(`no demo ${demoId}`);
  return demo;
};

// The two cells flanking the edge from `a` to its neighbour `b`: the step turned 60° each way.
const gatePosts = (a: HexCoord, b: HexCoord): readonly HexCoord[] => {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return [
    { q: a.q - dr, r: a.r + dq + dr },
    { q: a.q + dq + dr, r: a.r - dq },
  ];
};

// A mark claims the board refuses something; this is that claim, asked of the engine.
const refuses = (annotation: Annotation): boolean => {
  const state = gameStore.getState();
  const { board } = state.liveGame;
  const targets = interaction(state, null).targets;
  switch (annotation.kind) {
    case 'pinned':
      return (
        (board.cells.get(coordKey(annotation.at)) ?? []).some(
          (piece) => piece.color === state.liveGame.currentPlayer,
        ) &&
        !listValidMoves(state.liveGame).some(
          (m) => m.kind === 'relocate' && sameCoord(m.from, annotation.at),
        )
      );
    case 'blocked':
      return (
        state.selection !== null &&
        topPieceAt(board, annotation.at) === undefined &&
        !targets.has(coordKey(annotation.at))
      );
    case 'gate': {
      const [from, to] = annotation.between;
      return (
        state.selection?.kind === 'board' &&
        sameCoord(state.selection.coord, from) &&
        topPieceAt(board, to) === undefined &&
        !targets.has(coordKey(to)) &&
        sharedEdge(from, to, 1) !== null &&
        gatePosts(from, to).every((c) => topPieceAt(board, c) !== undefined)
      );
    }
  }
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

  it.each(CHAPTERS.map(({ id }) => id))('%s marks only what the board refuses', (id) => {
    const demo = demoById(id);
    annotationStore.getState().clearAnnotations();
    gameStore.getState().applyGameState(startOf(demo));
    const wrong: Annotation[] = [];
    for (const step of demo.script) {
      perform(step);
      if (step.kind === 'annotate' || step.kind === 'select') {
        wrong.push(...annotationStore.getState().annotations.filter((a) => !refuses(a)));
      }
    }
    expect(wrong).toEqual([]);
  });

  it('ends the goal demo with the black queen surrounded', () => {
    shownTargets('goal');
    const { liveGame } = gameStore.getState();
    expect(liveGame.status === 'finished' && liveGame.result).toBe('white-wins');
  });
});
