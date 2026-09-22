import { BASE_RULESET, rulesetFor } from '@termitary/engine';
import type { SeekPreference } from '@termitary/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Identity } from '../domain/identity.js';
import type { RoomStore } from '../domain/room-store.js';
import { MAX_OUTSTANDING_SEEKS, createSeek } from '../domain/seek.js';
import { type TestStores, createTestStores } from '../testing/stores.js';
import { type PairingDeps, type SeekPorts, postSeek } from './post-seek.js';

const PLAYERS = ['alice', 'bob', 'carol'];
const ident = (id: string): Identity => ({ playerId: id });
// Well past a seek's 7-day life, so a seek stamped at 0 is expired here.
const NOW = new Date(30 * 24 * 60 * 60 * 1000);

const brokenRooms = (rooms: RoomStore): RoomStore => ({
  ...rooms,
  create: async () => {
    throw new Error('disk went away');
  },
});

describe('postSeek', () => {
  let stores: TestStores;
  let ports: SeekPorts;
  let ids: number;

  const deps = (overrides: PairingDeps = {}): PairingDeps => ({
    newId: () => {
      ids += 1;
      return `id-${ids}`;
    },
    pickSeat: () => 'white',
    clock: () => NOW,
    ...overrides,
  });

  const post = (player: string, preference?: SeekPreference, overrides?: PairingDeps) =>
    postSeek(ident(player), preference === undefined ? {} : { preference }, ports, deps(overrides));

  beforeEach(() => {
    stores = createTestStores(PLAYERS);
    ids = 0;
    ports = { rooms: stores.rooms, seeks: stores.seeks, log: stores.log };
  });

  it('stands a seek on the board when nothing fits', async () => {
    const result = await post('alice');

    expect(result).toEqual({
      outcome: 'waiting',
      seek: createSeek('id-1', ident('alice'), {}, 'pool', NOW),
    });
    expect(await stores.seeks.listPool('bob', NOW)).toHaveLength(1);
  });

  it('pairs the second player and writes a room with both seats filled', async () => {
    await post('alice');
    const result = await post('bob');

    expect(result).toEqual({ outcome: 'paired', roomId: 'id-2' });
    const room = await stores.rooms.get('id-2');
    expect(room?.players).toEqual({ white: ident('bob'), black: ident('alice') });
    // The seek is spent: the board is empty and nothing can pair with it twice.
    expect(await stores.seeks.listPool('carol', NOW)).toEqual([]);
  });

  it('seats the pair by the flip, not by who waited', async () => {
    await post('alice');
    await post('bob', undefined, { pickSeat: () => 'black' });

    expect((await stores.rooms.get('id-2'))?.players).toEqual({
      white: ident('alice'),
      black: ident('bob'),
    });
  });

  it('gives the pair every piece either side required', async () => {
    await post('alice', { pillbug: 'require' });
    await post('bob', { ladybug: 'require' });

    expect((await stores.rooms.get('id-2'))?.ruleset).toEqual(rulesetFor(['ladybug', 'pillbug']));
  });

  it('plays base when both sides left the defaults on', async () => {
    await post('alice');
    await post('bob');

    expect((await stores.rooms.get('id-2'))?.ruleset).toEqual(BASE_RULESET);
  });

  it('leaves both waiting when the terms clash', async () => {
    await post('alice', { pillbug: 'require' });
    const result = await post('bob', { pillbug: 'exclude' });

    expect(result.outcome).toBe('waiting');
    expect(await stores.seeks.listPool('carol', NOW)).toHaveLength(2);
  });

  it('takes the oldest compatible seek, skipping ones it cannot play', async () => {
    await post('alice', { pillbug: 'exclude' });
    await post('bob', { pillbug: 'require' });

    await post('carol', { pillbug: 'require' });

    // Alice excluded the pillbug Carol demands, so the pair is Carol and Bob,
    // and Alice is left on the board.
    expect((await stores.rooms.get('id-3'))?.players).toEqual({
      white: ident('carol'),
      black: ident('bob'),
    });
    expect((await stores.seeks.listPool('bob', NOW)).map((seek) => seek.id)).toEqual(['id-1']);
  });

  // The race the conditional claim exists for. Two arrivals, one waiting seek:
  // one game, and the loser goes on the board instead of getting a second.
  it('produces one room when two players hit the same seek at once', async () => {
    await post('alice');

    const results = await Promise.all([post('bob'), post('carol')]);

    expect(results.filter((r) => r.outcome === 'paired')).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'waiting')).toHaveLength(1);
    expect(await stores.rooms.listSeatedBy('alice')).toHaveLength(1);
    expect(await stores.seeks.listPool('alice', NOW)).toHaveLength(1);
  });

  describe('taking one listed seek', () => {
    it('pairs with the seek the player clicked', async () => {
      // Alice's terms keep Bob off her seek, so his stands for Carol to click.
      await post('alice', { pillbug: 'exclude' });
      await post('bob', { pillbug: 'require' });

      const result = await postSeek(ident('carol'), { seekId: 'id-2' }, ports, deps());

      expect(result).toEqual({ outcome: 'paired', roomId: 'id-3' });
      expect((await stores.rooms.get('id-3'))?.ruleset).toEqual(rulesetFor(['pillbug']));
    });

    it('refuses your own seek rather than pairing you with yourself', async () => {
      await post('alice');
      expect(await postSeek(ident('alice'), { seekId: 'id-1' }, ports, deps())).toEqual({
        outcome: 'own-seek',
      });
    });

    it('refuses terms the taker will not play', async () => {
      await post('alice', { pillbug: 'require' });
      const result = await postSeek(
        ident('bob'),
        { seekId: 'id-1', preference: { pillbug: 'exclude' } },
        ports,
        deps(),
      );

      expect(result).toEqual({ outcome: 'incompatible' });
      expect(await stores.seeks.get('id-1')).toBeDefined();
    });

    it('reports a seek someone else already took as gone', async () => {
      await post('alice');
      await post('bob');

      expect(await postSeek(ident('carol'), { seekId: 'id-1' }, ports, deps())).toEqual({
        outcome: 'gone',
      });
    });

    it('reports an expired seek as gone without pairing', async () => {
      const stale = createSeek('stale', ident('alice'), {}, 'pool', new Date(0));
      await stores.seeks.create(stale);

      expect(await postSeek(ident('bob'), { seekId: 'stale' }, ports, deps())).toEqual({
        outcome: 'gone',
      });
    });

    // The cap bounds what one player leaves lying around. Taking a seek writes
    // nothing, so it is not what the cap is for.
    it('is allowed at the cap, because it posts no seek', async () => {
      for (let n = 0; n < MAX_OUTSTANDING_SEEKS; n += 1) await post('bob', { ladybug: 'exclude' });
      // Terms none of Bob's five will pair with, so it stands for him to take.
      await post('carol', { ladybug: 'require' });

      const result = await postSeek(ident('bob'), { seekId: 'id-6' }, ports, deps());
      expect(result.outcome).toBe('paired');
    });
  });

  // The claim has already deleted the opponent's seek by the time the room is
  // written, and they are not the one holding the failed request.
  it('puts the opponent back on the board when the room cannot be written', async () => {
    await post('alice');
    const failing: SeekPorts = { ...ports, rooms: brokenRooms(stores.rooms) };

    await expect(postSeek(ident('bob'), {}, failing, deps())).rejects.toThrow('disk went away');

    const [restored] = await stores.seeks.listPool('bob', NOW);
    expect(restored?.id).toBe('id-1');
    expect(restored?.seeker).toEqual(ident('alice'));
  });

  // Whatever took the room write down usually takes the restore with it, and
  // the restore's error explains nothing on its own.
  it('reports the room failure even when the seek cannot be put back', async () => {
    await post('alice');
    const logged: Record<string, unknown>[] = [];
    const failing: SeekPorts = {
      rooms: brokenRooms(stores.rooms),
      seeks: {
        ...stores.seeks,
        create: async () => {
          throw new Error('so did the seek table');
        },
      },
      log: { ...stores.log, error: (fields) => void logged.push(fields) },
    };

    await expect(postSeek(ident('bob'), {}, failing, deps())).rejects.toThrow('disk went away');
    expect(logged).toHaveLength(1);
    expect(logged[0]?.seekId).toBe('id-1');
  });

  describe('the cap', () => {
    it('refuses a sixth outstanding seek', async () => {
      for (let n = 0; n < MAX_OUTSTANDING_SEEKS; n += 1) {
        expect((await post('alice')).outcome).toBe('waiting');
      }
      expect(await post('alice')).toEqual({ outcome: 'at-limit' });
    });

    // Pairing writes no seek and takes one off the board, so the cap has
    // nothing to protect against here.
    it('still pairs a capped player with a seek that is already waiting', async () => {
      for (let n = 0; n < MAX_OUTSTANDING_SEEKS; n += 1)
        await post('alice', { ladybug: 'exclude' });
      // Terms none of Alice's five will take, so his seek is still standing.
      await post('bob', { ladybug: 'require' });

      expect((await post('alice')).outcome).toBe('paired');
    });

    it('counts expired seeks out, so waiting a week frees the slot', async () => {
      const stale = createSeek('stale', ident('alice'), {}, 'pool', new Date(0));
      for (let n = 0; n < MAX_OUTSTANDING_SEEKS - 1; n += 1) await post('alice');
      await stores.seeks.create(stale);

      expect((await post('alice')).outcome).toBe('waiting');
    });
  });
});
