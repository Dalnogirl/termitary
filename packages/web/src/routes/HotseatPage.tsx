import { useEffect, useMemo } from 'react';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { HotseatDialog } from '../hotseat/HotseatDialog.js';
import { type ExpansionPiece, expansionsIn, rulesetFor } from '../rooms/expansions.js';
import { prefsStore } from '../store/prefs.js';
import { gameStore, useGameStore } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

const dealFor = (expansions: readonly ExpansionPiece[]): void =>
  gameStore.getState().reset(rulesetFor(expansions));

export const HotseatPage = () => {
  const controller = useMemo(() => createLocalController(), []);
  const ruleset = useGameStore((s) => s.liveGame.ruleset);

  // A board is dealt before the settings are answered, so closing the dialog
  // unanswered leaves a playable game rather than an empty screen. It uses the
  // remembered pieces, which are the ones the dialog opens ticked.
  useEffect(() => {
    dealFor(prefsStore.getState().expansions);
  }, []);

  const playing = expansionsIn(ruleset);

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground">
            <span>
              {playing.length === 0
                ? 'Base pieces'
                : `Base pieces, ${playing.map((expansion) => expansion.label.toLowerCase()).join(' and ')}`}
            </span>
            <HotseatDialog defaultOpen onStart={dealFor} />
          </div>
          <GameLayout />
        </div>
      </InputProvider>
    </RoomProvider>
  );
};
