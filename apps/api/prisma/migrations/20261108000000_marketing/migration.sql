-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK');

-- CreateEnum
CREATE TYPE "SocialPostType" AS ENUM ('POST', 'REEL', 'CAROUSEL', 'STORY');

-- CreateEnum
CREATE TYPE "SocialDraftStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'NEEDS_ATTENTION');

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "tone_of_voice" TEXT NOT NULL,
    "style_directives" JSONB NOT NULL DEFAULT '{}',
    "target_audience" TEXT,
    "whatsapp_number" TEXT,
    "telegram_chat_id" TEXT,
    "dossier_md" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_drafts" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "post_type" "SocialPostType" NOT NULL,
    "caption" TEXT NOT NULL,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SocialDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_for" TIMESTAMPTZ(3),
    "approval_token" TEXT NOT NULL,
    "feedback" TEXT,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "external_campaign_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "daily_budget" DOUBLE PRECISION NOT NULL,
    "spend_to_date" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "safety_guardrail" DOUBLE PRECISION NOT NULL,
    "insights" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "social_drafts_approval_token_key" ON "social_drafts"("approval_token");

-- CreateIndex
CREATE INDEX "social_drafts_brand_id_status_idx" ON "social_drafts"("brand_id", "status");

-- CreateIndex
CREATE INDEX "ad_campaigns_brand_id_status_idx" ON "ad_campaigns"("brand_id", "status");

-- AddForeignKey
ALTER TABLE "social_drafts" ADD CONSTRAINT "social_drafts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
