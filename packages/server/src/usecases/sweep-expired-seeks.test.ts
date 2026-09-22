import { beforeEach, describe, expect, it } from 'vitest';
import { SEEK_TTL_MS, createSeek } from '../domain/seek.js';
import { type TestStores, createTestStores } from '../testing/stores.js';
import { sweepExpiredSeeks } from './sweep-expired-seeks.js';

const ident = (id: string) => ({ playerId: id });
const POSTED_AT = new Date(1000);
const EXPIRY = new Date(POSTED_AT.getTime() + SEEK_TTL_MS);

describe('sweepExpiredSeeks', () => {
  let stores: TestStores;

  beforeEach(async () => {
    stores = createTestStores(['alice']);
    await stores.seeks.create(createSeek('stale', ident('alice'), {}, 'pool', POSTED_AT));
  });

  it('leaves a seek alone until it expires', async () => {
    expect(await sweepExpiredSeeks(stores, new Date(EXPIRY.getTime() - 1))).toBe(0);
    expect(await stores.seeks.get('stale')).toBeDefined();
  });

  it('removes a seek nobody took within its seven days', async () => {
    expect(await sweepExpiredSeeks(stores, EXPIRY)).toBe(1);
    expect(await stores.seeks.get('stale')).toBeUndefined();
  });

  it('removes a private seek too, since its link has expired as well', async () => {
    await stores.seeks.create(createSeek('link', ident('alice'), {}, 'private', POSTED_AT));
    expect(await sweepExpiredSeeks(stores, EXPIRY)).toBe(2);
  });
});
