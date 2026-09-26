import { cn } from '@/lib/utils';
import { ANY_GAME, type SeekPreference } from '@termitary/protocol';
import { PieceTile } from '../board/PieceTile.js';
import { EXPANSIONS } from './expansions.js';
import { type TriState, acceptedRulesets, choiceFor, withChoice } from './seek-terms.js';

const CHOICES: readonly { readonly value: TriState; readonly label: string }[] = [
  { value: 'require', label: 'Yes' },
  { value: 'either', label: 'Either' },
  { value: 'exclude', label: 'No' },
];

type Props = {
  readonly preference: SeekPreference;
  readonly onChange: (preference: SeekPreference) => void;
  /** A standing seek keeps the terms it was posted with. */
  readonly locked: boolean;
};

export const SeekOptions = ({ preference, onChange, locked }: Props) => {
  const accepted = acceptedRulesets(preference);
  const all = acceptedRulesets(ANY_GAME);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Expansion pieces</h2>
        <p className="m-0 text-xs text-muted-foreground">
          {locked
            ? 'Cancel your seek to change these.'
            : accepted === all
              ? 'Any pieces. Play pairs with whoever is waiting.'
              : `Play accepts ${accepted} of ${all} rulesets.`}
        </p>
      </div>
      <fieldset disabled={locked} className="m-0 grid gap-3 border-0 p-0 disabled:opacity-60">
        {EXPANSIONS.map(({ piece, label, note }) => (
          <fieldset key={piece} className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="sr-only">{label}</legend>
            <div className="flex items-center gap-2">
              <PieceTile type={piece} color="white" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
                {CHOICES.map(({ value, label: choiceLabel }) => {
                  const selected = choiceFor(preference, piece) === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        'px-2.5 py-1 text-xs transition-colors',
                        'focus-within:ring-2 focus-within:ring-foreground/30',
                        locked ? 'cursor-not-allowed' : 'cursor-pointer',
                        selected
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <input
                        type="radio"
                        name={`seek-${piece}`}
                        value={value}
                        checked={selected}
                        onChange={() => onChange(withChoice(preference, piece, value))}
                        className="sr-only"
                      />
                      {choiceLabel}
                    </label>
                  );
                })}
              </span>
            </div>
            <p className="m-0 text-xs text-muted-foreground">{note}</p>
          </fieldset>
        ))}
      </fieldset>
    </section>
  );
};
