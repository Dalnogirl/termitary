import { messageOf } from '../lib/message-of.js';

export const rowClass =
  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50';

export const RowAction = ({ children }: { readonly children: string }) => (
  <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
    {children}
    <span aria-hidden="true"> →</span>
  </span>
);

export const LoadError = ({ error }: { readonly error: unknown }) => (
  <p className="m-0 px-3 text-sm">Could not load: {messageOf(error)}</p>
);
