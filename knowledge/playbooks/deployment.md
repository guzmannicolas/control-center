# Playbook: Deployment & Continuous Delivery

This standard operating procedure outlines the exact workflow for building, packaging, and deploying updates across the web frontend and API microservices.

## 1. Web Frontend Deployment (Vercel)

- **Target Domain**: `control.nicoguzmandev.com`
- **Host**: Vercel Cloud Platform.
- **Trigger**: Git push to `origin main` branch.
- **Build Command**: `pnpm --filter @cc/web build` (`tsc --noEmit && vite build`).
- **Output**: `apps/web/dist/`.

### Deployment Procedure
```bash
cd apps/web
pnpm run build
git add .
git commit -m "feat: description of changes"
git push origin main
```
Vercel automatically detects the commit, initiates the build pipeline, and deploys the new bundle to the edge network in ~30 seconds.

## 2. API Backend Deployment (Docker on Contabo VPS)

- **Container Name**: `control-center-api-1`
- **Host**: Contabo VPS (`173.212.224.70`, SSH port `2222`).
- **Internal Port**: `4100`.
- **Target File**: `/app/dist/server.js` inside the container.

### Fast Hot-Swap Procedure (Recommended)
When modifying TypeScript files in `apps/api/src/` without changing dependencies:

1. **Compile Bundle Locally**:
   ```bash
   cd apps/api
   pnpm run build
   ```
   This generates `apps/api/dist/server.js` (bundled via `esbuild`).

2. **Upload Bundle to VPS**:
   ```powershell
   scp -P 2222 -i ~/.ssh/id_ed25519 apps/api/dist/server.js adminnico@173.212.224.70:/tmp/server.js
   ```

3. **Inject into Running Container & Restart**:
   ```powershell
   ssh -p 2222 -i ~/.ssh/id_ed25519 adminnico@173.212.224.70 "docker cp /tmp/server.js control-center-api-1:/app/dist/server.js && docker restart control-center-api-1"
   ```

4. **Verify Container Health**:
   ```powershell
   ssh -p 2222 -i ~/.ssh/id_ed25519 adminnico@173.212.224.70 "docker logs --tail 20 control-center-api-1"
   ```
   Ensure the log confirms `Server listening at http://127.0.0.1:4100` and healthcheck returns `200`.

## 3. Database Schema Migrations

When modifying `apps/api/prisma/schema.prisma`:

1. **Deploy to Production Postgres**:
   ```powershell
   ssh -p 2222 -i ~/.ssh/id_ed25519 adminnico@173.212.224.70 "docker exec -i control-center-api-1 npx prisma migrate deploy"
   ```
2. **Re-generate Prisma Client**:
   ```bash
   cd apps/api
   pnpm run db:generate
   ```
