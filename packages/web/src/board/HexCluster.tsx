import type { HexCoord, Piece } from '@hive/engine';
import { useEffect, useRef } from 'react';
import { usePrefsStore } from '../store/prefs.js';
import { axialToPixel, traceHex } from './hex.js';
import {
  CHIP_RADIUS,
  CHIP_SIZE,
  HEX_DRAW_SIZE,
  HEX_RADIUS,
  HEX_SIZE,
  TARGET_DASH,
  TARGET_RADIUS,
  TARGET_SIZE,
} from './metrics.js';
import { type PieceSet, markFor } from './piece-sets.js';
import { type PieceHue, pieceFill, pieceInk } from './pieces.js';
import { type CanvasTheme, readTheme } from './theme.js';

export type ClusterCell =
  | {
      readonly kind: 'piece';
      readonly at: HexCoord;
      readonly piece: Piece;
      // Drawn as the corner chip the board uses for a covered piece.
      readonly covers?: Piece;
    }
  | { readonly kind: 'target'; readonly at: HexCoord };

const PAD = 6;

const mark = (
  ctx: CanvasRenderingContext2D,
  set: PieceSet,
  hue: PieceHue,
  piece: Piece,
  x: number,
  y: number,
  hexSize: number,
): void => {
  const ink = pieceInk(piece.type, piece.color, hue);
  const m = markFor(set, piece.type, hexSize);
  if (m.kind === 'text') {
    ctx.font = `bold ${m.fontSize}px ${m.font}`;
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, x, y + m.dy);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(m.scale, m.scale);
  ctx.translate(-m.cx, -m.cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of m.shapes) {
    const path = new Path2D(shape.d);
    if (shape.kind === 'fill') {
      ctx.fillStyle = ink;
      ctx.fill(path);
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = shape.width;
      ctx.stroke(path);
    }
  }
  ctx.restore();
};

const drawPiece = (
  ctx: CanvasRenderingContext2D,
  set: PieceSet,
  hue: PieceHue,
  theme: CanvasTheme,
  cell: ClusterCell,
): void => {
  if (cell.kind !== 'piece') return;
  const p = axialToPixel(cell.at, HEX_SIZE);

  traceHex(ctx, p, HEX_DRAW_SIZE, HEX_RADIUS);
  ctx.fillStyle = pieceFill(cell.piece, theme);
  ctx.fill();
  mark(ctx, set, hue, cell.piece, p.x, p.y, HEX_DRAW_SIZE);

  if (cell.covers === undefined) return;
  const chip = { x: p.x + HEX_SIZE * 0.55, y: p.y - HEX_SIZE * 0.65 };
  traceHex(ctx, chip, CHIP_SIZE, CHIP_RADIUS);
  ctx.fillStyle = pieceFill(cell.covers, theme);
  ctx.fill();
  ctx.strokeStyle = theme.pieceStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  mark(ctx, set, hue, cell.covers, chip.x, chip.y, CHIP_SIZE);
};

const drawTarget = (ctx: CanvasRenderingContext2D, theme: CanvasTheme, cell: ClusterCell): void => {
  if (cell.kind !== 'target') return;
  const p = axialToPixel(cell.at, HEX_SIZE);
  traceHex(ctx, p, TARGET_SIZE, TARGET_RADIUS);
  ctx.fillStyle = theme.targetFill;
  ctx.fill();
  ctx.setLineDash([...TARGET_DASH.pattern]);
  ctx.lineDashOffset = TARGET_DASH.offset;
  ctx.strokeStyle = theme.targetStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
};

const bounds = (cells: readonly ClusterCell[]) => {
  const centers = cells.map((c) => axialToPixel(c.at, HEX_SIZE));
  const xs = centers.map((p) => p.x);
  const ys = centers.map((p) => p.y);
  const minX = Math.min(...xs) - HEX_SIZE - PAD;
  const minY = Math.min(...ys) - HEX_SIZE - PAD;
  return {
    minX,
    minY,
    width: Math.max(...xs) + HEX_SIZE + PAD - minX,
    height: Math.max(...ys) + HEX_SIZE + PAD - minY,
  };
};

export const HexCluster = ({ cells }: { readonly cells: readonly ClusterCell[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pieceSet = usePrefsStore((s) => s.pieceSet);
  const pieceHue = usePrefsStore((s) => s.pieceHue);
  // bounds() spreads into Math.min, which is Infinity over an empty array.
  const box = cells.length === 0 ? null : bounds(cells);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box === null) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paint = (): void => {
      const theme = readTheme();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(box.width * dpr);
      canvas.height = Math.ceil(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, -box.minX * dpr, -box.minY * dpr);
      ctx.clearRect(box.minX, box.minY, box.width, box.height);
      for (const cell of cells) drawPiece(ctx, pieceSet, pieceHue, theme, cell);
      for (const cell of cells) drawTarget(ctx, theme, cell);
    };

    paint();

    // Deferred: nothing toggles the root class yet. readTheme() samples CSS
    // custom properties, and the board gets a repaint from every store change
    // while a static cluster gets none, so whoever adds a theme switch would
    // otherwise leave these stale.
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [cells, box, pieceSet, pieceHue]);

  // A black piece is filled with the near-black tile tone, so on a card it is
  // invisible. The
  // board draws it against --background; the cluster carries that ground with
  // it rather than depending on wherever it is dropped.
  if (box === null) return null;

  return (
    <div className="flex justify-center rounded-lg bg-background p-2">
      <canvas
        ref={canvasRef}
        style={{ width: `${box.width}px`, height: `${box.height}px` }}
        className="max-w-full"
      />
    </div>
  );
};
