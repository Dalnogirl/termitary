# Hive Web — Project Roadmap

## Context
Build a multiplayer web Hive board game. Start as a local monolith using familiar tech (Node, Express/Fastify, React), then progressively migrate to AWS to learn cloud services without blocking game development.

Base game only (no expansions). Untimed. Expansions + clock added later.

---

## Phase 1: Game Engine (pure TS, zero deps) — ✅ COMPLETE

**Goal:** Playable Hive logic, fully tested, no UI/network/infra.

`packages/engine/`

- [x] Hex coordinate system (axial: `{ q, r }`) — `neighbors`, `sharedNeighbors`, `key`, `parse`
  - Distance and ring detection were dropped (no caller — YAGNI).
- [x] Board representation — `Board = { cells: ReadonlyMap<string, readonly Piece[]> }` (immutable, beetle stacking)
- [x] Piece types: Queen, Ant, Grasshopper, Spider, Beetle (value objects: `{ type, color }`)
- [x] Placement rules — `placement.getValidPlacementCoords(board, color, turnNumber)`. White opens at (0,0), color-touching rule from turn 1.
- [x] One-hive rule — `occupancy.isConnectedWithout(board, c)` (BFS, beetle-stack short-circuit).
- [x] Movement rules per piece type — `movements/{queen,ant,beetle,spider,grasshopper}.ts` over a shared `slideStep` primitive. Touching-hive rule enforced for every relocation.
- [x] Valid move generation — `coordinator.listValidMoves(state)` combines placements + relocations + pass; queen-by-turn-4 enforced.
- [x] Win/draw detection — `result.{isQueenSurrounded, getResult}`.
- [x] Game state machine: 2-state discriminated union `in_progress | finished`. (`not_started` dropped — derivable from `history.length === 0`.)
- [x] ~~CLI playground~~ — replaced by **e2e fuzzer + scripted endgame tests** (`src/e2e.test.ts`). 30 random games × 80 moves with invariant checks.

**Key design:** Engine is pure functions over value-object state. Free functions everywhere; classes only where state truly needs encapsulation (none so far). `applyMove(state, move): GameState` returns new state and throws `IllegalMoveError` on illegal input. `listValidMoves(state)` is the single source of truth for legality.

---

## Phase 2: Hot-seat Web UI (revised ordering) — ✅ COMPLETE

**Goal:** Two humans on the same screen drive a Hive game through a browser, against the live engine. No server, no network.

`packages/web/`

- [x] Tooling: Vite + React 19 + TypeScript, Tailwind v4 and shadcn for chrome
- [x] Hex grid rendering — pointy-top hexagons, axial-to-pixel conversion. Canvas via Konva, not SVG: the board redraws outside React, driven by a zustand store the renderer subscribes to directly.
- [x] Piece visuals — insect glyphs per type, tinted per color. The settings dialog switches piece set and hue (`board/piece-sets.ts`).
- [x] State: hold a `GameState` from the engine, re-render on every `applyMove`
- [x] Interaction:
  - Click own piece on board → show valid relocation targets from `listValidMoves`
  - Click own piece in hand → show valid placement targets
  - Click target → `applyMove`, re-render
  - Pass button when only `pass` is legal
- [x] HUD: whose turn, hand counts per color, game status, winner overlay
- [x] Move history sidebar (`history/History.tsx`)
- [x] No accounts, no rooms, no lobby — single browser tab is the whole game

Still live at `/hotseat`, and still server-free. It is the one route `RequireAuth` does not guard, which makes it the fastest way to exercise an engine change.

Two things this phase did not anticipate. Moves are committed through a `Controller` port (`controller/port.ts`, one `commitMove`) rather than calling `applyMove` from the components, which is what let Phase 3 bolt on a network mode without rewriting the UI. And `myColor === null` came to mean hot-seat, so the same renderer plays both sides.

This phase validated the engine end-to-end through human interaction before any network code landed.

---

## Phase 3: Local Multiplayer Server (was Phase 2) — ✅ COMPLETE

**Goal:** Two players can play Hive over WebSockets on localhost, using the same UI from Phase 2.

`packages/server/`

- [x] Fastify + `@fastify/websocket` — single process. Socket.IO was dropped; nothing needed its fallbacks or rooms.
- [x] Game rooms behind a `RoomStore` port. Started as `Map<gameId, Room>`; the in-memory adapter survives as the test double now that Phase 4 wired Drizzle in.
- [x] WS messages: client sends `joinGame`, `makeMove`, `leaveGame`; server sends `connected`, `gameJoined`, `stateUpdated`, `presenceUpdate`, `error`. Room creation is REST (`POST /rooms`), not a WS frame, because the lobby needs it before a socket exists.
- [x] Room lifecycle — derived, not stored. A `Room` is `{ id, state, players }`; waiting versus playing is `isFull(room)` and the end is `state.status === 'finished'`. `sweep-abandoned-rooms` clears the ones nobody came back to.
- [x] Reconnection — rejoin by roomId, re-send full state. Seat and presence are separate: a socket close notifies the opponent but leaves seats intact, so a reconnect lands in `join-game`'s re-attach branch. Only `leaveGame` unseats.
- [x] Lobby — list open games, create/join

