import { useState } from 'react';
import type { ExpansionPiece } from '../rooms/expansions.js';
import { usePrefsStore } from '../store/prefs.js';

export type ExpansionDraft = {
  readonly expansions: readonly ExpansionPiece[];
  readonly toggle: (piece: ExpansionPiece) => void;
  /** Saves the draft as the remembered picks and hands it back. */
  readonly commit: () => readonly ExpansionPiece[];
};

// Seeded once from the remembered picks, so ticks made and then dismissed
// survive a reopen without overwriting what is remembered.
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
