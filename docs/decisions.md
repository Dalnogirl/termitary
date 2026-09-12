# Termitary — build log

What got built, in the order it got built, and where the original plan turned out to be wrong.

This is not a plan. Planned work lives in [GitHub issues](https://github.com/Dalnogirl/termitary/issues); if it is not an issue, nobody is working on it. The phase numbers survive because commit messages reference them as story numbers (`S-4.2`).

## Context

A multiplayer web Hive game. Start as a local monolith on familiar tech, then move it onto AWS in stages to learn the cloud services without blocking game work (#50).

Base game only. Untimed. Expansion pieces and a clock were ruled out at the start and have stayed out.

## Phase 1: the engine

`packages/engine`, pure TypeScript, no IO and no dependencies.

Axial `{ q, r }` coordinates, a sparse `ReadonlyMap` board where each cell holds a beetle stack bottom to top, and one movement function per piece type. `listValidMoves(state)` is the single source of truth for legality and `applyMove` validates by membership in that list, so a new rule only has to land in move generation. `docs/architecture.md` has the reasoning.

Three things in the plan never got written:

- Distance and ring detection. No caller wanted them.
- The `not_started` state. It is `history.length === 0`, so the state machine is a two-member union.
- A CLI playground. A fuzzer replaced it: `src/e2e.test.ts` plays 30 random games of 80 moves and asserts invariants after every one, which found more than a human clicking through a terminal would have.

## Phase 2: hot-seat UI

`packages/web`. Two people, one screen, no server.

Konva on a canvas rather than SVG, because the board redraws outside React off a module-level zustand store the renderer subscribes to directly. Vite, React 19, Tailwind v4 and shadcn for the chrome around the board.

Two decisions from this phase paid off later and were not planned:

Moves commit through a `Controller` port, one `commitMove(move)`, instead of components calling `applyMove`. That is what let Phase 3 add network play without touching the UI.

`myColor === null` came to mean hot-seat, so the same renderer plays both sides. When it is set, `input.ts` and the renderer gate interaction to that colour on that colour's turn.

`/hotseat` is still server-free and is the one route `RequireAuth` does not guard, which makes it the fastest way to exercise an engine change.

## Phase 3: the server

`packages/server`, Fastify with `@fastify/websocket`, one process.

Socket.IO was in the plan and got dropped. Nothing needed its fallbacks or its room abstraction.

The message vocabulary drifted. `create_game` and `game_over` never existed. Rooms are created over REST (`POST /rooms`) because the lobby needs to create one before a socket exists, and the end of a game is a `stateUpdated` carrying `status: 'finished'`, which leaves the client one state path instead of two.

Room lifecycle is derived rather than stored. A `Room` is `{ id, state, players }`; waiting versus playing is `isFull(room)`, and the end is a status check on the state.

Seat and presence separated, which the plan did not anticipate. A socket close notifies the opponent but leaves seats intact, so a reconnect lands in `joinGame`'s re-attach branch. Only `leaveGame` unseats.

Players stopped being ephemeral socket IDs earlier than planned. Seats hold an `Identity` from the auth session, which is what makes reconnection mean anything.

## Phase 4: persistence and auth

SQLite through Drizzle. `createDrizzleRoomStore` is the live `RoomStore`, so rooms and game state outlive a restart. Migrations run on boot from `createDb`, so a fresh checkout needs no manual step. The in-memory adapter survives as the test double.

Auth is better-auth with email OTP, where the plan said hand-rolled email and password with JWTs. Owning password hashing, reset flows and token rotation is a lot of surface for a hobby project. better-auth ships all of it and its Drizzle adapter generates the tables. Email OTP means no password storage at all. In dev the OTP prints to the server console.

The cost is a cookie instead of a bearer token, and cookies care about origins. CORS in `app.ts` needs an explicit origin plus `credentials: true`, because a reflected origin cannot carry cookies, and `env.authBaseUrl` must match the host the browser actually uses. `127.0.0.1` and `localhost` are different origins to a cookie jar. Neither constraint shows up in tests: `app.inject` has no preflight and no cookie jar.

`ws/identity.ts` is the only file that knows better-auth exists. Everything downstream sees `(req) => Promise<Identity | null>`, which is the seam #50 swaps for Cognito.

Still open from this phase: reviewing finished games (#45) and rating (#51).

## Monorepo structure

```
termitary/
├── packages/
│   ├── engine/      # pure game logic
│   ├── protocol/    # zod WS schemas, REST bodies, wire conversion
│   ├── server/      # Fastify + WS + SQLite
│   └── web/         # React SPA
├── package.json
└── tsconfig.base.json
```

pnpm workspaces, TypeScript project references, Vitest. Packages are consumed as raw source, so nothing builds to `dist`.

## Guiding principles

1. The engine depends on nothing. Pure TypeScript, no IO, no framework.
2. The server is a thin adapter that translates WS messages into engine calls.
3. Every stage is independently deployable. No big-bang migrations.
4. AWS is additive. The game works without it at every stage.
5. Test the engine exhaustively. Everything else is plumbing.
