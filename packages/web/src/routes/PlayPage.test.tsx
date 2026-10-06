// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoomConnection } from '../controller/use-room-connection.js';
import { paths, patterns } from './paths.js';

let connection: RoomConnection;

vi.mock('../controller/use-room-connection.js', () => ({
  useRoomConnection: () => connection,
}));

const { PlayPage } = await import('./PlayPage.js');

const connectionIn = (status: RoomConnection['status']): RoomConnection => ({
  status,
  myColor: null,
  opponent: null,
  clock: null,
  controller: null,
  resign: () => {},
});

const Back = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      back
    </button>
  );
};

const renderRoom = () =>
  render(
    <MemoryRouter initialEntries={[paths.hotseat, paths.play('r1')]} initialIndex={1}>
      <Routes>
        <Route index element={<p>home</p>} />
        <Route path={patterns.hotseat} element={<p>hotseat</p>} />
        <Route path={patterns.play} element={<PlayPage />} />
        <Route path={patterns.archivedGame} element={<Back />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('PlayPage', () => {
  it('sends a failed room home', async () => {
    connection = connectionIn('error');
    renderRoom();

    expect(await screen.findByText('home')).toBeDefined();
  });

  it('sends an aborted room home', async () => {
    connection = connectionIn('aborted');
    renderRoom();

    expect(await screen.findByText('home')).toBeDefined();
  });

  it('replaces an archived room with its archive, so Back skips the room', async () => {
    connection = connectionIn('archived');
    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'back' }));

    expect(await screen.findByText('hotseat')).toBeDefined();
  });
});
