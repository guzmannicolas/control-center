# Control Center

A self-hosted control center for everything I run online: domains, websites, deployments, repositories and servers. Scheduled checks record what happened over time, open incidents when something breaks, and feed a dashboard.

## How it works

| Concept | Table | Meaning |
|---|---|---|
| Target | `targets` | Something I own (a domain, a site, a Vercel project, a repo, a server). |
| Monitor | `monitors` | One checker run against one target on an interval (e.g. `ssl-expiry` every 24 h). |
| Result | `results` | What happened each time a monitor ran: status, duration, message, numeric metrics. |
| Incident | `incidents` | A problem with a start and an end, so one outage means one alert, not one per check. |

Statuses: `ok` · `warn` (works, needs attention) · `fail` (broken) · `error` (the check itself could not run).
A target's status is the worst status among its monitors.

New things to watch are added as **checkers**: one file that follows a common contract. The scheduler, storage, incidents and dashboard work with it without changes.

| Checker | Applies to | Default interval | What it reports |
|---|---|---|---|
| `http-uptime` | website, service | 5 min | Status code and response time; can require a redirect (e.g. a login wall that must stay in front). |
| `ssl-expiry` | website, service, domain | 24 h | Whether the certificate is trusted and how many days are left. |
| `domain-expiry` | domain | 24 h | Registration record from RDAP: expiry, registrar, DNS provider, DNSSEC, transfer lock. |
| `postgres-health` | database | 5 min | Version, size, connections, uptime, cache hit rate, biggest tables. |
| `redis-health` | database | 5 min | Version, memory, keys, clients, persistence. |
| `backup-age` | database | 1 h | When the backup script last succeeded, its size, and any warnings it printed. |

### Watching databases safely

- Each watched Postgres has a `cc_monitor` user that is only a member of `pg_monitor`: it reads statistics, never rows, and cannot write (`CREATE ROLE cc_monitor LOGIN PASSWORD '…' CONNECTION LIMIT 3 IN ROLE pg_monitor`).
- Connection URLs live in `.env` under names starting with `MONITOR_`; a target only names the variable, and checkers refuse any other name, so they can never be pointed at `DATABASE_URL` or another secret. The API never returns them.
- The backup checker reads only the backup script's log, mounted read-only, never the backup files.
- Server-specific wiring (joining the CMS network, the log mount) lives in `docker-compose.vps.yml`, enabled with `COMPOSE_FILE` in `.env`, so `docker-compose.yml` stays portable.

### Processes

- **API** (`src/server.ts`): answers requests.
- **Worker** (`src/worker.ts`): every minute it syncs monitors from Postgres into BullMQ job schedulers (Redis), then runs checks as they come due, up to 5 at a time. A missing, misconfigured, crashing or hanging checker becomes an `error` result instead of taking the worker down. Each result, the monitor's latest status and any incident change are saved in one transaction.

## Stack

TypeScript everywhere · Fastify · PostgreSQL + Prisma · Redis + BullMQ · React + Vite (dashboard) · Zod (shared validation) · Vitest + Playwright · Docker Compose · GitHub Actions.

```
apps/api         Fastify API, checkers, scheduler
apps/web         React dashboard (Vite, TanStack Query, Tailwind)
packages/shared  Zod schemas and types shared by API and dashboard
```

The control center has its **own** Postgres and Redis, separate from the services it watches, so it keeps working when they break.

## Dashboard

A React app (`apps/web`) for one user. Sections come from one registry (`src/sections.tsx`): **Overview** (status counts, open incidents, every target with its checks, a response-time chart), **Domains** (renewal, registrar, DNS, transfer lock, sites on each domain) and **Databases** (health, size, biggest tables, backups), **Improvements** (a backlog stored in Postgres: area, priority, idea → planned → in progress → done) and **Learning** (one study module per technology used here, with interview questions and a quiz; passing it earns a badge, and modules not yet passed show as knowledge debt). The overview's chart (24 h / 7 / 30 days, hover or arrow keys to read values, table view). Status is never shown by color alone. Light and dark mode.

The dashboard calls the API at its own subdomain with `credentials: 'include'`: CORS allows only `DASHBOARD_ORIGIN`, and the session cookie works because both addresses are on the same site. Set `VITE_API_URL` at build time (`https://control-api.nicoguzmandev.com` in production, `http://localhost:4101` for local tests). API responses are `Cache-Control: no-store`.

Known limitation: the API is behind Cloudflare, and Spanish ISPs block Cloudflare IP ranges during LaLiga matches, so from Spain the dashboard cannot reach it at those times (it shows an error with Retry after 15 s). Forwarding the API through Vercel would avoid it, but Cloudflare's bot protection challenges Vercel's server-to-server requests; that needs Bot Fight Mode off for the zone, or a route that skips Cloudflare.

### Login

- Passwords: scrypt (N=2^16, r=8), salted, compared in constant time. Unknown emails cost the same time as wrong passwords.
- Sessions: 256-bit random token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; the database stores only its SHA-256. 7 days.
- Brute force: 5 attempts per 15 minutes per IP, counted in Redis.
- CORS allows only `DASHBOARD_ORIGIN`; requests that change something must come from that origin (CSRF).
- No sign-up. Create or reset a user on the server: `docker compose run --rm tools pnpm --filter @cc/api user:create you@example.com`

## Production (on the VPS)

```sh
docker compose up -d --build      # migrate → api + worker, restarted automatically
docker compose ps                 # api shows (healthy)
docker compose logs -f worker     # one JSON line per check
```

- `migrate` applies pending migrations once and exits; `api` and `worker` start only if it succeeds.
- One image (`docker/app.Dockerfile`, multi-stage) runs both: `node dist/server.js` or `node dist/worker.js`, as a non-root user, with no source, dev tools or `.env` inside. esbuild bundles our TypeScript; npm dependencies are installed with `pnpm deploy --prod`.
- `.pnpmfile.cjs` stops `@prisma/client`'s optional peers (the Prisma CLI, TypeScript) from leaking into production, and the build keeps only the PostgreSQL query engine: 745 MB → 313 MB.
- The API listens on `127.0.0.1:4100` only. Logs rotate (3 × 10 MB per container); API and worker are capped at 256 MB of RAM.

## Development

Needs only Docker. Node tools run in the `tools` container.

```sh
cp .env.example .env                              # then set a real POSTGRES_PASSWORD (and DATABASE_URL)
docker compose up -d postgres redis
docker compose run --rm tools pnpm install
docker compose run --rm tools pnpm --filter @cc/api exec prisma migrate dev
docker compose run --rm tools pnpm --filter @cc/api db:seed  # load targets (safe to re-run)
docker compose run --rm --service-ports tools pnpm dev:api   # http://127.0.0.1:4101/health
docker compose run --rm tools pnpm dev:worker                # runs checks (stop the production worker first)

docker compose run --rm tools pnpm typecheck
docker compose run --rm tools pnpm test
```

Tests: unit tests for pure logic, checker tests against a local HTTP server (no internet), and integration tests against a real Postgres database (`TEST_DATABASE_URL`, created and migrated automatically; skipped when unset).

`GET /health` answers `200` when the database and Redis respond, and `503` (within 2 s) naming the part that is down.
