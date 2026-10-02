import { Button } from '@/components/ui/button';
import { PROFILE_NAME_MAX } from '@termitary/protocol';
import { useNameDraft } from './use-name-draft.js';
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
  const { editing, draft, setDraft, start, submit, cancel } = useNameDraft(name, rename);

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
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
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
        <Button type="button" size="sm" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
      {rename.error !== null && <p className="text-sm text-foreground">{rename.error}</p>}
    </form>
  );
};
