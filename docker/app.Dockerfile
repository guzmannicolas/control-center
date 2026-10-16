# Multi-stage build: "build" has every tool, "runtime" ships only what runs.

FROM node:22-alpine AS base
# Prisma's migration engine needs OpenSSL.
RUN apk add --no-cache openssl && corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

FROM base AS build
# Manifests first: dependencies are only reinstalled when they change, not on every code edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
# prisma.config.ts needs a DATABASE_URL to load; generating the client never connects.
RUN DATABASE_URL=postgresql://build@localhost/build pnpm --filter @cc/api exec prisma generate \
 && pnpm --filter @cc/api build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @cc/api deploy --prod --legacy --store-dir /pnpm/store /prod/api \
 # Prisma ships a query engine per database; keep only PostgreSQL's (~55 MB less).
 && find /prod/api/node_modules/.pnpm -path '*/@prisma/client/runtime/*' \
      \( -name '*.mysql.*' -o -name '*.sqlite.*' -o -name '*.sqlserver.*' -o -name '*.cockroachdb.*' \) -delete

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api/package.json ./
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 4100
CMD ["node", "--enable-source-maps", "dist/server.js"]
