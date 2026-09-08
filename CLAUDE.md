# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace, run from the repo root:

```bash
pnpm dev                       # web (:5173) + game server (:3001), in parallel
pnpm dev:web                   # web SPA only (vite, :5173)
pnpm dev:server                # game server only (tsx watch, :3001)
pnpm lint                      # biome check across the repo
pnpm format                    # biome format --write
pnpm typecheck                 # tsc --noEmit in every package
pnpm test                      # vitest run in engine/protocol/server (web has no test script)
```

Single test file or case:

```bash
pnpm --filter @hive/engine test src/movements/spider.test.ts
pnpm --filter @hive/server test -t 'rejects unauthenticated'
pnpm --filter @hive/engine test:watch
```

There are no vitest config files. Vitest picks up colocated `*.test.ts` next to the source it covers.

Server DB (SQLite + Drizzle), run inside `packages/server`:

```bash
pnpm db:generate-schema     # better-auth CLI regenerates src/adapters/db/schema.ts
pnpm db:generate-migration  # drizzle-kit generate → migrations/
```

Migrations run automatically on boot (`createDb` calls `migrate`), so a fresh checkout needs no manual step.

## Packages

`engine` → `protocol` → `server` / `web`. The engine imports nothing; the protocol imports the engine; server and web import both.

- **`@hive/engine`** — pure Hive rules. No IO, no framework, no deps beyond fast-check in tests.
- **`@hive/protocol`** — zod schemas for every WS message and REST body, plus `toWire`/`fromWire` converting `GameState` to and from JSON (the board is a `Map`, so it needs explicit conversion).
- **`@hive/server`** — Fastify + `@fastify/websocket`, better-auth over Drizzle/SQLite.
- **`@hive/web`** — React 19 SPA, Vite, Konva canvas board, zustand, Tailwind v4 + shadcn.

Packages are consumed as raw TypeScript source (`"main": "src/index.ts"`); nothing builds to `dist`. Editing the engine changes the web app on the next vite reload with no build step.

## Engine

`docs/architecture.md` describes the intended design but is written in classes (`class Board`, `MoveValidator`, `GameCoordinator`). The implementation is entirely free functions over immutable value objects. Trust the code; treat the doc as rationale for the layering, not as an API reference.

The real shape:

- `Board = { cells: ReadonlyMap<"q,r", readonly Piece[]> }`. Sparse, unbounded, no width/height. The array is a beetle stack, bottom to top.
- `applyMove(state, move): GameState` returns a new state and throws `IllegalMoveError`. `listValidMoves(state)` is the single source of truth for legality; `applyMove` validates by membership in that list, so any new rule only has to land in move generation.
- Movement is a `Record<PieceType, MovementFn>` in `movements/`. Sliding pieces call `canSlide`; beetle and grasshopper deliberately do not. Adding a piece type means adding one entry.
- `GameState` is a discriminated union on `status: 'in_progress' | 'finished'`.

Coverage is high and includes a randomized fuzzer (`src/e2e.test.ts`). Rule changes should come with tests in the matching `*.test.ts`.

## Server

Hexagonal layering, and the seams are load-bearing because the roadmap swaps the adapters for AWS later:

- `domain/` — `Room` (seats as a positional `[white, black]` tuple), `Identity`, and the `RoomStore` / `ConnectionRegistry` port types.
- `adapters/` — in-memory implementations of both ports, plus better-auth, Drizzle, and the session extractor.
- `usecases/` — one file per action (`joinGame`, `makeMove`, `leaveGame`, `createRoom`, `listRooms`), each taking `(identity, msg, ports)` and pushing results through `connections.sendTo`.
- `ws/` — socket lifecycle, zod parsing of inbound frames, and a dispatcher switching on `msg.type` with a `never` exhaustiveness check.

