# Configuration

Every setting the server reads is in `packages/server/src/env.ts`, resolved once at import.

`pnpm dev` reads `packages/server/.env`. Git ignores that file. Copy the template and fill in what you need:

```bash
cp packages/server/.env.example packages/server/.env
```

Only the dev script loads it. Tests pass credentials in directly, and a deployment gets real environment variables. The flag is `--env-file-if-exists`, not `--env-file`, so a fresh clone with no `.env` still boots on the defaults below.

## Variables

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3001` | Port the server binds. |
| `HOST` | `127.0.0.1` | Interface the server binds. Not the origin cookies use. |
| `NODE_ENV` | `development` | `production` turns the checks below from warnings into boot failures. |
| `DATABASE_URL` | `data/termitary.db` | SQLite file. `:memory:` under `NODE_ENV=test`. Production requires it, and requires an absolute path. |
| `BETTER_AUTH_SECRET` | a dev-only constant | Signs session cookies. Production refuses to boot without it. |
| `BETTER_AUTH_URL` | `http://localhost:3001` | The origin the browser reaches the API on, and the base of every OAuth callback. |
| `ROOM_SWEEP_INTERVAL_MS` | `3600000` | How often finished rooms are archived and removed, and expired seeks dropped. `0` disables the sweep. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | none | Google sign-in. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | none | GitHub sign-in. |

`BETTER_AUTH_URL` defaults to `localhost` while `HOST` binds `127.0.0.1`, which looks inconsistent and is deliberate. A cookie set on one host is never sent to the other, and the browser asks for `localhost`.

A relative `DATABASE_URL` resolves against the working directory, which a process supervisor owns rather than we do. SQLite then creates an empty database wherever that lands, without complaining, on every restart. Production refuses to boot rather than do that.

## One origin

The server serves the built SPA from `packages/web/dist` and answers the API under `/api`, so there is no second origin and nothing configures CORS. A request that matches neither `/api/*` nor `/ws` gets `index.html`, which is what makes a deep link like `/u/someone` work.

Development runs the same shape: vite owns `localhost:5173` and proxies `/api` and `/ws` to the server on `:3001`. The one wrinkle is in `packages/web/vite.config.ts`, which rewrites the `Origin` header on the way through, because better-auth checks it against `BETTER_AUTH_URL` and would otherwise see the vite port.

Production needs a bundle before it boots: `pnpm build` writes `packages/web/dist`, and a production server with no dist there throws instead of quietly serving the API alone.

`pnpm --filter @termitary/server start` runs `node --import tsx`, deliberately one process rather than `tsx` spawning a child. A supervisor stops the service by signal, and the `SIGTERM` handler in `index.ts` is what clears the sweep timer and closes the SQLite handle. Behind the `tsx` wrapper the signal killed the parent and the shutdown was cut off half done, reported as exit 143.

## Social sign-in

A development checkout with no OAuth credentials still runs. `GET /api/auth-providers` answers `{ "providers": [] }`, `/signin` renders the email form alone, and email OTP is the only way in. Codes print to the server console; nothing sends mail yet.

Set one pair and that provider's button appears. Set both and both appear. Set half a pair and the server refuses to boot, in any environment, because half a pair is a typo rather than a configuration.

Production is stricter: it demands both pairs. The OTP flow behind them has no working delivery, so a production deployment missing a provider is one where most players cannot sign in at all.

### Registering the apps

Both providers need a redirect URI of `<BETTER_AUTH_URL>/api/auth/callback/<provider>`. Local development is:

```
http://localhost:3001/api/auth/callback/google
http://localhost:3001/api/auth/callback/github
```

Register the production URLs as separate entries, in the same app or a second one. Google wants them under Authorized redirect URIs on an OAuth 2.0 Client ID; GitHub allows one callback URL per OAuth App, so production needs its own app.

The client id is not a secret. It travels in the authorize URL and the browser sees it. The client secret is one, so it belongs in `.env` and never in a commit. Once a secret is in git history you cannot rotate it out without rewriting history, and GitHub revokes any OAuth secret its scanner finds in a public repository.

## What tests do not cover

`src/adapters/auth/social-providers.test.ts` checks the first leg: `POST /api/auth/sign-in/social` returns an authorize URL at the right host, with the client id and redirect URI we configured. That catches a missing variable, a wrong provider key, and a wrong `BETTER_AUTH_URL`.

It stops there. The callback is a redirect chain through a third party, and `app.inject` follows no redirects and keeps no cookies. Same blind spot CORS and `BETTER_AUTH_URL` already have. Click the button in a real browser after changing any of this.
