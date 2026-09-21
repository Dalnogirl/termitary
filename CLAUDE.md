# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multiplayer web Hive game, and an excuse to learn AWS by moving it there in stages (#50). It starts as a local monolith on familiar tech and stays playable without the cloud at every stage.

Untimed, and a clock stays out. Expansion pieces are in: a `Ruleset` picks which types a game uses, and `BASE_RULESET` is the default.

Principles, in rough order of how often they settle an argument:

1. The engine depends on nothing. Pure TypeScript, no IO, no framework.
2. The server is a thin adapter translating WS messages into engine calls.
3. Every stage is independently deployable. No big-bang migrations.
4. AWS is additive. The game works without it at every stage.
5. Test the engine exhaustively. Everything else is plumbing.

## Commands

pnpm workspace, run from the repo root:

```bash
pnpm dev                       # web (:5173) + game server (:3001), in parallel
pnpm dev:web                   # web SPA only (vite, :5173)
pnpm dev:server                # game server only (tsx watch, :3001)
pnpm lint                      # biome check across the repo
pnpm format                    # biome format --write
pnpm typecheck                 # tsc --noEmit in every package
pnpm test                      # vitest run in every package
pnpm test:e2e                  # playwright, chromium, against a real server
pnpm test:e2e:prod             # the same browser, against the built bundle
pnpm build                     # vite build → packages/web/dist
```

Single test file or case:

```bash
pnpm --filter @termitary/engine test src/movements/spider.test.ts
pnpm --filter @termitary/server test -t 'rejects unauthenticated'
pnpm --filter @termitary/engine test:watch
```

There are no vitest config files. Vitest picks up colocated `*.test.ts` next to the source it covers.

The browser suite is `*.spec.ts` in `packages/e2e`, so vitest never sees it and `pnpm test` stays under a minute. `*.prod.spec.ts` is excluded from it and belongs to `playwright.prod.config.ts`, which wants `pnpm build` run first and boots the server on :3002. `pnpm test:e2e` starts vite on :5173 and `packages/server/src/testing/e2e-server.ts` on :3001 itself, and fails loudly if either port is taken — a `pnpm dev` server has a real database and no OTP route, so reusing one is never right.

Server DB (SQLite + Drizzle), run inside `packages/server`:

```bash
pnpm db:generate-schema     # better-auth CLI regenerates src/adapters/db/schema.ts
pnpm db:generate-migration  # drizzle-kit generate → migrations/
```

Migrations run automatically on boot (`createDb` calls `migrate`), so a fresh checkout needs no manual step.

## Packages

`engine` → `protocol` → `server` / `web`. The engine imports nothing; the protocol imports the engine; server and web import both.

- **`@termitary/engine`** — pure Hive rules. No IO, no framework, no deps beyond fast-check in tests.
- **`@termitary/protocol`** — zod schemas for every WS message and REST body, plus `toWire`/`fromWire` converting `GameState` to and from JSON (the board is a `Map`, so it needs explicit conversion).
- **`@termitary/server`** — Fastify + `@fastify/websocket`, better-auth over Drizzle/SQLite.
- **`@termitary/web`** — React 19 SPA, Vite, Konva canvas board, zustand, Tailwind v4 + shadcn.
- **`@termitary/e2e`** — Playwright specs driving a browser against the other four. Not in the dependency chain: nothing imports it.

Packages are consumed as raw TypeScript source (`"main": "src/index.ts"`); nothing builds to `dist`. Editing the engine changes the web app on the next vite reload with no build step.

## Engine

`docs/architecture.md` explains why the engine is shaped the way it is. Its samples match the code (free functions over immutable value objects) but are abridged, so read it for rationale and the source for signatures.

The real shape:

- `Board = { cells: ReadonlyMap<"q,r", readonly Piece[]> }`. Sparse, unbounded, no width/height. The array is a beetle stack, bottom to top.
- `applyMove(state, move): GameState` returns a new state and throws `IllegalMoveError`. `listValidMoves(state)` is the single source of truth for legality; `applyMove` validates by membership in that list, so any new rule only has to land in move generation.
- Movement is a `Record<PieceType, MovementFn>` in `movements/`. Sliding pieces call `canSlide`; beetle and grasshopper deliberately do not. Adding a piece type means adding one entry.
- `GameState` is a discriminated union on `status: 'in_progress' | 'finished'`.

