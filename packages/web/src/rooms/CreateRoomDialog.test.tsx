// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateRoomDialog } from './CreateRoomDialog.js';

afterEach(cleanup);

const openDialog = (isPending = false, created = true) => {
  const onCreate = vi.fn(async () => Promise.resolve(created));
  render(
    <CreateRoomDialog triggerLabel="Create new game" isPending={isPending} onCreate={onCreate} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create new game' }));
  return onCreate;
};

describe('CreateRoomDialog', () => {
  it('creates with a random seat unless another is picked', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith('random');
  });

  it('sends the seat the creator picked', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('radio', { name: /Black/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith('black');
  });

  it('stays open when the create fails, with the picked seat intact', async () => {
    const onCreate = openDialog(false, false);
    fireEvent.click(screen.getByRole('radio', { name: /Black/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledWith('black'));
    expect((screen.getByRole('radio', { name: /Black/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('closes once the create succeeds', async () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Create game' })).toBeNull(),
    );
  });

  it('disables the submit while a create is in flight', () => {
    openDialog(true);
    expect(screen.getByRole('button', { name: 'Creating…' })).toHaveProperty('disabled', true);
  });
});
