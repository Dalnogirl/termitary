// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { lobbyRedirect } from './lobby-redirect.js';

afterEach(cleanup);

const Home = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(-1)}>
      back
    </button>
  );
};

describe('lobbyRedirect', () => {
  it('lands on / and leaves Back pointing at the page before', async () => {
    render(
      <MemoryRouter initialEntries={['/hotseat', '/lobby']} initialIndex={1}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/hotseat" element={<p>hotseat</p>} />
          <Route path={lobbyRedirect.path} element={lobbyRedirect.element} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'back' }));

    expect(await screen.findByText('hotseat')).toBeDefined();
  });
});