Auth: `/rooms` and `/ws` are gated on a better-auth session cookie. `ws/identity.ts` is the only place the server knows better-auth exists; everything downstream sees `(req) => Promise<Identity | null>`. Sign-in is email OTP, and in dev the OTP is printed to the server console rather than emailed.

Seat and presence are separate concepts. A socket close notifies the opponent of `disconnected` but leaves seats intact, so a reconnect lands in `joinGame`'s re-attach branch. Only `leaveGame` unseats.

Tests use `createTestApp()` from `src/testing/auth-helper.ts`: in-memory SQLite, captured OTPs, and a `signIn(email)` returning a usable cookie. Use `app.inject` for REST; `ws/integration.test.ts` shows the WebSocket pattern.

## Web

State is split in two on purpose:

- `store/store.ts` — a module-level zustand store holding engine state (`game`, `validMoves`, `selection`). Not React context. The Konva renderer subscribes to it directly and redraws outside React.
- `controller/room.ts` — a per-room store for connection concerns (`status`, `myColor`, `opponent`, `errorMsg`).

The `Controller` port (`controller/port.ts`) is a single `commitMove(move)`. `createLocalController` applies moves straight to the engine for hot-seat; `createRoomController` applies optimistically, sends over WS, and rolls back to a snapshot if the server rejects the move. Server `stateUpdated` always wins. All `client.on(...)` bindings live in `createRoomController`; `use-room-connection.ts` is mount/unmount lifecycle only.

`myColor === null` means hot-seat, so this client plays both sides. When set, `input.ts` and the renderer gate interaction and highlighting to that color on that color's turn.

Konva is imported through deep paths (`konva/lib/Stage.js`) to keep the bundle down. Keep that style rather than importing the `konva` barrel.

## Conventions

- Relative imports carry a `.js` extension everywhere, web included (`verbatimModuleSyntax` + NodeNext in the base tsconfig). Web also has an `@/*` alias pointing at `src/`, used by shadcn components.
- Biome, not ESLint/Prettier: single quotes, semicolons, 100 columns, 2 spaces. Repo forces LF via `.gitattributes`. `packages/server/migrations` is ignored; drizzle-kit owns that output and biome would reformat it on every regeneration.
- `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Indexed reads are `T | undefined`, and an optional property cannot be set to explicit `undefined`.
- Free functions and plain object types by default. There are no classes outside the two `Error` subclasses.
- Comments are the last resort, not the first. When code needs explaining, first try to make the explanation unnecessary: extract a named function, rename the thing, or change the shape until the code says it. A comment that a rename would have covered is a missed refactor.
  - Write one only for what code cannot state: a non-obvious *why*, surprising behaviour in something external (a library hook that skips a branch, an ordering a call depends on), or a deliberate deferral.
  - Never restate the code, describe another implementation, or narrate what a test asserts.
  - Keep them to a line or two. A paragraph above a function usually means the function wants splitting.

## State of the work

`docs/roadmap.md` phases lag reality: it marks Phase 2 and 3 unchecked, but the hot-seat UI, WS server, and lobby all exist and Phase 4 (Drizzle + better-auth) is landing. Commit messages carry the real story numbers (`S-4.2`).

The web client authenticates through better-auth's SDK (`network/auth-client.ts`, the client-side twin of `ws/identity.ts`). `/signin` runs the two-step email OTP form, `RequireAuth` guards `/lobby` and `/play`, and `/hotseat` stays open because it never touches the server. Both `network/` fetches send `credentials: 'include'`; the WS upgrade carries the cookie on its own.

Two origin constraints are load-bearing and fail silently if broken: CORS in `app.ts` needs an explicit origin (`env.webOrigin`) plus `credentials: true`, since a reflected origin cannot carry cookies, and `env.authBaseUrl` plus `trustedOrigins` must match the host the browser actually uses. The server binds `127.0.0.1` but the client hits `localhost`, which is a different origin to a cookie jar. Neither shows up in tests: `app.inject` has no preflight, no cookie jar, and no Origin check.
