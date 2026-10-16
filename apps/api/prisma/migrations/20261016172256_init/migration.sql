-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('domain', 'website', 'vercel_project', 'github_repo', 'server', 'service');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('ok', 'warn', 'fail', 'error');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('warn', 'fail');

-- CreateTable
CREATE TABLE "targets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TargetType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "checker" TEXT NOT NULL,
    "interval_seconds" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_status" "CheckStatus",
    "last_checked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" UUID NOT NULL,
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CheckStatus" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "severity" "Severity" NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "last_message" TEXT NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitors_target_id_checker_key" ON "monitors"("target_id", "checker");

-- CreateIndex
CREATE INDEX "results_monitor_id_checked_at_idx" ON "results"("monitor_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "incidents_monitor_id_opened_at_idx" ON "incidents"("monitor_id", "opened_at" DESC);

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one open incident per monitor (Prisma cannot express partial indexes).
CREATE UNIQUE INDEX "incidents_one_open_per_monitor" ON "incidents"("monitor_id") WHERE "resolved_at" IS NULL;
