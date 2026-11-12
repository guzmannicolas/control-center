-- CreateTable
CREATE TABLE "llm_traces" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT NOT NULL,
    "caller" TEXT NOT NULL DEFAULT 'agent',
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error_message" TEXT,
    "prompt_preview" TEXT,
    "response_preview" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_traces_created_at_idx" ON "llm_traces"("created_at" DESC);

-- CreateIndex
CREATE INDEX "llm_traces_provider_model_idx" ON "llm_traces"("provider", "model");

-- CreateIndex
CREATE INDEX "llm_traces_status_idx" ON "llm_traces"("status");
