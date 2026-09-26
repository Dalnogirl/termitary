// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BASE_RULESET } from '@termitary/engine';
import {
  type MyRoomSummaryDto,
  type SeekBoardDto,
  type SeekDto,
  toWireRuleset,
} from '@termitary/protocol';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyRooms } from './rooms-api.js';
import { cancelSeek, fetchSeekBoard } from './seeks-api.js';
import { useSeeks } from './use-seeks.js';

vi.mock('./seeks-api.js', () => ({
  fetchSeekBoard: vi.fn(),
  seekGame: vi.fn(),
  claimSeek: vi.fn(),
  cancelSeek: vi.fn(),
}));
vi.mock('./rooms-api.js', () => ({ fetchMyRooms: vi.fn() }));

const SEEK: SeekDto = { seekId: 's1', preference: {}, createdAt: 0 };

const room = (roomId: string): MyRoomSummaryDto => ({
  roomId,
  seat: 'white',
  playerCount: 2,
  updatedAt: 0,
  ruleset: toWireRuleset(BASE_RULESET),
});

let board: SeekBoardDto;

beforeEach(() => {
  board = { mine: SEEK, pool: [] };
  vi.mocked(fetchSeekBoard).mockImplementation(async () => board);
  vi.mocked(fetchMyRooms).mockResolvedValue([room('old')]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderSeeks = async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onPaired = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useSeeks(onPaired), { wrapper });
  await waitFor(() => expect(hook.result.current.board.data?.mine).toEqual(SEEK));
  // The snapshot of rooms taken when the seek appeared.
  await waitFor(() => expect(fetchMyRooms).toHaveBeenCalled());
  return { hook, onPaired, queryClient };
};

const seekLeavesBoard = async (queryClient: QueryClient) => {
  board = { mine: null, pool: [] };
  await act(() => queryClient.invalidateQueries({ queryKey: ['seeks'] }));
};

describe('useSeeks', () => {
  it('enters the room a paired seek became', async () => {
    const { onPaired, queryClient } = await renderSeeks();
    vi.mocked(fetchMyRooms).mockResolvedValue([room('old'), room('new')]);

    await seekLeavesBoard(queryClient);

    await waitFor(() => expect(onPaired).toHaveBeenCalledWith('new'));
  });

  it('keeps looking when the first read of the rooms fails', async () => {
    const { onPaired, queryClient } = await renderSeeks();
    vi.mocked(fetchMyRooms)
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue([room('old'), room('new')]);

    await seekLeavesBoard(queryClient);

    await waitFor(() => expect(onPaired).toHaveBeenCalledWith('new'), { timeout: 3_000 });
  });

  it('looks for nothing after the player’s own cancel wins', async () => {
    const { hook, onPaired } = await renderSeeks();
    // A room from elsewhere, say another tab, that the seek had no part in.
    vi.mocked(fetchMyRooms).mockResolvedValue([room('old'), room('elsewhere')]);
    vi.mocked(cancelSeek).mockImplementation(async () => {
      board = { mine: null, pool: [] };
      return 'cancelled';
    });

    await act(() => hook.result.current.cancel.mutateAsync('s1'));

    await waitFor(() => expect(hook.result.current.board.data?.mine).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onPaired).not.toHaveBeenCalled();
  });

  it('still finds the game when the cancel lost to a pairing', async () => {
    const { hook, onPaired } = await renderSeeks();
    vi.mocked(fetchMyRooms).mockResolvedValue([room('old'), room('new')]);
    vi.mocked(cancelSeek).mockImplementation(async () => {
      board = { mine: null, pool: [] };
      return 'gone';
    });

    await act(() => hook.result.current.cancel.mutateAsync('s1'));

    await waitFor(() => expect(onPaired).toHaveBeenCalledWith('new'));
  });
});
