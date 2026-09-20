import type { Page } from '@playwright/test';
import type { HexCoord } from '@termitary/engine';

export type ViewportPoint = { readonly x: number; readonly y: number };

export type DrawnPiece = {
  readonly color: 'white' | 'black';
  readonly type: string;
};

type CellProbe = {
  readonly viewport: ViewportPoint;
  readonly piece: DrawnPiece | null;
  /** The name of whatever is under the point: 'piece', 'target', or null. */
  readonly hit: string | null;
};

// Vite serves the app's own modules by source URL, so the axial-to-pixel maths
// and the hex size are the ones the board draws with rather than a copy of
// them. The specifiers are variables because a literal would send tsc looking
// for a Node module.
const HEX_MODULE = '/src/board/hex.ts';
const METRICS_MODULE = '/src/board/metrics.ts';

type KonvaNode = {
  name(): string;
  getAttr(key: string): unknown;
  getParent(): KonvaNode | null;
};

type KonvaStage = {
  getLayers(): Array<{ getAbsoluteTransform(): { point(p: ViewportPoint): ViewportPoint } }>;
  container(): HTMLElement;
  getIntersection(p: ViewportPoint): KonvaNode | null;
};

/**
 * Where a cell is on screen and what is drawn on it, both read through the
 * board layer's live transform, so a pan or a zoom cannot drift either one.
 */
const probeCell = async (page: Page, coord: HexCoord): Promise<CellProbe> =>
  page.evaluate(
    async ({ coord, hexModule, metricsModule }) => {
      const { axialToPixel } = (await import(hexModule)) as {
        axialToPixel: (c: HexCoord, size: number) => ViewportPoint;
      };
      const { HEX_SIZE } = (await import(metricsModule)) as { HEX_SIZE: number };

      const konva = (window as unknown as { Konva?: { stages: KonvaStage[] } }).Konva;
      const stage = konva?.stages[0];
      if (!stage) throw new Error('no Konva stage on the page');
      const [board] = stage.getLayers();
      if (!board) throw new Error('the stage has no board layer');

      const inStage = board.getAbsoluteTransform().point(axialToPixel(coord, HEX_SIZE));
      const hit = stage.getIntersection(inStage);
      // The hit is the hex path; the attrs live on the tile group above it.
      let node: KonvaNode | null = hit;
      while (node !== null && node.name() !== 'piece') node = node.getParent();

      const rect = stage.container().getBoundingClientRect();
      return {
        viewport: { x: rect.left + inStage.x, y: rect.top + inStage.y },
        hit: node?.name() ?? hit?.name() ?? null,
        piece:
          node === null
            ? null
            : {
                color: node.getAttr('pieceColor') as 'white' | 'black',
                type: node.getAttr('pieceType') as string,
              },
      };
    },
    { coord, hexModule: HEX_MODULE, metricsModule: METRICS_MODULE },
  );

export const clickCell = async (page: Page, coord: HexCoord): Promise<void> => {
  const { viewport } = await probeCell(page, coord);
  await page.mouse.click(viewport.x, viewport.y);
};

export const pieceAt = async (page: Page, coord: HexCoord): Promise<DrawnPiece | null> =>
  (await probeCell(page, coord)).piece;

/** What a click on this cell would land on, as the board has drawn it. */
export const hitAt = async (page: Page, coord: HexCoord): Promise<string | null> =>
  (await probeCell(page, coord)).hit;
