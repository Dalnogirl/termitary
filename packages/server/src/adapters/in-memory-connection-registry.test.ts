import type { ServerMessage } from '@hive/protocol';
import { describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from './in-memory-connection-registry.js';

const recorder = () => {
  const messages: ServerMessage[] = [];
  const send = async (msg: ServerMessage): Promise<void> => {
    messages.push(msg);
  };
  return { messages, send };
};

const sample: ServerMessage = { type: 'error', message: 'x' };

describe('InMemoryConnectionRegistry', () => {
  it('sendTo dispatches to the bound sender only', async () => {
    const reg = createInMemoryConnectionRegistry();
    const a = recorder();
    const b = recorder();
    reg.bind('a', a.send);
    reg.bind('b', b.send);
    await reg.sendTo('a', sample);
    expect(a.messages).toEqual([sample]);
    expect(b.messages).toEqual([]);
  });

  it('sendTo on unknown player is a no-op', async () => {
    const reg = createInMemoryConnectionRegistry();
    await expect(reg.sendTo('ghost', sample)).resolves.toBeUndefined();
  });

  it('broadcast reaches every player in the room', async () => {
    const reg = createInMemoryConnectionRegistry();
    const a = recorder();
    const b = recorder();
    const c = recorder();
    reg.bind('a', a.send);
    reg.bind('b', b.send);
    reg.bind('c', c.send);
    await reg.joinRoom('a', 'r1');
    await reg.joinRoom('b', 'r1');
    await reg.joinRoom('c', 'r2');
    await reg.broadcast('r1', sample);
    expect(a.messages).toEqual([sample]);
    expect(b.messages).toEqual([sample]);
    expect(c.messages).toEqual([]);
  });

  it('leaveRoom stops broadcasts from reaching the player', async () => {
    const reg = createInMemoryConnectionRegistry();
    const a = recorder();
    reg.bind('a', a.send);
    await reg.joinRoom('a', 'r1');
    await reg.leaveRoom('a');
    await reg.broadcast('r1', sample);
    expect(a.messages).toEqual([]);
  });

  it('joinRoom moves a player from a previous room', async () => {
    const reg = createInMemoryConnectionRegistry();
    const a = recorder();
    reg.bind('a', a.send);
    await reg.joinRoom('a', 'r1');
    await reg.joinRoom('a', 'r2');
    await reg.broadcast('r1', sample);
    expect(a.messages).toEqual([]);
    await reg.broadcast('r2', sample);
    expect(a.messages).toEqual([sample]);
  });

  it('unbind cleans up senders and room membership', async () => {
    const reg = createInMemoryConnectionRegistry();
    const a = recorder();
    reg.bind('a', a.send);
    await reg.joinRoom('a', 'r1');
    reg.unbind('a', a.send);
    await reg.broadcast('r1', sample);
    await reg.sendTo('a', sample);
    expect(a.messages).toEqual([]);
  });

  it('keeps the live socket when a superseded one unbinds', async () => {
    const reg = createInMemoryConnectionRegistry();
    const stale = recorder();
    const fresh = recorder();
    reg.bind('a', stale.send);
    reg.bind('a', fresh.send);
    await reg.joinRoom('a', 'r1');
    reg.unbind('a', stale.send);
    expect(reg.isBound('a', fresh.send)).toBe(true);
    await reg.sendTo('a', sample);
    await reg.broadcast('r1', sample);
    expect(fresh.messages).toEqual([sample, sample]);
    expect(stale.messages).toEqual([]);
  });

  it('findRoomByPlayerId reflects current binding', async () => {
    const reg = createInMemoryConnectionRegistry();
    expect(await reg.findRoomByPlayerId('a')).toBeUndefined();
    await reg.joinRoom('a', 'r1');
    expect(await reg.findRoomByPlayerId('a')).toBe('r1');
    await reg.joinRoom('a', 'r2');
    expect(await reg.findRoomByPlayerId('a')).toBe('r2');
    await reg.leaveRoom('a');
    expect(await reg.findRoomByPlayerId('a')).toBeUndefined();
  });
});
