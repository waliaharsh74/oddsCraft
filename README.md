# OddsCraft

OddsCraft is a multi-service trading playground for binary event markets. It includes an HTTP API for account management and order entry, a WebSocket gateway for real-time market data, and a Next.js web client that surfaces both. Redis coordinates shared market state while Postgres persists accounts, orders, trades, and settlements.

## Feature overview
- **Auto-seeded liquidity:** A built-in market-maker seeds each event with initial depth and updates prices in Redis as user trades arrive, keeping HTTP and WebSocket backends in sync.
- **Limit & market orders:** Orders are persisted in Postgres with maker/taker attribution. Pricing updates and fills are fanned out through Redis so connected clients see depth changes immediately.
- **Liquidation & settlement hooks:** Event outcomes and dispute tracking live in the schema, enabling liquidation/settlement flows that reconcile user balances after markets close.

## Service layout
- **HTTP backend (`apps/http-backend`):** Express API for auth, balances, order entry, and market lifecycle. Uses Prisma against Postgres and publishes market depth/pricing to Redis. Issues HTTP-only JWT cookies that the WebSocket gateway re-validates.
- **WebSocket backend (`apps/ws-backend`):** Listens to Redis pub/sub channels and cached keys for the latest depth, trades, and market-maker pricing, then streams them to subscribed clients. Incoming connections must present the HTTP-issued access token cookie.
- **Web client (`apps/web`):** Next.js UI that calls the HTTP API for mutations and subscribes to the WebSocket gateway for live prices, depth, and trades.

Both backends share Redis for caching market-maker state and last-known depth/pricing, keeping new clients hydrated without round-trips to Postgres.

## Prerequisites
- Node.js 18+ and pnpm (`corepack enable` or `npm i -g pnpm`).
- Postgres 15+ and Redis 7+. The included `docker-compose.yaml` exposes both at `localhost:5432` and `localhost:6379`.

Install workspace dependencies:

```bash
pnpm install
```

## Environment variables
### HTTP backend (`apps/http-backend`)
- `DATABASE_URL` – Postgres connection string (e.g., `postgresql://postgres:postgres@localhost:5432/oddsdb`).
- `REDIS_URL` – Redis connection string (defaults to `redis://localhost:6379`).
- `ACCESS_JWT_SECRET` / `REFRESH_JWT_SECRET` – Secrets for issuing/verifying auth cookies.
- `FRONTEND_URL` – Allowed CORS origin (defaults to `http://localhost:3000`).
- `PORT` – HTTP port (defaults to `3001`).

### WebSocket backend (`apps/ws-backend`)
- `REDIS_URL` – Redis connection string (defaults to `redis://localhost:6379`).
- `ACCESS_JWT_SECRET` – Must match the HTTP backend so cookie verification succeeds.
- `PORT` – WebSocket port (defaults to `8081`).

### Web client (`apps/web`)
- `NEXT_PUBLIC_API_URL` – Base URL for the HTTP backend (e.g., `http://localhost:3001`).
- `NEXT_PUBLIC_WS_URL` – WebSocket gateway URL (e.g., `ws://localhost:8081`).

## Local development
1. Start Postgres and Redis (either locally or via Docker):
   ```bash
   docker compose up db redis
   ```
2. Generate Prisma client and apply migrations to the development database (from repo root):
   ```bash
   pnpm --filter @repo/db build
   pnpm --filter http-backend migrate
   ```
3. Run the services in watch mode:
   ```bash
   pnpm dev --filter http-backend --filter ws-backend --filter web --parallel
   ```
   The web client will render at `http://localhost:3000`, talking to the HTTP API on `3001` and WebSocket gateway on `8081`.

## One-shot startup (all apps)
Use Docker Compose to boot every service with sensible defaults:

```bash
docker compose up --build
```

This launches Postgres, Redis, the HTTP backend (port 3001), WebSocket backend (port 8081), and the web client (port 3000) together. Update the environment blocks in `docker-compose.yaml` if you need custom credentials or hostnames.
