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
};

export const readTheme = (): CanvasTheme => ({
  pieceWhiteFill: cssVar('foreground', '#fafafa'),
  pieceBlackFill: cssVar('card', '#343434'),
  pieceWhiteText: cssVar('background', '#252525'),
  pieceBlackText: cssVar('foreground', '#fafafa'),
  pieceStroke: cssVar('border', 'rgba(255,255,255,0.15)'),
  selectStroke: cssVar('foreground', '#fafafa'),
  hintStroke: cssVar('muted-foreground', '#b3b3b3'),
  targetFill: 'rgba(250,250,250,0.05)',
  targetStroke: cssVar('muted-foreground', '#b3b3b3'),
});
