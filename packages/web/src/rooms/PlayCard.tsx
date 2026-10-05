import { Button } from '@/components/ui/button';
import type { SeekDto } from '@termitary/protocol';
import { useState } from 'react';
import { SeekOptions } from './SeekOptions.js';
import { seekBadges } from './seek-terms.js';
import { useElapsed } from './use-elapsed.js';
import type { Lobby } from './use-lobby.js';

const cardClass = 'flex flex-col gap-4 rounded-xl border border-border bg-card p-5';

const termsSummary = (badges: readonly string[]): string =>
  badges.length === 0 ? 'Any pieces' : badges.join(' · ');

// The terms come from the seek rather than the picker, which a reload resets.
const Waiting = ({ lobby, seek }: { readonly lobby: Lobby; readonly seek: SeekDto }) => {
  const elapsed = useElapsed(seek.createdAt);
  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden="true" className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-3 rounded-full bg-primary" />
        </span>
        {/* The clock stays outside the status, which would announce every tick. */}
        <div className="flex flex-1 flex-col">
          <output className="text-base font-semibold">
            Looking for an opponent
            <span className="sr-only">, {termsSummary(seekBadges(seek.preference))}</span>
          </output>
          <span className="text-xs text-muted-foreground tabular-nums">
            <span role="timer">{elapsed}</span>
            <span aria-hidden="true"> · {termsSummary(seekBadges(seek.preference))}</span>
          </span>
        </div>
        <Button size="lg" variant="outline" disabled={lobby.busy} onClick={lobby.cancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
};

/** Play and the terms it posts with, or the wait once a seek stands. */
export const PlayCard = ({ lobby }: { readonly lobby: Lobby }) => {
  const [termsOpen, setTermsOpen] = useState(false);

  if (lobby.mySeek !== null) return <Waiting lobby={lobby} seek={lobby.mySeek} />;

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          className="h-11 px-8 text-base"
          disabled={lobby.busy}
          onClick={lobby.play}
        >
          {lobby.finding ? 'Finding a game…' : 'Play'}
        </Button>
        <div className="flex flex-col">
          <span className="text-sm">{termsSummary(seekBadges(lobby.preference))}</span>
          <button
            type="button"
            aria-expanded={termsOpen}
            className="self-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setTermsOpen((open) => !open)}
          >
            {termsOpen ? 'Hide pieces' : 'Choose pieces'}
          </button>
        </div>
      </div>
      {termsOpen && <SeekOptions preference={lobby.preference} onChange={lobby.setPreference} />}
    </section>
  );
};
