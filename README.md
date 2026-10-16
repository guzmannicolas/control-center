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

## Stack

TypeScript everywhere · Fastify · PostgreSQL + Prisma · Redis + BullMQ · React + Vite (dashboard) · Zod (shared validation) · Vitest + Playwright · Docker Compose · GitHub Actions.

```
apps/api         Fastify API, checkers, scheduler
apps/web         React dashboard (coming)
packages/shared  Zod schemas and types shared by API and dashboard
```

The control center has its **own** Postgres and Redis, separate from the services it watches, so it keeps working when they break.

## Development

Needs only Docker. Node tools run in the `tools` container.

```sh
cp .env.example .env                              # then set a real POSTGRES_PASSWORD (and DATABASE_URL)
docker compose up -d postgres redis
docker compose run --rm tools pnpm install
docker compose run --rm tools pnpm --filter @cc/api exec prisma migrate dev
docker compose run --rm --service-ports tools pnpm dev:api   # http://127.0.0.1:4100/health

docker compose run --rm tools pnpm typecheck
docker compose run --rm tools pnpm test
```

`GET /health` answers `200` when the database and Redis respond, and `503` (within 2 s) naming the part that is down.
