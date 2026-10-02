// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNameDraft } from './use-name-draft.js';
import type { RenameProfile } from './use-profile.js';

afterEach(cleanup);

const renderDraft = (accepted = true) => {
  const rename: RenameProfile = {
    rename: vi.fn(async () => accepted),
    isSaving: false,
    error: null,
    reset: vi.fn(),
  };
  const hook = renderHook(() => useNameDraft('Ada', rename));
  act(() => hook.result.current.start());
  return { hook, rename };
};

describe('useNameDraft', () => {
  it('closes without a request when the name is unchanged', async () => {
    const { hook, rename } = renderDraft();

    await act(() => hook.result.current.submit());

    expect(rename.rename).not.toHaveBeenCalled();
    expect(hook.result.current.editing).toBe(false);
  });

  it('stays open on the typed name when the server refuses it', async () => {
    const { hook } = renderDraft(false);
    act(() => hook.result.current.setDraft('a'));

    await act(() => hook.result.current.submit());

    expect(hook.result.current.editing).toBe(true);
    expect(hook.result.current.draft).toBe('a');
  });

  it('starts each edit from the current name and a cleared error', () => {
    const { hook, rename } = renderDraft();
    act(() => hook.result.current.setDraft('Grace'));
    act(() => hook.result.current.cancel());
    vi.mocked(rename.reset).mockClear();

    act(() => hook.result.current.start());

    expect(hook.result.current.draft).toBe('Ada');
    expect(rename.reset).toHaveBeenCalledOnce();
  });
});
