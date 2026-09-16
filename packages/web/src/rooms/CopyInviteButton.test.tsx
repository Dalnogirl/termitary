// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyInviteButton } from './CopyInviteButton.js';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
  }),
}));

const setClipboard = (clipboard: unknown) => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
};

const clickCopy = () => {
  render(<CopyInviteButton />);
  fireEvent.click(screen.getByRole('button', { name: /Copy invite link/ }));
};

afterEach(cleanup);
beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
});

describe('CopyInviteButton', () => {
  it('copies the current URL and confirms', async () => {
    const writeText = vi.fn(async () => Promise.resolve());
    setClipboard({ writeText });

    clickCopy();
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Invite link copied'));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('says so instead of throwing when there is no clipboard', async () => {
    setClipboard(undefined);

    clickCopy();
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('says so instead of throwing when the write is rejected', async () => {
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error('denied'))) });

    clickCopy();
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
