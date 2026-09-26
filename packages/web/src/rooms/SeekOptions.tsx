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
};

// A disclosure rather than a dialog: the default seek takes any pieces, so the
// Play button works without anyone opening this.
export const SeekOptions = ({ preference, onChange }: Props) => {
  const accepted = acceptedRulesets(preference);
  const all = acceptedRulesets(ANY_GAME);
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Options · {accepted === all ? 'any pieces' : `${accepted} of ${all} rulesets`}
      </summary>
      <div className="grid gap-2 pt-3">
        {EXPANSIONS.map(({ piece, label, note }) => (
          <fieldset
            key={piece}
            className="m-0 flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <legend className="sr-only">{label}</legend>
            <span className="flex shrink-0">
              <PieceTile type={piece} color="white" />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{note}</span>
            </span>
            <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
              {CHOICES.map(({ value, label: choiceLabel }) => {
                const selected = choiceFor(preference, piece) === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      'cursor-pointer px-2.5 py-1 text-xs transition-colors',
                      'focus-within:ring-2 focus-within:ring-foreground/30',
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
          </fieldset>
        ))}
      </div>
    </details>
  );
};
