// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NameEditor } from './NameEditor.js';
import type { RenameProfile } from './use-profile.js';

afterEach(cleanup);

const editor = (over: Partial<RenameProfile> = {}) => {
  const rename: RenameProfile = {
    rename: vi.fn(async () => Promise.resolve(true)),
    isSaving: false,
    error: null,
    reset: vi.fn(),
    ...over,
  };
  render(<NameEditor name="Ada" rename={rename} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  return rename;
};

describe('NameEditor', () => {
  it('sends the typed name', async () => {
    const rename = editor();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(rename.rename).toHaveBeenCalledWith('Grace');
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('keeps the rejected name in the field, under the reason', async () => {
    editor({
      rename: vi.fn(async () => Promise.resolve(false)),
      error: 'Name must be 2 to 32 characters.',
    });
    const field = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name must be 2 to 32 characters.')).toBeDefined();
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('a');
  });
});
