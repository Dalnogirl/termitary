import type { ExpansionPiece } from '@termitary/engine';
import { useState } from 'react';
import { usePrefsStore } from '../store/prefs.js';

export type ExpansionDraft = {
  readonly expansions: readonly ExpansionPiece[];
  readonly toggle: (piece: ExpansionPiece) => void;
  readonly commit: () => readonly ExpansionPiece[];
};

export const useExpansionDraft = (): ExpansionDraft => {
  const rememberedExpansions = usePrefsStore((s) => s.expansions);
  const setRememberedExpansions = usePrefsStore((s) => s.setExpansions);
  const [expansions, setExpansions] = useState<readonly ExpansionPiece[]>(rememberedExpansions);

  const toggle = (piece: ExpansionPiece): void =>
    setExpansions((picked) =>
      picked.includes(piece) ? picked.filter((p) => p !== piece) : [...picked, piece],
    );

  const commit = (): readonly ExpansionPiece[] => {
    setRememberedExpansions(expansions);
    return expansions;
  };

  return { expansions, toggle, commit };
};
