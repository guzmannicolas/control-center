-- CreateEnum
CREATE TYPE "ImprovementStatus" AS ENUM ('idea', 'planned', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "improvements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "ImprovementStatus" NOT NULL DEFAULT 'idea',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "done_at" TIMESTAMPTZ(3),

    CONSTRAINT "improvements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "user_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateIndex
CREATE INDEX "improvements_status_idx" ON "improvements"("status");

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

