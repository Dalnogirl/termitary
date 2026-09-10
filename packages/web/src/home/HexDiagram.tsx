import { axialToPixel } from '../board/hex.js';

const SIZE = 20;
const PAD = 6;
const CHIP = 8;

type Tone = 'white' | 'black' | 'ghost';

export type DiagramCell = {
  readonly q: number;
  readonly r: number;
  readonly tone: Tone;
  readonly label?: string;
  // Drawn as a corner chip, the same way the board marks a covered piece.
  readonly covers?: Tone;
};

const TONES: Record<Tone, { fill: string; stroke: string; text: string; dash?: string }> = {
  white: { fill: 'var(--foreground)', stroke: 'var(--border)', text: 'var(--background)' },
  black: { fill: 'var(--card)', stroke: 'var(--border)', text: 'var(--foreground)' },
  ghost: {
    fill: 'var(--board-target-fill)',
    stroke: 'var(--board-target-stroke)',
    text: 'var(--muted-foreground)',
    dash: '4 3',
  },
};

const points = (cx: number, cy: number, size: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');

export const HexDiagram = ({ cells }: { readonly cells: readonly DiagramCell[] }) => {
  const centers = cells.map((c) => axialToPixel(c, SIZE));
  const xs = centers.map((p) => p.x);
  const ys = centers.map((p) => p.y);
  const minX = Math.min(...xs) - SIZE - PAD;
  const minY = Math.min(...ys) - SIZE - PAD;
  const width = Math.max(...xs) + SIZE + PAD - minX;
  const height = Math.max(...ys) + SIZE + PAD - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="h-24 w-full"
      role="presentation"
      aria-hidden="true"
    >
      {cells.map((cell, i) => {
        const p = centers[i];
        if (!p) return null;
        const tone = TONES[cell.tone];
        const covered = cell.covers === undefined ? undefined : TONES[cell.covers];
        return (
          <g key={`${cell.q},${cell.r},${cell.tone}`}>
            <polygon
              points={points(p.x, p.y, SIZE - 1)}
              fill={tone.fill}
              stroke={tone.stroke}
              strokeWidth={1.5}
              {...(tone.dash === undefined ? {} : { strokeDasharray: tone.dash })}
            />
            {cell.label === undefined ? null : (
              <text
                x={p.x}
                y={p.y}
                fill={tone.text}
                fontSize={SIZE}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {cell.label}
              </text>
            )}
            {covered === undefined ? null : (
              <polygon
                points={points(p.x + SIZE * 0.55, p.y - SIZE * 0.65, CHIP)}
                fill={covered.fill}
                stroke={covered.stroke}
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};
