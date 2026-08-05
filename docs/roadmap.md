# Hive Web — Project Roadmap

## Context
Build a multiplayer web Hive board game. Start as a local monolith using familiar tech (Node, Express/Fastify, React), then progressively migrate to AWS to learn cloud services without blocking game development.

Base game only (no expansions). Untimed. Expansions + clock added later.

---

## Phase 1: Game Engine (pure TS, zero deps)

**Goal:** Playable Hive logic, fully tested, no UI/network/infra.

`packages/engine/`

- [ ] Hex coordinate system (axial: `{ q, r }`) — neighbors, distance, ring detection
- [ ] Board representation — `Map<string, Piece[]>` (string = serialized coord, array for beetle stacking)
- [ ] Piece types: Queen, Ant, Grasshopper, Spider, Beetle
- [ ] Placement rules (color alternation, queen by turn 4, adjacent to own color only after turn 1)
- [ ] One-hive rule validation (board stays connected after removing piece)
- [ ] Movement rules per piece type
- [ ] Valid move generation — given state, return all legal moves for active player
- [ ] Win/draw detection (queen surrounded)
- [ ] Game state machine: `not_started → in_progress → finished`
- [ ] CLI playground — play a game in terminal via stdin to smoke-test

**Key design:** Engine is pure functions. `applyMove(state, move) → { newState, validMoves, result }`. No side effects, no IO. This package never gains dependencies.

---

## Phase 2: Local Multiplayer Server

**Goal:** Two players can play Hive over WebSockets on localhost.

`packages/server/`

- [ ] Fastify + Socket.IO (or ws) — single process
- [ ] In-memory game rooms — `Map<gameId, GameState>`
- [ ] WS events: `create_game`, `join_game`, `make_move`, `game_state`, `game_over`
- [ ] Room lifecycle: create → waiting → playing → finished
- [ ] Basic reconnection — rejoin by gameId, re-send full state
- [ ] Simple lobby — list open games, create/join

No auth, no persistence, no DB. Players are ephemeral socket IDs.

---

## Phase 3: Web Client

**Goal:** Playable Hive in the browser against another human.

`packages/web/`

- [ ] Vite + React SPA
- [ ] Konva (`react-konva`) for board rendering
- [ ] Hex grid rendering — pointy-top hexagons, axial-to-pixel conversion
- [ ] Piece sprites/shapes — distinct visuals per piece type + color
- [ ] Interaction: click piece → show valid targets (from server) → click target → send move
- [ ] Drag-and-drop as enhancement
- [ ] Lobby screen — create/join game
- [ ] Game screen — board, move history sidebar, turn indicator
- [ ] Socket.IO client — connect, send moves, receive state updates

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
