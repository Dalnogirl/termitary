const cssVar = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v || fallback;
};

export type CanvasTheme = {
  readonly pieceWhiteFill: string;
  readonly pieceBlackFill: string;
  readonly pieceWhiteText: string;
  readonly pieceBlackText: string;
  readonly pieceStroke: string;
  readonly selectStroke: string;
  readonly hintStroke: string;
  readonly targetFill: string;
  readonly targetStroke: string;
  readonly targetFillActive: string;
  readonly targetStrokeActive: string;
  readonly lastMoveStroke: string;
};

export const readTheme = (): CanvasTheme => ({
  // The two tile tones are the physical set's: ivory and near-black. They do not
  // follow the theme, because the player they stand for does not.
  pieceWhiteFill: cssVar('piece-white-fill', '#e9e2d2'),
  pieceBlackFill: cssVar('piece-black-fill', '#343434'),
  pieceWhiteText: cssVar('background', '#252525'),
  pieceBlackText: cssVar('foreground', '#fafafa'),
  pieceStroke: cssVar('border', 'rgba(255,255,255,0.15)'),
  selectStroke: cssVar('foreground', '#fafafa'),
  hintStroke: cssVar('muted-foreground', '#b3b3b3'),
  targetFill: cssVar('board-target-fill', 'rgb(255 255 255 / 10%)'),
  targetStroke: cssVar('board-target-stroke', 'rgb(255 255 255 / 45%)'),
  targetFillActive: cssVar('board-target-fill-active', 'rgb(255 255 255 / 28%)'),
  targetStrokeActive: cssVar('board-target-stroke-active', 'rgb(255 255 255)'),
  lastMoveStroke: cssVar('board-last-move-stroke', 'oklch(0.78 0.15 65)'),
});
