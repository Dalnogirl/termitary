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

## Phase 2: Hot-seat Web UI (revised ordering)

**Goal:** Two humans on the same screen drive a Hive game through a browser, against the live engine. No server, no network.

`packages/web/`

- [ ] Tooling: Vite + TS + chosen framework (React or alternative — to grill)
- [ ] Hex grid rendering — pointy-top hexagons, axial-to-pixel conversion (SVG or Canvas — to grill)
- [ ] Piece visuals — distinct per type + color
- [ ] State: hold a `GameState` from the engine, re-render on every `applyMove`
- [ ] Interaction:
  - Click own piece on board → show valid relocation targets from `listValidMoves`
  - Click own piece in hand → show valid placement targets
  - Click target → `applyMove`, re-render
  - Pass button when only `pass` is legal
- [ ] HUD: whose turn, hand counts per color, game status, winner overlay
- [ ] Move history sidebar (cheap; engine already records history)
- [ ] No accounts, no rooms, no lobby — single browser tab is the whole game

This phase validates the engine end-to-end through human interaction before any network code lands.

---

## Phase 3: Local Multiplayer Server (was Phase 2)

**Goal:** Two players can play Hive over WebSockets on localhost, using the same UI from Phase 2.

`packages/server/`

- [ ] Fastify + Socket.IO (or ws) — single process
- [ ] In-memory game rooms — `Map<gameId, GameState>`
- [ ] WS events: `create_game`, `join_game`, `make_move`, `game_state`, `game_over`
- [ ] Room lifecycle: create → waiting → playing → finished
- [ ] Basic reconnection — rejoin by gameId, re-send full state
- [ ] Simple lobby — list open games, create/join

No auth, no persistence, no DB. Players are ephemeral socket IDs. The hot-seat UI gets a network mode bolted on rather than being rewritten.

---

## Phase 4: Persistence & Auth (still local)

**Goal:** Games survive server restart, players have accounts.

- [ ] SQLite (via better-sqlite3 or Drizzle) — game history, user profiles
- [ ] Simple email/password auth (JWT) — Passport.js or custom
- [ ] Game history — review past games
- [ ] Basic rating system (Glicko-2)
- [ ] Persist finished games, replay moves

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
│   ├── server/      # Game server (Phase 2, evolves through 6-8)
│   ├── web/         # React SPA (Phase 3)
│   └── shared/      # Types, message schemas, hex utils
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
