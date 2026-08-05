# Hive Engine — Core Architecture

Design decisions for the pure game engine (`packages/engine`). Implementation details, not project plan.

---

## Coordinate System: Axial `{ q, r }`

Standard hex coord system for sparse, unbounded boards.

- Two-axis representation, 60° between axes
- Math-friendly (neighbors = 6 fixed offsets, no row-parity branches)
- Cube coords `(x, y, z)` used internally where helpful (distance calcs)
- Reference: [Red Blob Games hex grids](https://www.redblobgames.com/grids/hexagons/)

```ts
type HexCoord = { q: number; r: number };

const HEX_DIRECTIONS: ReadonlyArray<HexCoord> = [
  { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
  { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 },
];
```

Rejected: offset coords (ugly math on unbounded boards), doubled coords (niche).

---

## Board Storage: Sparse Map

Hive has no fixed field — pieces *are* the field. Storage must reflect that.

```ts
class Board {
  private cells = new Map<string, Piece[]>();  // key = "q,r"
  //                              ^^^^^^^^
  //                              stack — for beetle climbing
}
```

**Why sparse map over 2D array:**
- No bounds to pre-allocate (pieces can be placed anywhere)
- Negative coords work naturally
- O(1) lookup, no memory waste on empty cells
- Trivial serialization (`Object.fromEntries`)
- Iteration is over occupied cells only

**Key encoding:** string `"q,r"` for now. Bit-packing or custom Map only if profiling shows a hotspot.

**No `width`/`height`/`bounds`.** There aren't any. Renderer computes bounding box of occupied cells to center the viewport.

---

## Coordinate Origin: Absolute, Drifting

First piece placed at `(0, 0)`. Everything else relative. Coords can drift negative or positive freely.

Rejected: periodic re-centering (normalization). Optimizes a non-problem and breaks move history references.

---

## Three-Layer Movement Architecture

The hardest design decision. Single Responsibility split:

```
Piece movement function   →  "an Ant CAN reach these hexes by sliding"
                              (geometric + piece-specific physical constraints)

Board (spatial primitives) →  neighbors, canSlide, isConnectedWithout
                              (pure topology, knows nothing about piece semantics)

MoveValidator              →  one-hive rule (cross-cutting board integrity)

GameCoordinator            →  turn order, placement rules, win detection
                              (Controller — GRASP)
```

### Why functions, not subclasses, for piece movement

Only **one axis varies** between piece types: the movement function. Five subclasses for one method override is ceremony.

Subclasses pay off when multiple behaviors co-vary (rendering + events + lifecycle). Here they don't.

```ts
type MovementFn = (from: HexCoord, board: Board) => HexCoord[];

const movements: Record<PieceType, MovementFn> = {
  queen:       slidingNeighbors,        // 1 step, slide
  ant:         floodFillSliding,        // unlimited, slide
  spider:      exactly3Slides,          // exactly 3 sliding steps
  grasshopper: jumpsInLines,            // jumps over occupied — NO slide check
  beetle:      neighborsAllowOccupied,  // 1 step, climb — NO slide check
};

class Piece {
  constructor(
    public readonly type: PieceType,
    public readonly color: Color,
  ) {}
}
```

**OCP holds:** adding Mosquito = add a function entry. No existing code touched.

### Why `canSlide` lives on Board, but is *called from* piece functions

Freedom-of-movement (the "physical squeeze" rule) is a **geometric primitive** — given two hexes and current occupancy, is there a gap to slide through? Doesn't depend on piece type.

But **whether** to apply it is piece-specific. Beetle climbs (no check). Grasshopper jumps (no check). Ant/Queen/Spider slide (check required).

So the check lives on Board (Information Expert for topology), and each piece's movement function decides whether to consume it. Beetle and Grasshopper stop being "exceptions" — they just don't call `canSlide`.

### Why MoveValidator shrinks to one rule

Initially had three responsibilities (one-hive, freedom-of-movement, geometry). After moving freedom-of-movement into piece functions, MoveValidator owns only:

```ts
class MoveValidator {
  constructor(private board: Board) {}

  getValidMoves(piece: Piece, from: HexCoord): HexCoord[] {
    if (!this.board.isConnectedWithout(from)) return [];  // one-hive
    return movements[piece.type](from, this.board);
  }
}
```

If future cross-cutting rules appear (pillbug-moved-last-turn), they go here.

---

## GameCoordinator (Controller)

Owns game flow. Delegates to Board + MoveValidator + Piece. Information Expert for turn state.

```ts
class GameCoordinator {
  private board: Board;
  private hands: Record<Color, Piece[]>;   // unplayed pieces per player
  private turnNumber: number;
  private currentPlayer: Color;
  private status: 'waiting' | 'playing' | 'finished';

  getValidMoves(): Move[];          // placements + relocations
  applyMove(move: Move): void;      // validates, mutates, checks win
  getResult(): GameResult | null;
}
```

Placement rules live here, not on Board or Piece:
- Color alternation per turn
- Queen must be placed by turn 4
- New pieces must touch own color (after turn 1)

These are turn-flow rules, not spatial or piece-specific. Controller is the right home.

---

## Open Decisions

### Mutability
Two options:
- **Mutable Board** — `applyMove` modifies in place. Simpler OOP. Need explicit clone for undo/history.
- **Immutable state** — `applyMove` returns new Board. Free history/undo. Clone cost per move.

Leaning **mutable** for now (matches OOP intent), with snapshot-on-finish for game history. Revisit if undo/replay UX becomes important.

### Beetle stacking semantics
Stack stored as `Piece[]` (bottom to top). `topPieceAt(c)` returns the visible piece. Beetle's movement function needs awareness of stack height for "climbing on top of stack" — TBD when implementing.

### Frontend animations
Smooth piece transitions will need addressing in the FE phase. Out of scope for engine.

---

## Guiding Principles Applied

| Principle | Where |
|-----------|-------|
| **SRP** | Piece (data) / movement fn (geometry) / Board (topology) / Validator (one-hive) / Coordinator (flow) |
| **OCP** | New piece type = new function entry, no edits to existing code |
| **DIP** | Engine depends on no infrastructure — pure TS, no DB, no IO |
| **Information Expert (GRASP)** | Board owns spatial knowledge; Piece owns its movement; Coordinator owns turn state |
| **Controller (GRASP)** | GameCoordinator orchestrates without owning details |
| **Low Coupling** | Movement functions depend on Board interface, not implementation |