The message vocabulary drifted from the plan. `create_game` and `game_over` never existed: rooms are created over REST, and the end of a game is a `stateUpdated` carrying `status: 'finished'`, so the client has one state path instead of two.

Players stopped being ephemeral socket IDs earlier than planned. Seats hold an `Identity` from the auth session, which is what makes reconnection mean anything.

---

## Phase 4: Persistence & Auth (still local) — 🚧 IN PROGRESS

**Goal:** Games survive server restart, players have accounts.

- [x] SQLite via Drizzle — `createDrizzleRoomStore` is the live `RoomStore`, so rooms and game state outlive a restart. Migrations run on boot from `createDb`, so a fresh checkout needs no manual step.
- [x] Auth — **better-auth with email OTP, not JWT and not Passport.** A session cookie gates `/rooms` and `/ws`. In dev the OTP prints to the server console instead of being emailed.
- [ ] Game history — review past games
- [ ] Basic rating system (Glicko-2)
- [ ] Persist finished games, replay moves

Why the auth swap: the plan assumed hand-rolled email/password with JWTs, which means owning password hashing, reset flows, and token rotation for a hobby project. better-auth ships those, and its Drizzle adapter generates the tables (`pnpm db:generate-schema`). Email OTP drops password storage entirely.

The cost is a cookie instead of a bearer token, and cookies care about origins. CORS in `app.ts` needs an explicit origin plus `credentials: true`, and `env.authBaseUrl` must match the host the browser actually uses. `127.0.0.1` and `localhost` are different origins to a cookie jar. Neither constraint shows up in tests, because `app.inject` has no preflight and no cookie jar.

Cognito in Phase 7 replaces better-auth rather than a custom JWT layer. Same seam either way: `ws/identity.ts` is the only file that knows which auth library exists.

This phase exists so the data model is proven before touching DynamoDB.

---

## Phase 5: AWS — Static Hosting

**Goal:** SPA deployed to AWS, server still runs locally or on a VPS.

- [ ] S3 bucket for SPA static files
- [ ] CloudFront CDN in front of S3
- [ ] Route 53 domain (optional)
- [ ] CI: GitHub Actions → build → deploy to S3

**AWS skills learned:** S3, CloudFront, IAM policies, AWS CLI/CDK basics.

---

## Phase 6: AWS — Containerized Server

**Goal:** Game server running in AWS.

- [ ] Dockerize the server
- [ ] ECR — push image
- [ ] ECS Fargate — single task running the server
- [ ] ALB in front with WebSocket support (sticky sessions)
- [ ] RDS (Postgres) or DynamoDB replacing SQLite
- [ ] Secrets Manager for DB credentials, JWT secret

**AWS skills learned:** ECS, Fargate, ECR, ALB, VPC basics, security groups, RDS or DynamoDB.

---

## Phase 7: AWS — Managed Auth

**Goal:** Replace custom auth with Cognito.

- [ ] Cognito User Pool — signup, login, email verification
- [ ] OAuth providers (Google, GitHub)
- [ ] JWT validation on server via Cognito tokens
- [ ] API Gateway authorizer (prep for Phase 8)

**AWS skills learned:** Cognito, OAuth integration, token validation.

---

## Phase 8: AWS — Serverless Migration (optional)

**Goal:** Decompose monolith into Lambda functions if desired.

- [ ] API Gateway WebSocket API for game play
- [ ] Lambda handlers for WS routes ($connect, $disconnect, move, etc.)
- [ ] API Gateway HTTP API for REST (lobby, profiles, history)
- [ ] Lambda handlers for REST routes
- [ ] DynamoDB single-table design (if not done in Phase 6)
- [ ] EventBridge for post-game events (rating calc, history write)

**AWS skills learned:** API Gateway (REST + WS), Lambda, EventBridge, DynamoDB streams.

---

## Phase 9: Social Features

**Goal:** chess.com-like social layer.

- [ ] Friends list
- [ ] In-game + lobby chat
- [ ] Player profiles (rating, game history, stats)
- [ ] Spectating live games
- [ ] "TV" — watch a random active game
- [ ] Challenge a friend directly

---

## Phase 10: Polish & Expansion

- [ ] Expansion pieces (Mosquito, Ladybug, Pillbug) — engine + UI
- [ ] Time controls — server clock, lag compensation
- [ ] Matchmaking queue (rating-based)
- [ ] Game analysis / move explorer
- [ ] Mobile-responsive canvas
- [ ] Sound effects, animations
- [ ] Anti-cheat (if AI engine exists for Hive)

---

## Monorepo Structure

```
hive/
├── packages/
│   ├── engine/      # Pure game logic (Phase 1)
│   ├── server/      # Game server (Phase 3, evolves through 6-8)
│   ├── web/         # React SPA (Phase 2)
│   └── protocol/    # zod WS schemas, REST bodies, wire conversion
├── infra/           # CDK/SST (Phase 5+)
├── package.json     # Workspace root
└── tsconfig.base.json
```

Tooling: pnpm workspaces, TypeScript project references, Vitest.

---

## Guiding Principles

1. **Engine depends on nothing** — pure TS, no IO, no framework (DIP)
2. **Server is a thin adapter** — translates WS messages to engine calls
3. **Each phase is independently deployable** — no big bang migrations
4. **AWS is additive** — game works without it at every phase
5. **Test the engine exhaustively** — everything else is plumbing
