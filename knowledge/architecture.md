# System Architecture & Infrastructure Topology

This document details the hardware, network, virtualization, and runtime topology for the Control Center and Directus CMS ecosystem.

## 1. Physical Host (VPS)

- **Provider**: Contabo Cloud VPS (Frankfurt/EU datacenter).
- **Public IP**: `173.212.224.70`.
- **Operating System**: Ubuntu Linux 24.04 LTS (Kernel 6.8.x).
- **SSH Access**:
  - Port: `2222` (custom hardened port).
  - User: `adminnico` (UID `1001`, GID `1001`).
  - Auth: Ed25519 public key authentication (`~/.ssh/id_ed25519`).
- **Disk Topology**:
  - `/home/adminnico/cms`: Directus CMS stack root.
  - `/home/adminnico/cms/backups`: Local retention directory for daily archives.
  - `/home/adminnico/control-center`: Control Center deployment root.

## 2. Docker Containers & Virtual Networks

All background services run inside Docker containers managed via Docker Compose.

| Container Name | Base Image | Ports / Bindings | Purpose |
| :--- | :--- | :--- | :--- |
| `cms-caddy-1` | `caddy:2-alpine` | `80:80`, `443:443`, `443/udp` | Ingress reverse proxy with automated Let's Encrypt TLS. |
| `cms-directus-1` | `directus/directus:11.17.4` | `8055/tcp` (internal) | Headless CMS for content management and media uploads. |
| `cms-postgres-1` | `postgres:16-alpine` | `5432/tcp` (internal) | Primary relational database for Directus CMS. |
| `cms-redis-1` | `redis:7-alpine` | `6379/tcp` (internal) | Cache and rate-limiting store for Directus. |
| `control-center-api-1` | `control-center-app` | `127.0.0.1:4100->4100` | Fastify REST API, Agent executor, and Knowledge hub. |
| `control-center-worker-1` | `control-center-worker` | Internal BullMQ runner | Async job processor for health checks and monitoring. |
| `control-center-postgres-1` | `postgres:16-alpine` | `5432/tcp` (internal) | Dedicated database for Control Center (`control` db). |
| `control-center-redis-1` | `redis:7-alpine` | `6379/tcp` (internal) | BullMQ queue store for Control Center tasks. |
| `cloudflared-cloudflared-1`| `cloudflare/cloudflared` | Outbound tunnel | Zero-trust tunnel routing `control.nicoguzmandev.com`. |
| `cloudflared-ttyd-1` | `tsl0922/ttyd:alpine` | Internal web terminal | Web-based shell for authorized admins. |

### Networks
- `cms_net` (`bridge`): Interconnects Caddy, Directus, CMS Postgres, and CMS Redis.
- `control-center_default` (`bridge`): Interconnects API, Worker, Control Postgres, and Control Redis.
- `cms_cms_net` (`external`): Bridge connecting Control Center worker to CMS Postgres for statistics and monitoring.

## 3. Storage Volumes & Mounting

- `pg_data` (`/var/lib/postgresql/data` in `cms-postgres-1`): Persistent Directus data.
- `directus_uploads` (`/directus/uploads` in `cms-directus-1`): Media files and documents.
- `caddy_data` & `caddy_config`: TLS certificates and reverse proxy cache.
- `control-center-postgres-1_data`: Control Center database storing Leads, Monitors, and Chat Sessions.
- Container Host Mounts in `control-center-api-1`:
  - `/home/adminnico:/home/adminnico`
  - `/var/run/docker.sock:/var/run/docker.sock` (inspected via Docker CLI)
  - `/:/host:ro` (read-only root inspection)

## 4. Cloudflare Zero-Trust & DNS

- **Tunnel Origin**: `cloudflared` client container.
- **Access Authentication**: Protected by Cloudflare Access team (`zepebot.cloudflareaccess.com`) with OAuth login.
- **Public Hostnames**:
  - `control.nicoguzmandev.com`: Control Center Web App (hosted on Vercel).
  - `control-api.nicoguzmandev.com`: Control Center Backend API (routed via Caddy -> container port 4100).
  - `cms.nicoguzmandev.com`: Directus CMS Admin & API (routed via Caddy -> container port 8055).
