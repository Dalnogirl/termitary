import type { HexCoord, Piece } from '@hive/engine';
import { useEffect, useRef } from 'react';
import { axialToPixel, traceHex } from './hex.js';
import {
  CHIP_RADIUS,
  CHIP_SIZE,
  HEX_DRAW_SIZE,
  HEX_RADIUS,
  HEX_SIZE,
  PIECE_FONT,
  TARGET_DASH,
  TARGET_RADIUS,
  TARGET_SIZE,
} from './metrics.js';
import { pieceFill, pieceLetter, pieceTextColor } from './pieces.js';
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

const label = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
): void => {
  ctx.font = `bold ${size}px ${PIECE_FONT}`;
  ctx.fillStyle = fill;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
};

const drawPiece = (ctx: CanvasRenderingContext2D, theme: CanvasTheme, cell: ClusterCell): void => {
  if (cell.kind !== 'piece') return;
  const p = axialToPixel(cell.at, HEX_SIZE);

  traceHex(ctx, p, HEX_DRAW_SIZE, HEX_RADIUS);
  ctx.fillStyle = pieceFill(cell.piece, theme);
  ctx.fill();
  label(ctx, pieceLetter(cell.piece.type), p.x, p.y, HEX_SIZE, pieceTextColor(cell.piece, theme));

  if (cell.covers === undefined) return;
  const chip = { x: p.x + HEX_SIZE * 0.55, y: p.y - HEX_SIZE * 0.65 };
  traceHex(ctx, chip, CHIP_SIZE, CHIP_RADIUS);
  ctx.fillStyle = pieceFill(cell.covers, theme);
  ctx.fill();
  ctx.strokeStyle = theme.pieceStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(
    ctx,
    pieceLetter(cell.covers.type),
    chip.x,
    chip.y,
    CHIP_SIZE,
    pieceTextColor(cell.covers, theme),
  );
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
  const box = bounds(cells);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paint = (): void => {
      const theme = readTheme();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(box.width * dpr);
      canvas.height = Math.ceil(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, -box.minX * dpr, -box.minY * dpr);
      ctx.clearRect(box.minX, box.minY, box.width, box.height);
      for (const cell of cells) drawPiece(ctx, theme, cell);
      for (const cell of cells) drawTarget(ctx, theme, cell);
    };

    paint();

    // readTheme() samples CSS custom properties, so a palette or piece-theme
    // swap only shows up on a repaint. The board repaints on every store
    // change; a static cluster has to watch the class that carries the theme.
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [cells, box.width, box.height, box.minX, box.minY]);

  // A black piece is filled with --card, so on a card it is invisible. The
  // board draws it against --background; the cluster carries that ground with
  // it rather than depending on wherever it is dropped.
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
