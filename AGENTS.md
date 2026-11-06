# AGENTS.md — Control Center

Guía de contexto para asistentes de IA y agentes de desarrollo sobre el repositorio \control-center\.

## 1. Visión General del Proyecto
Centro de control y monitoreo auto-hospedado para la infraestructura personal de Nicolás Guzmán: sitios web, dominios, deployments de Vercel, bases de datos y servidores VPS. Realiza chequeos periódicos, abre incidentes ante fallas y provee un dashboard interactivo unificado.

- **Producción:** API interna en \127.0.0.1:4100\ (\docker-compose.vps.yml\), pública vía Cloudflare en \https://control-api.nicoguzmandev.com\.
- **Dashboard:** React app servida con cookies de sesión seguras (\credentials: include\).

---

## 2. Arquitectura del Monorepo (pnpm workspace)

\\\
control-center/
├── apps/
│   ├── api/          # Fastify API + checkers + scheduler (BullMQ + Redis)
│   └── web/          # React 19 + Vite 8 + TanStack Query + Tailwind CSS 4 Dashboard
├── packages/
│   └── shared/       # Esquemas de validación Zod y tipos compartidos
├── docker/           # Dockerfiles de producción (app.Dockerfile)
├── docker-compose.yml     # Definición base (Postgres, Redis, tools)
└── docker-compose.vps.yml # Override de producción en VPS (red cms, mounts)
\\\

---

## 3. Tech Stack y Herramientas
- **Lenguaje:** TypeScript 6.
- **Backend:** Node.js, Fastify 5, Prisma 7 (@prisma/adapter-pg), BullMQ 6, Redis 7 (ioredis), PostgreSQL 16 (pg).
- **Dashboard:** React 19, Vite 8, TanStack React Query 5, Tailwind CSS 4.
- **Checkers disponibles:** \http-uptime\, \ssl-expiry\, \domain-expiry\ (RDAP), \postgres-health\, \edis-health\, \ackup-age\.
- **Seguridad:** Passwords hasheadas con \scrypt\ en tiempo constante. Sesiones en cookies \HttpOnly\, \Secure\, \SameSite=Lax\. Rate limit en Redis.

---

## 4. Comandos Clave (usando contenedor tools de Docker)

\\\ash
# Entorno con Docker (Recomendado)
docker compose up -d postgres redis
docker compose run --rm tools pnpm install
docker compose run --rm tools pnpm typecheck
docker compose run --rm tools pnpm test
docker compose run --rm tools pnpm --filter @cc/api exec prisma migrate dev
docker compose run --rm tools pnpm --filter @cc/api db:seed
docker compose run --rm --service-ports tools pnpm dev:api
docker compose run --rm tools pnpm dev:worker

# En el VPS (Despliegue de Producción)
docker compose up -d --build
docker compose ps
docker compose logs -f worker
docker compose logs -f api
\\\

---

## 5. Gotchas y Decisiones Arquitectónicas
1. **Aislamiento de Monitoreo:** Control Center tiene su propia base de datos Postgres y Redis, aisladas de los servicios que audita.
2. **Rol de Base de Datos para Monitoreo:** Las bases auditadas usan un usuario \cc_monitor\ limitado al rol de sistema \pg_monitor\; nunca tiene permisos de lectura de datos de usuarios.
3. **Checkers a Prueba de Fallos:** Un checker que falle, crashee o cuelgue reporta estado \error\ en lugar de tumbar el proceso del worker.
4. **Git:** Rama \main\ en \https://github.com/guzmannicolas/control-center.git\.
