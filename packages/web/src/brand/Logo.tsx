import { cn } from '@/lib/utils';
import { MARK_GAP, moundPath, moundViewBox } from './mound.js';

const LATTICE = 40;
const MARK_D = moundPath(LATTICE, MARK_GAP);
const MARK_VIEW_BOX = moundViewBox(LATTICE, MARK_GAP);

export type LogoSize = 'nav' | 'hero';

const MARK_HEIGHT: Record<LogoSize, string> = { nav: 'h-6', hero: 'h-14' };
const WORDMARK_TEXT: Record<LogoSize, string> = { nav: 'text-base', hero: 'text-4xl' };

export const Mark = ({ className }: { readonly className?: string }) => (
  <svg
    viewBox={MARK_VIEW_BOX}
    className={cn('w-auto text-(--piece-white-fill)', className)}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d={MARK_D} />
  </svg>
);

// The one definition of the word. Both the nav and the hero come through here,
// so they cannot drift apart on case or tracking again.
export const Wordmark = ({ className }: { readonly className?: string }) => (
  <span className={cn('font-sans font-semibold lowercase tracking-[-0.005em]', className)}>
    termitary
  </span>
);

type Props = {
  readonly size: LogoSize;
  readonly layout?: 'horizontal' | 'stacked';
  readonly as?: 'span' | 'h1';
  readonly className?: string;
};

export const Logo = ({ size, layout = 'horizontal', as: Tag = 'span', className }: Props) => (
  <Tag
    className={cn(
      'flex items-center',
      layout === 'stacked' ? 'flex-col items-start gap-3' : 'gap-2',
      className,
    )}
  >
    <Mark className={MARK_HEIGHT[size]} />
    <Wordmark className={WORDMARK_TEXT[size]} />
  </Tag>
);
