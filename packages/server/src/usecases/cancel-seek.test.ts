import { beforeEach, describe, expect, it } from 'vitest';
import type { SeekStore } from '../domain/seek-store.js';
import { createSeek } from '../domain/seek.js';
import { type TestStores, createTestStores } from '../testing/stores.js';
import { cancelSeek } from './cancel-seek.js';

const ident = (id: string) => ({ playerId: id });
const NOW = new Date(1000);

describe('cancelSeek', () => {
  let stores: TestStores;

  beforeEach(async () => {
    stores = createTestStores(['alice', 'bob']);
    await stores.seeks.create(createSeek('s1', ident('alice'), {}, 'pool', NOW));
  });

  it('takes your own seek off the board', async () => {
    expect(await cancelSeek(ident('alice'), 's1', stores.seeks)).toBe('cancelled');
    expect(await stores.seeks.get('s1')).toBeUndefined();
  });

  it('refuses someone else’s seek and leaves it standing', async () => {
    expect(await cancelSeek(ident('bob'), 's1', stores.seeks)).toBe('forbidden');
    expect(await stores.seeks.get('s1')).toBeDefined();
  });

  it('reports a seek that is not there', async () => {
    expect(await cancelSeek(ident('alice'), 'nope', stores.seeks)).toBe('not-found');
  });

  it('reports a seek whose preference cannot be read as not there', async () => {
    const unreadable: SeekStore = { ...stores.seeks, get: async () => undefined };

    expect(await cancelSeek(ident('alice'), 's1', unreadable)).toBe('not-found');
  });

  // A cancel racing a pairing has to lose: the opponent already has the game,
  // so there is nothing left to cancel.
  it('loses to a pairing that claimed the seek first', async () => {
    const claimedMeanwhile: SeekStore = {
      ...stores.seeks,
      claim: async () => undefined,
    };

    expect(await cancelSeek(ident('alice'), 's1', claimedMeanwhile)).toBe('not-found');
  });
});
