// Every role a cell can play in the current selection, as cell keys.
export type Marks = {
  readonly movable: ReadonlySet<string>;
  readonly throwable: ReadonlySet<string>;
  readonly selected: string | null;
  readonly lifted: string | null;
  readonly lastMove: string | null;
};

// A piece in hand selects no cell, so placing leaves the board undimmed. A
// pillbug's throwable neighbours are the next click, so they stay lit.
export const isDimmed = (marks: Marks, key: string): boolean =>
  marks.selected !== null &&
  key !== marks.selected &&
  key !== marks.lifted &&
  !marks.throwable.has(key);
