import { useState } from 'react';
import type { RenameProfile } from './use-profile.js';

export type NameDraft = {
  readonly editing: boolean;
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  readonly start: () => void;
  readonly submit: () => Promise<void>;
  readonly cancel: () => void;
};

export const useNameDraft = (name: string, rename: RenameProfile): NameDraft => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const start = (): void => {
    rename.reset();
    setDraft(name);
    setEditing(true);
  };

  // A rejected name leaves the field open with what was typed still in it, so
  // the message has something to be about.
  const submit = async (): Promise<void> => {
    if (draft === name) {
      setEditing(false);
      return;
    }
    if (await rename.rename(draft)) setEditing(false);
  };

  const cancel = (): void => {
    rename.reset();
    setEditing(false);
  };

  return { editing, draft, setDraft, start, submit, cancel };
};
