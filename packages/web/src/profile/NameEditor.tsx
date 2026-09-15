import { Button } from '@/components/ui/button';
import { PROFILE_NAME_MAX } from '@termitary/protocol';
import { useState } from 'react';
import type { RenameProfile } from './use-profile.js';

const inputClass =
  'rounded-md border border-border bg-card px-3 py-1 text-2xl font-bold tracking-tight ' +
  'text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export const NameEditor = ({
  name,
  rename,
}: {
  readonly name: string;
  readonly rename: RenameProfile;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const start = () => {
    rename.reset();
    setDraft(name);
    setEditing(true);
  };

  // A rejected name leaves the field open with what was typed still in it, so
  // the message has something to be about.
  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (draft === name) {
      setEditing(false);
      return;
    }
    if (await rename.rename(draft)) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <Button size="sm" variant="ghost" onClick={start}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)}>
      <div className="flex items-center gap-2">
        <input
          // biome-ignore lint/a11y/noAutofocus: the field replaces the heading the click was on
          autoFocus
          className={inputClass}
          maxLength={PROFILE_NAME_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Display name"
        />
        <Button type="submit" size="sm" disabled={rename.isSaving}>
          {rename.isSaving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            rename.reset();
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {rename.error !== null && <p className="text-sm text-foreground">{rename.error}</p>}
    </form>
  );
};
