export type HexCoord = { readonly q: number; readonly r: number };

const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const key = (c: HexCoord): string => `${c.q},${c.r}`;

export const neighbors = (c: HexCoord): HexCoord[] =>
  HEX_DIRECTIONS.map((d) => ({ q: c.q + d.q, r: c.r + d.r }));

export const parse = (s: string): HexCoord => {
  const i = s.indexOf(',');
  return { q: Number(s.slice(0, i)), r: Number(s.slice(i + 1)) };
};