Coverage is high and includes a randomized fuzzer (`src/e2e.test.ts`): 30 games of 80 random moves, invariants asserted after every one. Rule changes should come with tests in the matching `*.test.ts`.

## Server

Hexagonal layering, and the seams are load-bearing because the adapters get swapped for AWS ones later (#50):

- `domain/` — `Room` (seats as a positional `[white, black]` tuple), `Identity`, and the `RoomStore` / `ConnectionRegistry` / `ArchivedGameStore` / `UserStore` port types.
- `adapters/` — Drizzle implementations of `RoomStore`, `ArchivedGameStore` and `UserStore`, an in-memory `ConnectionRegistry`, plus better-auth and the session extractor. None of the three data ports has a fake: a test that wants them calls `createTestStores()` from `src/testing/stores.ts`, which builds all three over one in-memory database and seeds the `user` rows the seat foreign keys need.
- `usecases/` — one file per action (`joinGame`, `makeMove`, `leaveGame`, `createRoom`, `listRooms`), each taking `(identity, msg, ports)` and pushing results through `connections.sendTo`.
- `ws/` — socket lifecycle, zod parsing of inbound frames, and a dispatcher switching on `msg.type` with a `never` exhaustiveness check.

Rooms are created over REST (`POST /api/rooms`) because the lobby has to create one before a socket exists; everything after that is WS. Room lifecycle is derived rather than stored: waiting versus playing is `isFull(room)`, and the end of a game is a `stateUpdated` carrying `status: 'finished'`, so the client has one state path instead of two.

Auth: `/api/rooms` and `/ws` are gated on a better-auth session cookie. `/api/auth-providers` is the one route that is deliberately ungated, because `/signin` is the page with no session to send. better-auth rather than hand-rolled sessions, because password hashing, reset flows and token rotation are a lot of surface for a hobby project, and email OTP means no password storage at all. `ws/identity.ts` is the only place the server knows better-auth exists; everything downstream sees `(req) => Promise<Identity | null>`, which is the seam #50 swaps for Cognito. Sign-in is email OTP or a social provider, and in dev the OTP is printed to the server console rather than emailed. Google and GitHub are registered only when `env.socialProviders` found a complete credential pair, so a checkout with none of the four variables still runs on OTP alone. `docs/configuration.md` lists every variable and what a missing one does.

Seat and presence are separate concepts. A socket close notifies the opponent of `disconnected` but leaves seats intact, so a reconnect lands in `joinGame`'s re-attach branch. Only `leaveGame` unseats.

`Room` carries its own `createdAt` and `updatedAt`: `createRoom(id, creator, now)` stamps them and `touch(room, now)` moves `updatedAt`, and the stores write both as given rather than stamping a clock of their own. A save that forgets `touch` freezes the room in the lobby ordering and leaves it exposed to the sweep.

A finished game is archived the moment it ends, by `makeMove` and `resign`, with the sweep as the backstop: it archives each finished room before deleting it, and leaves the room alone if the archive throws. `deleteAbandonedBefore` therefore covers only rooms with a free seat — a finished room never leaves except through `listFinishedBefore`, so none is dropped unarchived.

Tests use `createTestApp()` from `src/testing/auth-helper.ts`: in-memory SQLite, captured OTPs, and a `signIn(email)` returning a usable cookie. Use `app.inject` for REST; `ws/integration.test.ts` shows the WebSocket pattern.

## Web

State is split in two on purpose:

- `store/store.ts` — a module-level zustand store holding engine state (`game`, `validMoves`, `selection`). Not React context. The Konva renderer subscribes to it directly and redraws outside React.
- `controller/room.ts` — a per-room store for connection concerns (`status`, `myColor`, `opponent`, `errorMsg`).

The `Controller` port (`controller/port.ts`) is a single `commitMove(move)`. `createLocalController` applies moves straight to the engine for hot-seat; `createRoomController` applies optimistically, sends over WS, and rolls back to a snapshot if the server rejects the move. Server `stateUpdated` always wins. All `client.on(...)` bindings live in `createRoomController`; `use-room-connection.ts` is mount/unmount lifecycle only.

`myColor === null` means hot-seat, so this client plays both sides. When set, `input.ts` and the renderer gate interaction and highlighting to that color on that color's turn.

Konva is imported through deep paths (`konva/lib/Stage.js`) to keep the bundle down. Keep that style rather than importing the `konva` barrel.

The renderer names what it draws: a tile is `piece` carrying `pieceColor` and `pieceType`, a legal cell is `target`. A canvas exposes no DOM, so those attrs are the whole surface `packages/e2e` has to read a position back through `stage.getIntersection`, and the browser helper imports `axialToPixel` and `HEX_SIZE` from `@termitary/web` so the maths under a click is the board's own. It runs them in the test process rather than in the page, because a built bundle serves no module by source URL and the production spec drives one.

`brand/mound.ts` is the only place the logo geometry exists. It reads the board's own lattice and corner ratio, so the mark and a board tile round identically. `public/icon.svg` is a checked-in copy of what `brand/icon.svg.ts` emits, because a favicon cannot be a component; `brand/icon.test.ts` fails when the two drift, and the fix is to rewrite the file from `ICON_SVG`.

## Conventions

- Relative imports carry a `.js` extension everywhere, web included (`verbatimModuleSyntax` + NodeNext in the base tsconfig). Web also has an `@/*` alias pointing at `src/`, used by shadcn components.
- Biome, not ESLint/Prettier: single quotes, semicolons, 100 columns, 2 spaces. Repo forces LF via `.gitattributes`. `packages/server/migrations` is ignored; drizzle-kit owns that output and biome would reformat it on every regeneration.
- `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Indexed reads are `T | undefined`, and an optional property cannot be set to explicit `undefined`.
- Free functions and plain object types by default. There are no classes outside the two `Error` subclasses.
- One entity, one name per layer. A room is `RoomRow` in the Drizzle adapter (columns, never leaves `adapters/db`), `Room` in the domain (the aggregate: what `get` returns and `save` takes back), `RoomOverview` in the domain (a read projection, no `state`, so it cannot be saved), and `RoomSummaryDto` on the wire. `Dto` marks anything crossing to the browser and nothing else; domain types never carry it.
- REST bodies in `protocol/src/rest.ts` are plain types. zod is for input nobody controls: inbound WS frames (`client-messages.ts`, parsed in `ws/inbound.ts`) and stored game state (`WireGameStateSchema`, which also rebuilds the board `Map`). Responses are checked by the compiler, since server and web import the same declaration from source.
- Comments are the last resort, not the first. When code needs explaining, first try to make the explanation unnecessary: extract a named function, rename the thing, or change the shape until the code says it. A comment that a rename would have covered is a missed refactor.
  - Write one only for what code cannot state: a non-obvious *why*, surprising behaviour in something external (a library hook that skips a branch, an ordering a call depends on), or a deliberate deferral.
  - Never restate the code, describe another implementation, or narrate what a test asserts.
  - Keep them to a line or two. A paragraph above a function usually means the function wants splitting.

## State of the work

Planned work is in GitHub issues; if it is not an issue, nobody is working on it. Commit messages carry story numbers (`S-4.2`) from the phases the project was built in — 1 engine, 2 hot-seat UI, 3 server, 4 persistence and auth — which is all those numbers are still for.

The web client authenticates through better-auth's SDK (`network/auth-client.ts`, the client-side twin of `ws/identity.ts`). `/signin` runs the two-step email OTP form, `RequireAuth` guards `/lobby` and `/play`, and `/hotseat` stays open because it never touches the server, which makes it the fastest way to exercise an engine change. Both `network/` fetches send `credentials: 'include'`; the WS upgrade carries the cookie on its own.

There is one origin. The server serves `packages/web/dist` and answers the API under `/api`, anything else is an SPA deep link and gets `index.html`, and in development vite proxies `/api` and `/ws` to `:3001` so the shape matches. That is why nothing configures CORS and why `/api` is a prefix rather than a habit: `/archived-games/:id` is both an API route and a react-router route, and only the prefix tells them apart.

The remaining origin constraint is `env.authBaseUrl`, which better-auth compares the inbound `Origin` against. The vite proxy rewrites that header on the way through (`vite.config.ts`), since the browser sees `:5173` and the server answers as `:3001`. `app.inject` has no cookie jar and no Origin check, so none of this shows up in a server test; `packages/e2e` is where it breaks.

`pnpm build` writes the bundle and CI runs it, plus one browser spec (`*.prod.spec.ts`, its own Playwright config) against the built output under `NODE_ENV=production`. Hot-seat only: the OTP route a browser can read lives in `testing/e2e-server.ts` so no deployment serves it, which leaves a production-mode spec no way to sign in.
