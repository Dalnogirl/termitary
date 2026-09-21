# Termitary Engine — Core Architecture

Design decisions for the pure game engine (`packages/engine`). Implementation details, not project plan.

Code samples are abridged. They show the shape of the real thing, not every guard.

---

## Coordinate System: Axial `{ q, r }`

Standard hex coord system for sparse, unbounded boards.

- Two-axis representation, 60° between axes
- Math-friendly (neighbors = 6 fixed offsets, no row-parity branches)
- Reference: [Red Blob Games hex grids](https://www.redblobgames.com/grids/hexagons/)

```ts
export type HexCoord = { readonly q: number; readonly r: number };

const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
  { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 },
];
```

Cube coords never appeared. Nothing needed a distance, so `distance` and ring detection were dropped before they were written. `hex.ts` is `neighbors`, `sharedNeighbors`, `key`, `parse`.

Rejected: offset coords (ugly math on unbounded boards), doubled coords (niche).

---

## Board Storage: Sparse Map

Hive has no fixed field — pieces *are* the field. Storage must reflect that.

```ts
export type Board = { readonly cells: ReadonlyMap<string, readonly Piece[]> };
//                                                       ^^^^^^^^^^^^^^^^
//                                                       stack, bottom to top
//                                                       — for beetle climbing
```

**Why sparse map over 2D array:**
- No bounds to pre-allocate (pieces can be placed anywhere)
- Negative coords work naturally
- O(1) lookup, no memory waste on empty cells
- Iteration is over occupied cells only

**Key encoding:** string `"q,r"` for now. Bit-packing or a custom Map only if profiling shows a hotspot.

**No `width`/`height`/`bounds`.** There aren't any. Renderer computes bounding box of occupied cells to center the viewport.

Serialization is not free, because a `Map` is not JSON. `@termitary/protocol` owns that conversion (`toWire`/`fromWire`), and the engine stays ignorant of the wire.

`board.ts` is the accessors plus two mutators that return new boards:

```ts
export const topPieceAt = (b: Board, c: HexCoord): Piece | undefined =>
  b.cells.get(key(c))?.at(-1);
export const stackAt    = (b: Board, c: HexCoord): readonly Piece[] => ...;
export const isEmpty    = (b: Board, c: HexCoord): boolean => !b.cells.has(key(c));
export const place      = (b: Board, c: HexCoord, p: Piece): Board => ...;
export const remove     = (b: Board, c: HexCoord): Board => ...;
```

`place` and `remove` stay out of the package's public exports. `applyMove` validating a move by membership in `listValidMoves` is only an invariant while no caller outside the engine can assemble a board by hand.

---

## Coordinate Origin: Absolute, Drifting

White's first piece goes to `(0, 0)`. Everything else relative. Coords can drift negative or positive freely.

Rejected: periodic re-centering (normalization). Optimizes a non-problem and breaks move history references.

---

## Three-Layer Movement Architecture

The hardest design decision. Single Responsibility split:

```
movements/{queen,ant,...}.ts  →  "an Ant CAN reach these hexes by sliding"
                                  (geometric + piece-specific physical constraints)

occupancy.ts + board.ts       →  neighbors, canSlide, isConnectedWithout
                                  (pure topology, knows nothing about piece semantics)

validator.ts                  →  one-hive rule (cross-cutting board integrity)

coordinator.ts                →  turn order, placement rules, win detection
```

Each layer is a module of free functions taking the board as an argument. There is no `class Board`, no `MoveValidator` instance, no `GameCoordinator`. State is a value; the functions are stateless.

### Why functions, not subclasses, for piece movement

Only **one axis varies** between piece types: the movement function. Five subclasses for one method override is ceremony.

Subclasses pay off when multiple behaviors co-vary (rendering + events + lifecycle). Here they don't.

```ts
export type MovementFn = (from: HexCoord, board: Board) => HexCoord[];

export const movements = {
  queen:       queenMovement,        // 1 step, slide
  ant:         antMovement,          // unlimited, slide
  spider:      spiderMovement,       // exactly 3 sliding steps
  grasshopper: grasshopperMovement,  // jumps over occupied — NO slide check
  beetle:      beetleMovement,       // 1 step, climb — NO ground slide check
} satisfies Record<PieceType, MovementFn>;

export type Piece = { readonly type: PieceType; readonly color: Color };
```

A `Piece` is two strings. It carries no identity and no position: the board says where it is, and two pieces with the same type and color are interchangeable, which is what makes hands a `Record<PieceType, number>` rather than an array of objects.

`satisfies` rather than `: Record<PieceType, MovementFn>` so the table keeps its literal key type. A missing piece type is still a compile error.

**OCP holds:** adding Mosquito = add a function entry. No existing code touched.

### Why `canSlide` is a topology function, but is *called from* piece functions

Freedom-of-movement (the "physical squeeze" rule) is a **geometric primitive** — given two hexes and current occupancy, is there a gap to slide through? Doesn't depend on piece type.

But **whether** to apply it is piece-specific. Beetle climbs. Grasshopper jumps. Ant, Queen and Spider slide.

So the check lives in `occupancy.ts` next to the other topology, and each piece's movement function decides whether to consume it. Beetle and Grasshopper stop being "exceptions" — they just don't call `canSlide`.

In practice the sliding pieces don't call it directly either. They call `slideStep` from `movements/utils.ts`, which bundles the three conditions every sliding step shares:

```ts
export const slideStep = (board: Board, from: HexCoord): HexCoord[] =>
  neighbors(from).filter(
    (n) => isEmpty(board, n) && canSlide(board, from, n) && hasOccupiedNeighbor(board, n),
  );
```

The third condition is the touching-hive rule, and it is why `slideStep` takes a *transit* board with the moving piece already lifted. A piece cannot use itself as the hive it stays in contact with, and a multi-step piece must not trip over its own origin halfway through the path.

### Why the validator shrinks to one rule

Initially it had three responsibilities (one-hive, freedom-of-movement, geometry). After moving freedom-of-movement into the piece functions, `validator.ts` is one function and one rule:

```ts
export const getValidMoves = (piece: Piece, from: HexCoord, board: Board): HexCoord[] => {
  const top = topPieceAt(board, from);
  if (!top || top.type !== piece.type || top.color !== piece.color) return [];
  if (!isConnectedWithout(board, from)) return [];  // one-hive
  return movements[piece.type](from, board);
};
```

The top-of-stack check is there because a piece under a beetle cannot move, and the caller passes a piece it believes is at `from`.

If future cross-cutting rules appear (pillbug-moved-last-turn), they go here.

---

## Coordinator

Owns game flow. `coordinator.ts` holds the state type and the three functions the rest of the world uses.

```ts
export type GameState =
  | { readonly status: 'in_progress'; readonly board: Board; /* ...shared fields */ }
  | { readonly status: 'finished'; readonly result: FinishedResult; /* ...shared fields */ };

// shared: board, hands: Record<Color, Hand>, currentPlayer, turnNumbers, history

export const createGame = (): GameState => ...;
export const listValidMoves = (state: GameState): Move[] => ...;   // placements + relocations, or pass
export const applyMove = (state: GameState, move: Move): GameState; // throws IllegalMoveError
```

**`listValidMoves` is the single source of truth for legality.** `applyMove` does not re-derive anything; it generates the list and checks the incoming move for membership. Slower than a targeted check, and worth it: a new rule lands in move generation and both paths get it. Nothing can be legal to apply but invisible to the UI.

`listValidMoves` returns `[{ kind: 'pass' }]` when a player has no placement and no relocation, so the list is never empty while the game is in progress.

A `Move` is a discriminated union, not a from/to pair, because placement and relocation carry different data:

```ts
export type Move =
  | { readonly kind: 'place'; readonly piece: Piece; readonly to: HexCoord }
  | { readonly kind: 'relocate'; readonly from: HexCoord; readonly to: HexCoord }
  | { readonly kind: 'pass' };
```

Placement rules live in `placement.ts`, called from the coordinator, not from the board or the movement functions:
- Color alternation per turn
- Queen must be placed by each player's 4th turn
- New pieces must touch own color, and no enemy piece, from a player's second placement on

These are turn-flow rules, not spatial or piece-specific.

`turnNumbers` counts completed turns *per color*, not a single global turn counter, because the queen deadline is per player.

---

## Decided

### Mutability — immutable, settled during Phase 1

`applyMove(state, move)` returns a new `GameState` and never touches the old one. `place` and `remove` return new boards, copying the `Map`.

The clone cost was the reason to hesitate, and it turned out not to matter. A Hive board is under 30 cells, and copying that Map per move is invisible next to move generation, which walks the board for every piece of the active color.

What it bought is larger than free undo. The web client applies a move optimistically and keeps the previous state as a snapshot; when the server rejects the move, rollback is an assignment. The server stores whole states rather than replaying history. The fuzzer compares before and after states directly. None of that needs a clone protocol, because there is nothing to clone.

### `Board` is a plain type, not a class

`Board` is `{ cells: ReadonlyMap<string, readonly Piece[]> }` and nothing else. No methods, no private fields, no invariants of its own to protect.

The engine has no classes outside `IllegalMoveError`. This is not a rule for its own sake: encapsulation earns its keep when an object guards mutable state, and none of these objects have any.

### Beetle stacking semantics

The stack at a cell is `readonly Piece[]`, bottom to top. `topPieceAt` returns the visible piece, `stackAt` returns the column.

`isConnectedWithout` short-circuits on stack height: lifting the top piece off a stack of two or more leaves the cell occupied, so the hive cannot break and the BFS is skipped.

Still deferred: the height-aware squeeze between two stacks of equal height. `beetleMovement` applies `canSlide` only when leaving ground level and allows any climb onto an occupied cell. Rare in play, and it needs its own test cases before the rule goes in.

### No `not_started` status

`GameState` is a two-member union, `in_progress | finished`. A game that has not started is `history.length === 0`, so a third status would be a second way to say the same thing and a third branch in every consumer.

### Frontend animations

Handled in `@termitary/web` (`board/motion.ts`), where a relocation renders as a lift and a drop. The engine never learned about it, as intended.

---

## Guiding Principles Applied

| Principle | Where |
|-----------|-------|
| **SRP** | `piece.ts` (data) / `movements/` (geometry) / `board.ts` + `occupancy.ts` (topology) / `validator.ts` (one-hive) / `coordinator.ts` (flow) |
| **OCP** | New piece type = new entry in the `movements` table, no edits to existing code |
| **DIP** | Engine depends on no infrastructure — pure TS, no DB, no IO |
| **Low coupling** | Movement functions take `Board` and a coord. They import no sibling movement, and nothing in `movements/` knows the coordinator exists |
| **Single source of truth** | `listValidMoves` decides legality; `applyMove` asks it rather than repeating it |
