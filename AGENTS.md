# AGENTS.md — Control Center

Context specification guide for AI assistants and development agents working on the `control-center` repository.

## 0. Mandatory Project Policies
- **LEVEL 1 MANDATORY DIRECTIVE (KNOWLEDGE BASE FIRST)**: Any AI agent (Antigravity, Cursor, Claude Code, Roo Code, etc.) operating on this repository MUST first read `knowledge/index.md` or access the MCP resource `knowledge://index` before planning or executing any changes to architecture, database models, background queues, or business logic.
- **Strict No-Emoji Policy**: Emojis are STRICTLY PROHIBITED across all user interface elements, commit messages, code files, and agent communication. Use clean SVG icons, monochrome indicators, or text labels only.
- **Language Policy**: ALL user interface (UI) copy, labels, placeholders, titles, status badges, buttons, tooltips, and documentation in Control Center MUST be in English.

## 1. Project Overview
Self-hosted monitoring and control hub for Nicolás Guzmán's online infrastructure: domains, websites, Vercel deployments, databases, B2B sales leads, and VPS servers. Performs scheduled background checks, logs incidents when failures occur, and provides a unified dashboard.

- **Production:** Internal API listening on `127.0.0.1:4100` (`docker-compose.vps.yml`), published via Cloudflare Tunnel at `https://control-api.nicoguzmandev.com`.
- **Dashboard:** Single-user React app served with secure session cookies (`credentials: include`).

---

## 2. Monorepo Architecture (pnpm workspace)

```
control-center/
├── apps/
│   ├── api/          # Fastify API + health checkers + scheduler (BullMQ + Redis)
│   └── web/          # React 19 + Vite 8 + TanStack Query + Tailwind CSS 4 Dashboard
├── packages/
│   └── shared/       # Shared Zod validation schemas and TypeScript types
├── docker/           # Production container definitions (app.Dockerfile)
├── docker-compose.yml     # Base definition (Postgres, Redis, tools)
└── docker-compose.vps.yml # Production override on VPS (cms network, log mounts)
```

---

## 3. Tech Stack & Tools
- **Language:** TypeScript 6.
- **Backend:** Node.js, Fastify 5, Prisma 7 (@prisma/adapter-pg), BullMQ 6, Redis 7 (ioredis), PostgreSQL 16 (pg).
- **Dashboard:** React 19, Vite 8, TanStack React Query 5, Tailwind CSS 4.
- **Features & Checkers:**
  - `http-uptime`, `ssl-expiry`, `domain-expiry` (RDAP), `postgres-health`, `redis-health`, `backup-age`.
  - Vercel Projects & Deployment integration.
  - Live VPS health, disk usage metrics, and one-click maintenance cleanup tools.
  - Local backups monitoring & on-demand execution.
  - B2B Sales Prospecting & Google Maps lead enrichment.
- **Security:** Constant-time salted scrypt password hashing. `HttpOnly`, `Secure`, `SameSite=Lax` session cookies. Redis-based brute force protection.

---

## 4. Key Commands (via Docker tools container)

```bash
# Docker Development Environment
docker compose up -d postgres redis
docker compose run --rm tools pnpm install
docker compose run --rm tools pnpm typecheck
docker compose run --rm tools pnpm test
docker compose run --rm tools pnpm --filter @cc/api exec prisma migrate dev
docker compose run --rm tools pnpm --filter @cc/api db:seed
docker compose run --rm --service-ports tools pnpm dev:api
docker compose run --rm tools pnpm dev:worker

# Production VPS Deployment
docker compose up -d --build
docker compose ps
docker compose logs -f worker
docker compose logs -f api
```

---

## 5. Architectural Gotchas & Decisions
1. **Isolated Storage:** Control Center operates its own independent Postgres and Redis instances, isolated from the systems it observes.
2. **Database Health Checker Role:** Monitored databases configure a read-only `cc_monitor` user assigned to system role `pg_monitor`; it cannot read user tables.
3. **Resilient Checkers:** Checker crashes or timeouts result in an `error` status rather than bringing down the worker service.
4. **Git:** Remote repository at `https://github.com/guzmannicolas/control-center.git`, branch `main`.
5. **English Standard:** All newly created pages, components, and messages must be in English.
