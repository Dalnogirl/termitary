import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Piece, PieceType } from '@termitary/engine';
import { Link } from 'react-router';
import { type ClusterCell, HexCluster } from '../board/HexCluster.js';
import { Logo } from '../brand/Logo.js';
import { paths } from '../routes/paths.js';
import { HomeHero } from './HomeHero.js';

const w = (type: PieceType): Piece => ({ type, color: 'white' });
const b = (type: PieceType): Piece => ({ type, color: 'black' });

const RULES: readonly {
  readonly title: string;
  readonly body: string;
  readonly cells: readonly ClusterCell[];
}[] = [
  {
    title: 'Pieces enter one at a time',
    body: 'After the opening two, a new piece goes down touching your own colour and nothing else. Your queen has to be on the board by your fourth turn.',
    cells: [
      { kind: 'piece', at: { q: 0, r: 0 }, piece: w('queen') },
      { kind: 'piece', at: { q: 1, r: 0 }, piece: b('ant') },
      { kind: 'target', at: { q: -1, r: 0 } },
      { kind: 'target', at: { q: 0, r: -1 } },
    ],
  },
  {
    title: 'Every piece moves its own way',
    body: 'Ants run the whole perimeter. Spiders go exactly three steps. Grasshoppers jump straight over a line of pieces. Beetles climb on top and pin whatever they land on.',
    cells: [
      { kind: 'piece', at: { q: 0, r: 0 }, piece: b('beetle'), covers: w('spider') },
      { kind: 'piece', at: { q: 1, r: 0 }, piece: w('ant') },
      { kind: 'piece', at: { q: 0, r: 1 }, piece: b('grasshopper') },
    ],
  },
  {
    title: 'The hive stays whole',
    body: 'A move that breaks the hive into two groups is illegal. So is squeezing through a gap too narrow to slide out of.',
    cells: [
      { kind: 'piece', at: { q: 0, r: 0 }, piece: w('spider') },
      { kind: 'piece', at: { q: 1, r: 0 }, piece: b('queen') },
      { kind: 'piece', at: { q: 2, r: 0 }, piece: w('ant') },
      { kind: 'piece', at: { q: 1, r: 1 }, piece: b('grasshopper') },
    ],
  },
];

export const SignedOutHome = () => (
  <>
    <HomeHero height="partial">
      <Logo size="hero" layout="stacked" as="h1" />
      <p className="text-lg text-foreground">
        A board game with no board. Bring out your queen, then bury the other one under six pieces.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to={paths.hotseat} className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}>
          Play on this device
        </Link>
        <Link
          to={paths.lobby}
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
        >
          Play online
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        That board is a real game, mid-play. Click a piece and it's yours. Hot-seat needs no
        account.
      </p>
    </HomeHero>

    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
      <h2 className="text-2xl font-bold tracking-tight">Three rules and you're playing</h2>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {RULES.map((rule) => (
          <li
            key={rule.title}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
          >
            <HexCluster cells={rule.cells} />
            <h3 className="text-base font-semibold">{rule.title}</h3>
            <p className="text-sm text-muted-foreground">{rule.body}</p>
          </li>
        ))}
      </ul>
    </section>
  </>
);
