import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  GenerateDraftInput,
  UpdateDraftStatusInput,
  DispatchApprovalInput,
  UpdateAdCampaignInput,
  CreateAdCampaignInput,
  UpdateDraftInput,
  UpdateBrandPlatformsInput,
  SyncInstagramInput,
  AddInstagramPostInput,
  UpdateBrandIntegrationsInput,
  TestChatMessageInput,
  type MarketingOverview,
  type SocialDraftView,
  type AdCampaignView,
  type BrandView,
  type BrandConversationView,
} from '@cc/shared';
import { generateSocialCreative, auditAdCampaigns, synthesizeSocialStylePlaybook } from './agent.js';
import { dispatchDraftApproval } from './dispatch.js';
import { ensureMarketingSeed } from './seed-helper.js';
import { scrapeInstagramProfile, extractInstagramPostFromEmbed } from './instagram-scraper.js';
import { publishDraftToSocialPlatforms, checkAndPublishScheduledDrafts } from './publisher.js';
import { generateBrandChatReply } from './chat-agent.js';

export const marketingRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
  // Helper to serialize Prisma Brand to BrandView
  const toBrandView = (b: any): BrandView => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    website: b.website,
    toneOfVoice: b.toneOfVoice,
    styleDirectives: (b.styleDirectives ?? {}) as Record<string, unknown>,
    targetAudience: b.targetAudience ?? null,
    whatsappNumber: b.whatsappNumber ?? null,
    telegramChatId: b.telegramChatId ?? null,
    dossierMd: b.dossierMd ?? null,
    socialStyleMd: b.socialStyleMd ?? null,
    instagramHandle: b.instagramHandle ?? null,
    activePlatforms: (b.activePlatforms ?? ['INSTAGRAM', 'FACEBOOK']) as any,
    scrapedPosts: (b.scrapedPosts ?? []) as any,
    integrations: (b.integrations ?? {}) as any,
    autoPublish: Boolean(b.autoPublish),
    autoReplyChat: Boolean(b.autoReplyChat),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  });

  // Helper to serialize Prisma SocialDraft to SocialDraftView
  const toDraftView = (d: any): SocialDraftView => ({
    id: d.id,
    brandId: d.brandId,
    brandName: d.brand?.name,
    brandSlug: d.brand?.slug,
    platform: d.platform,
    postType: d.postType,
    caption: d.caption,
    mediaUrls: d.mediaUrls ?? [],
    status: d.status,
    scheduledFor: d.scheduledFor?.toISOString() ?? null,
    approvalToken: d.approvalToken,
    feedback: d.feedback ?? null,
    metrics: (d.metrics ?? {}) as Record<string, unknown>,
    publishedAt: d.publishedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  });

  // Helper to serialize Prisma AdCampaign to AdCampaignView
  const toCampaignView = (c: any): AdCampaignView => ({
    id: c.id,
    brandId: c.brandId,
    brandName: c.brand?.name,
    brandSlug: c.brand?.slug,
    platform: c.platform,
    externalCampaignId: c.externalCampaignId,
    campaignName: c.campaignName,
    objective: c.objective,
    dailyBudget: Number(c.dailyBudget),
    spendToDate: Number(c.spendToDate),
    cpa: Number(c.cpa),
    ctr: Number(c.ctr),
    roas: Number(c.roas),
    status: c.status,
    safetyGuardrail: Number(c.safetyGuardrail),
    insights: (c.insights ?? {}) as Record<string, unknown>,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  const toConversationView = (c: any): BrandConversationView => ({
    id: c.id,
    brandId: c.brandId,
    platform: c.platform,
    customerHandle: c.customerHandle,
    customerName: c.customerName,
    status: c.status,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : c.createdAt.toISOString(),
    messages: (c.messages ?? []) as any,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  const attemptAutoPublish = async (draftId: string) => {
    try {
      const draft = await prisma.socialDraft.findUnique({
        where: { id: draftId },
        include: { brand: true },
      });
      if (!draft || draft.status !== 'APPROVED' || !draft.brand?.autoPublish) {
        return;
      }
      if (draft.scheduledFor && new Date(draft.scheduledFor) > new Date()) {
        return;
      }
      const pubResult = await publishDraftToSocialPlatforms(draft, draft.brand);
      await prisma.socialDraft.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          metrics: {
            ...((draft.metrics as Record<string, unknown>) ?? {}),
            platformPostId: pubResult.platformPostId,
            live: pubResult.live,
            simulated: pubResult.simulated,
            permalink: pubResult.permalink,
            publishedAt: new Date().toISOString(),
          },
        },
      });
    } catch (err: any) {
      console.error('Auto-publish failed:', err?.message || err);
    }
  };

  // 1. GET /api/marketing/overview
  app.get('/overview', async (req): Promise<MarketingOverview> => {
    // Ensure pilot brand (Niki Peppers) and sample records exist
    await ensureMarketingSeed(prisma);

    const query = req.query as { brandSlug?: string };
    const brandSlug = query.brandSlug || 'nikipeppers';

    const brand = await prisma.brand.findUnique({
      where: { slug: brandSlug },
    });

    const allBrands = await prisma.brand.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });

    const brandFilter = brand ? { brandId: brand.id } : {};

    // Ad Campaigns metrics
    const campaigns = await prisma.adCampaign.findMany({
      where: brandFilter,
      orderBy: { dailyBudget: 'desc' },
      include: { brand: { select: { name: true, slug: true } } },
    });

    let totalDailyBudget = 0;
    let totalSpendToDate = 0;
    let totalCpa = 0;
    let totalCtr = 0;
    let totalRoas = 0;
    let activeCampaignsCount = 0;
    let safetyGuardrailTotal = 0;
    let guardrailBreachedCount = 0;

    for (const c of campaigns) {
      if (c.status === 'ACTIVE') {
        activeCampaignsCount++;
        totalDailyBudget += Number(c.dailyBudget);
        totalCpa += Number(c.cpa);
        totalCtr += Number(c.ctr);
        totalRoas += Number(c.roas);
      }
      totalSpendToDate += Number(c.spendToDate);
      safetyGuardrailTotal += Number(c.safetyGuardrail);
      if (Number(c.dailyBudget) > Number(c.safetyGuardrail)) {
        guardrailBreachedCount++;
      }
    }

    const avgCpa = activeCampaignsCount > 0 ? Number((totalCpa / activeCampaignsCount).toFixed(2)) : 0;
    const avgCtr = activeCampaignsCount > 0 ? Number((totalCtr / activeCampaignsCount).toFixed(2)) : 0;
    const avgRoas = activeCampaignsCount > 0 ? Number((totalRoas / activeCampaignsCount).toFixed(2)) : 0;

    // Social Drafts metrics
    const [pendingCount, approvedCount, publishedCount, draftsCount, recentPending] = await Promise.all([
      prisma.socialDraft.count({ where: { ...brandFilter, status: 'PENDING_APPROVAL' } }),
      prisma.socialDraft.count({ where: { ...brandFilter, status: 'APPROVED' } }),
      prisma.socialDraft.count({ where: { ...brandFilter, status: 'PUBLISHED' } }),
      prisma.socialDraft.count({ where: { ...brandFilter, status: 'DRAFT' } }),
      prisma.socialDraft.findMany({
        where: { ...brandFilter, status: 'PENDING_APPROVAL' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { brand: { select: { name: true, slug: true } } },
      }),
    ]);

    return {
      brand: brand ? toBrandView(brand) : null,
      allBrands,
      ads: {
        totalDailyBudget: Number(totalDailyBudget.toFixed(2)),
        totalSpendToDate: Number(totalSpendToDate.toFixed(2)),
        avgCpa,
        avgCtr,
        avgRoas,
        activeCampaignsCount,
        safetyGuardrailTotal: Number(safetyGuardrailTotal.toFixed(2)),
        guardrailBreachedCount,
      },
      social: {
        pendingApprovalsCount: pendingCount,
        approvedScheduledCount: approvedCount,
        publishedCount,
        draftsCount,
        recentPendingDrafts: recentPending.map(toDraftView),
      },
      agents: {
        trafficAgent: {
          name: 'Traffic & Ads Guardian Agent',
          status: guardrailBreachedCount > 0 ? 'WARNING' : 'ACTIVE',
          lastAuditAt: new Date().toISOString(),
          optimizationsToday: 4,
          guardrailEnforced: true,
          activeRules: [
            'Max daily budget strictly capped at safetyGuardrail',
            'Auto-pause if CPA exceeds target threshold by 50%',
            'Automatic scale-up suggestion if ROAS >= 4.0x',
            'Creative fatigue detection via CTR rolling average',
          ],
        },
        creativeAgent: {
          name: 'Social Creative Agent (Human-in-the-Loop)',
          status: 'READY',
          models: ['Gemini 2.5 Flash', 'Gemini 3.8 Flash (Pro Vision)'],
          lastGeneratedAt: recentPending[0]?.createdAt.toISOString() ?? null,
          brandGuidelinesLoaded: Boolean(brand?.toneOfVoice),
        },
      },
    };
  });

  // 2. GET /api/marketing/drafts
  app.get('/drafts', async (req) => {
    const q = req.query as {
      brandSlug?: string;
      brandId?: string;
      status?: string;
      platform?: string;
    };

    const where: Record<string, unknown> = {};

    if (q.brandId) {
      where.brandId = q.brandId;
    } else if (q.brandSlug) {
      const b = await prisma.brand.findUnique({ where: { slug: q.brandSlug } });
      if (b) where.brandId = b.id;
    }

    if (q.status && q.status !== 'all') {
      where.status = q.status;
    }

    if (q.platform && q.platform !== 'all') {
      where.platform = q.platform;
    }

    const drafts = await prisma.socialDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return { drafts: drafts.map(toDraftView) };
  });

  // 3. POST /api/marketing/drafts/generate
  app.post('/drafts/generate', async (req, reply) => {
    const parsed = GenerateDraftInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid draft input' });
    }

    const { brandSlug = 'nikipeppers', brandId, platform, postType, topic, objective, mediaUrls, scheduledFor } =
      parsed.data;

    let brand = brandId
      ? await prisma.brand.findUnique({ where: { id: brandId } })
      : await prisma.brand.findUnique({ where: { slug: brandSlug } });

    if (!brand) {
      await ensureMarketingSeed(prisma);
      brand = await prisma.brand.findUnique({ where: { slug: 'nikipeppers' } });
    }

    if (!brand) {
      return reply.code(404).send({ error: 'Brand not found' });
    }

    // Call Social Creative Agent
    const creative = await generateSocialCreative({
      brand: {
        name: brand.name,
        website: brand.website,
        toneOfVoice: brand.toneOfVoice,
        styleDirectives: brand.styleDirectives as Record<string, unknown>,
        targetAudience: brand.targetAudience,
        dossierMd: brand.dossierMd ?? undefined,
        socialStyleMd: (brand as any).socialStyleMd ?? undefined,
        instagramHandle: (brand as any).instagramHandle ?? undefined,
        scrapedPosts: (brand as any).scrapedPosts ?? undefined,
      },
      platform,
      postType,
      topic,
      objective,
      mediaUrls,
    });

    const approvalToken = `appr_${randomUUID().replace(/-/g, '')}`;

    const newDraft = await prisma.socialDraft.create({
      data: {
        brandId: brand.id,
        platform,
        postType,
        caption: creative.caption,
        mediaUrls: creative.suggestedMedia,
        status: 'PENDING_APPROVAL',
        approvalToken,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return {
      draft: toDraftView(newDraft),
      creativeInfo: {
        hook: creative.hook,
        hashtags: creative.hashtags,
        source: creative.source,
      },
    };
  });

  // 4. PATCH /api/marketing/drafts/:id/status
  app.patch('/drafts/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateDraftStatusInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid status payload' });
    }

    const existing = await prisma.socialDraft.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Draft not found' });

    const { status, feedback } = parsed.data;

    const updated = await prisma.socialDraft.update({
      where: { id },
      data: {
        status,
        feedback: feedback ?? existing.feedback,
        publishedAt: status === 'PUBLISHED' ? new Date() : existing.publishedAt,
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    if (status === 'APPROVED') {
      await attemptAutoPublish(updated.id);
    }

    const refreshed = await prisma.socialDraft.findUnique({
      where: { id },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return { draft: toDraftView(refreshed ?? updated) };
  });

  // 4b. PATCH /api/marketing/drafts/:id (General draft updates: caption, media, scheduled date)
  app.patch('/drafts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateDraftInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid draft payload' });
    }

    const existing = await prisma.socialDraft.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Draft not found' });

    const updated = await prisma.socialDraft.update({
      where: { id },
      data: {
        ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
        ...(parsed.data.mediaUrls !== undefined ? { mediaUrls: parsed.data.mediaUrls } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.feedback !== undefined ? { feedback: parsed.data.feedback } : {}),
        ...(parsed.data.scheduledFor !== undefined
          ? { scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null }
          : {}),
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return { draft: toDraftView(updated) };
  });

  // 4c. DELETE /api/marketing/drafts/:id
  app.delete('/drafts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.socialDraft.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Draft not found' });

    await prisma.socialDraft.delete({ where: { id } });
    return { ok: true, id };
  });

  // 5. POST /api/marketing/drafts/:id/dispatch-approval
  app.post('/drafts/:id/dispatch-approval', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = DispatchApprovalInput.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid dispatch options' });
    }

    const draft = await prisma.socialDraft.findUnique({
      where: { id },
      include: { brand: true },
    });

    if (!draft) return reply.code(404).send({ error: 'Draft not found' });

    const host = req.headers.host || '127.0.0.1:5173';
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'http';
    const dashboardOrigin = `${proto}://${host}`;

    const targetRecipient = parsed.data.target || draft.brand.whatsappNumber || '+5493512345678';

    const result = await dispatchDraftApproval(
      toDraftView(draft),
      draft.brand.name,
      targetRecipient,
      dashboardOrigin
    );

    return result;
  });

  // 6. GET /api/marketing/ads
  app.get('/ads', async (req) => {
    await ensureMarketingSeed(prisma);

    const query = req.query as { brandSlug?: string; platform?: string };
    const where: Record<string, unknown> = {};

    if (query.brandSlug) {
      const b = await prisma.brand.findUnique({ where: { slug: query.brandSlug } });
      if (b) where.brandId = b.id;
    }

    if (query.platform && query.platform !== 'all') {
      where.platform = query.platform;
    }

    const campaigns = await prisma.adCampaign.findMany({
      where,
      orderBy: { dailyBudget: 'desc' },
      include: { brand: { select: { name: true, slug: true } } },
    });

    const views = campaigns.map(toCampaignView);
    const audit = auditAdCampaigns(views);

    return {
      campaigns: views,
      audit,
    };
  });

  // 7. PATCH /api/marketing/ads/:id
  app.patch('/ads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = UpdateAdCampaignInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid ad campaign update' });
    }

    const campaign = await prisma.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });

    const { status, dailyBudget, safetyGuardrail } = parsed.data;

    // STRICT SAFETY GUARDRAIL ENFORCEMENT
    const effectiveGuardrail = safetyGuardrail ?? campaign.safetyGuardrail;
    if (dailyBudget !== undefined && dailyBudget > effectiveGuardrail) {
      return reply.code(400).send({
        error: `GUARDRAIL VIOLATION: Requested daily budget ($${dailyBudget}) exceeds safety guardrail ($${effectiveGuardrail}). Automated engines are blocked from exceeding this threshold.`,
      });
    }

    const updated = await prisma.adCampaign.update({
      where: { id },
      data: {
        status: status ?? campaign.status,
        dailyBudget: dailyBudget ?? campaign.dailyBudget,
        safetyGuardrail: safetyGuardrail ?? campaign.safetyGuardrail,
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return { campaign: toCampaignView(updated) };
  });

  // 7b. POST /api/marketing/ads (Create new Ad Campaign)
  app.post('/ads', async (req, reply) => {
    const parsed = CreateAdCampaignInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign data' });
    }
    const { brandSlug = 'nikipeppers', brandId, platform, campaignName, objective, dailyBudget, safetyGuardrail } =
      parsed.data;

    let brand = brandId
      ? await prisma.brand.findUnique({ where: { id: brandId } })
      : await prisma.brand.findUnique({ where: { slug: brandSlug } });
    if (!brand) {
      await ensureMarketingSeed(prisma);
      brand = await prisma.brand.findUnique({ where: { slug: 'nikipeppers' } });
    }
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    if (dailyBudget > safetyGuardrail) {
      return reply.code(400).send({
        error: `GUARDRAIL VIOLATION: Requested budget ($${dailyBudget}) exceeds safety guardrail ($${safetyGuardrail}).`,
      });
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        brandId: brand.id,
        platform,
        externalCampaignId: `camp_${randomUUID().slice(0, 8)}`,
        campaignName,
        objective,
        dailyBudget,
        spendToDate: 0,
        cpa: 0,
        ctr: 0,
        roas: 0,
        status: 'ACTIVE',
        safetyGuardrail,
        insights: { note: 'Campaign created' },
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return { campaign: toCampaignView(campaign) };
  });

  // 7c. DELETE /api/marketing/ads/:id
  app.delete('/ads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.adCampaign.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Campaign not found' });

    await prisma.adCampaign.delete({ where: { id } });
    return { ok: true, id };
  });

  // 8. POST /api/marketing/ads/audit
  app.post('/ads/audit', async () => {
    const campaigns = await prisma.adCampaign.findMany();
    const views = campaigns.map(toCampaignView);
    const audit = auditAdCampaigns(views);
    return { audit, timestamp: new Date().toISOString() };
  });

  // 9. GET /api/marketing/brands
  app.get('/brands', async () => {
    await ensureMarketingSeed(prisma);
    const brands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
    return { brands: brands.map(toBrandView) };
  });

  // 10. POST /api/marketing/brands
  app.post('/brands', async (req, reply) => {
    const body = req.body as Partial<{
      slug: string;
      name: string;
      website: string;
      toneOfVoice: string;
      styleDirectives: Record<string, unknown>;
      targetAudience: string;
      whatsappNumber: string;
      telegramChatId: string;
      dossierMd: string;
      instagramHandle: string;
      activePlatforms: string[];
    }>;

    if (!body.slug || !body.name || !body.website || !body.toneOfVoice) {
      return reply.code(400).send({ error: 'slug, name, website, and toneOfVoice are required' });
    }

    const brand = await prisma.brand.upsert({
      where: { slug: body.slug },
      create: {
        slug: body.slug,
        name: body.name,
        website: body.website,
        toneOfVoice: body.toneOfVoice,
        styleDirectives: (body.styleDirectives ?? {}) as any,
        targetAudience: body.targetAudience ?? null,
        whatsappNumber: body.whatsappNumber ?? null,
        telegramChatId: body.telegramChatId ?? null,
        dossierMd: body.dossierMd ?? null,
        instagramHandle: body.instagramHandle ?? 'nikipepperstattoo',
        activePlatforms: body.activePlatforms ?? ['INSTAGRAM', 'FACEBOOK'],
      },
      update: {
        name: body.name,
        website: body.website,
        toneOfVoice: body.toneOfVoice,
        styleDirectives: (body.styleDirectives ?? {}) as any,
        targetAudience: body.targetAudience ?? null,
        whatsappNumber: body.whatsappNumber ?? null,
        telegramChatId: body.telegramChatId ?? null,
        ...(body.dossierMd !== undefined ? { dossierMd: body.dossierMd } : {}),
        ...(body.instagramHandle !== undefined ? { instagramHandle: body.instagramHandle } : {}),
        ...(body.activePlatforms !== undefined ? { activePlatforms: body.activePlatforms } : {}),
      },
    });

    return { brand: toBrandView(brand) };
  });

  // 11. GET /api/marketing/brands/:slug/dossier
  app.get('/brands/:slug/dossier', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const brand = await prisma.brand.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, dossierMd: true },
    });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });
    return { brand };
  });

  // 12. PUT /api/marketing/brands/:slug/dossier
  app.put('/brands/:slug/dossier', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as { dossierMd?: string };
    if (typeof body.dossierMd !== 'string') {
      return reply.code(400).send({ error: 'dossierMd string is required' });
    }
    const updated = await prisma.brand.update({
      where: { slug },
      data: { dossierMd: body.dossierMd },
      select: { id: true, slug: true, name: true, dossierMd: true },
    });
    return { brand: updated };
  });

  // GET /api/marketing/brands/:slug/social-style
  app.get('/brands/:slug/social-style', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const brand = await prisma.brand.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, socialStyleMd: true },
    });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });
    return { brand, socialStyleMd: brand.socialStyleMd };
  });

  // PUT /api/marketing/brands/:slug/social-style
  app.put('/brands/:slug/social-style', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as { socialStyleMd?: string };
    if (typeof body.socialStyleMd !== 'string') {
      return reply.code(400).send({ error: 'socialStyleMd string is required' });
    }
    const updated = await prisma.brand.update({
      where: { slug },
      data: { socialStyleMd: body.socialStyleMd },
    });
    return { brand: toBrandView(updated), socialStyleMd: updated.socialStyleMd };
  });

  // POST /api/marketing/brands/:slug/analyze-style (AI Style Synthesis)
  app.post('/brands/:slug/analyze-style', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = (req.body ?? {}) as { handle?: string; postUrls?: string[]; sampleCaptions?: string };
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const handleToUse = body.handle ? body.handle.replace(/^@/, '').trim() : ((brand as any).instagramHandle || 'nikipepperstattoo');

    // 1. Extract postUrls if provided
    const extractedPosts = [];
    if (Array.isArray(body.postUrls)) {
      for (const u of body.postUrls) {
        if (typeof u === 'string' && u.trim().length > 3) {
          const p = await extractInstagramPostFromEmbed(u);
          if (p) extractedPosts.push(p);
        }
      }
    }

    // 2. Scrape or extract for the handle
    const scraped = await scrapeInstagramProfile(handleToUse, slug);

    // Merge posts avoiding duplicates
    const combined = [...extractedPosts, ...scraped.posts, ...((brand as any).scrapedPosts ?? [])];
    const seen = new Set();
    const uniquePosts = combined.filter((p) => {
      const key = p.id || p.permalink;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 3. AI Synthesizes the Social Media Style Playbook (.md)
    const generatedMd = await synthesizeSocialStylePlaybook({
      brand: {
        name: brand.name,
        website: brand.website,
        toneOfVoice: brand.toneOfVoice,
        dossierMd: brand.dossierMd,
        styleDirectives: (brand.styleDirectives ?? {}) as any,
        targetAudience: brand.targetAudience,
      },
      handle: handleToUse,
      scrapedPosts: uniquePosts,
      sampleCaptions: body.sampleCaptions,
    });

    // 4. Save to Brand
    const updated = await prisma.brand.update({
      where: { slug },
      data: {
        instagramHandle: handleToUse,
        socialStyleMd: generatedMd,
        scrapedPosts: uniquePosts,
      },
    });

    return {
      brand: toBrandView(updated),
      socialStyleMd: generatedMd,
      scraped,
      message: 'Social Media Style Playbook generated and saved for @' + handleToUse,
    };
  });

  // 13. PUT /api/marketing/brands/:slug/platforms
  app.put('/brands/:slug/platforms', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parsed = UpdateBrandPlatformsInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid platforms' });
    }
    const updated = await prisma.brand.update({
      where: { slug },
      data: { activePlatforms: parsed.data.activePlatforms },
    });
    return { brand: toBrandView(updated) };
  });

  // 14. POST /api/marketing/brands/:slug/sync-instagram
  app.post('/brands/:slug/sync-instagram', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = (req.body ?? {}) as { handle?: string };
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const handleToUse = body.handle ? body.handle.replace(/^@/, '').trim() : ((brand as any).instagramHandle || 'nikipepperstattoo');
    const scraped = await scrapeInstagramProfile(handleToUse, slug);

    const handleChanged = body.handle && body.handle.replace(/^@/, '').trim() !== (brand as any).instagramHandle;
    const newPosts = scraped.posts.length > 0 ? scraped.posts : (handleChanged ? [] : ((brand as any).scrapedPosts ?? []));

    const updated = await prisma.brand.update({
      where: { slug },
      data: {
        instagramHandle: scraped.handle,
        scrapedPosts: newPosts as any,
      },
    });

    return {
      brand: toBrandView(updated),
      scraped,
      statusMessage: scraped.statusMessage,
    };
  });

  // 15. POST /api/marketing/brands/:slug/instagram-posts (Add post by URL/link or shortcode)
  app.post('/brands/:slug/instagram-posts', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parsed = AddInstagramPostInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid URL or shortcode' });
    }
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const post = await extractInstagramPostFromEmbed(parsed.data.url, parsed.data.caption);
    if (!post) {
      return reply.code(400).send({ error: 'Could not extract post from provided Instagram URL or shortcode' });
    }

    const currentPosts = ((brand as any).scrapedPosts ?? []) as any[];
    const existingIdx = currentPosts.findIndex((p: any) => p.id === post.id || p.permalink === post.permalink);
    let updatedPosts = [...currentPosts];
    if (existingIdx !== -1) {
      updatedPosts[existingIdx] = post;
    } else {
      updatedPosts = [post, ...currentPosts];
    }

    const updated = await prisma.brand.update({
      where: { slug },
      data: {
        scrapedPosts: updatedPosts as any,
      },
    });

    return {
      brand: toBrandView(updated),
      post,
    };
  });

  // 16. DELETE /api/marketing/brands/:slug/instagram-posts/:postId
  app.delete('/brands/:slug/instagram-posts/:postId', async (req, reply) => {
    const { slug, postId } = req.params as { slug: string; postId: string };
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const currentPosts = ((brand as any).scrapedPosts ?? []) as any[];
    const filtered = currentPosts.filter((p: any) => p.id !== postId);

    const updated = await prisma.brand.update({
      where: { slug },
      data: {
        scrapedPosts: filtered as any,
      },
    });

    return {
      brand: toBrandView(updated),
      deletedPostId: postId,
    };
  });

  // 11. Public approval preview endpoint (no auth required, accessed by client via approvalToken)
  app.get('/drafts/public/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const draft = await prisma.socialDraft.findUnique({
      where: { approvalToken: token },
      include: { brand: true },
    });

    if (!draft) return reply.code(404).send({ error: 'Invalid or expired approval token' });

    return { draft: toDraftView(draft), brand: toBrandView(draft.brand) };
  });

  // 12. Public approval decision endpoint (one click action from WhatsApp link)
  app.all('/drafts/public/:token/action', async (req, reply) => {
    const { token } = req.params as { token: string };
    const query = req.query as { decision?: string };
    const body = (req.body ?? {}) as { decision?: string; feedback?: string };

    const decision = body.decision || query.decision;
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision.toUpperCase())) {
      return reply.code(400).send({ error: 'Valid decision (APPROVED or REJECTED) required' });
    }

    const draft = await prisma.socialDraft.findUnique({
      where: { approvalToken: token },
      include: { brand: true },
    });

    if (!draft) return reply.code(404).send({ error: 'Invalid or expired approval token' });

    const newStatus = decision.toUpperCase() as 'APPROVED' | 'REJECTED';
    const feedback =
      body.feedback || (newStatus === 'APPROVED' ? 'Approved via one-click link' : 'Rejected via one-click link');

    const updated = await prisma.socialDraft.update({
      where: { id: draft.id },
      data: {
        status: newStatus,
        feedback,
      },
      include: { brand: true },
    });

    if (newStatus === 'APPROVED') {
      await attemptAutoPublish(updated.id);
    }

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${newStatus === 'APPROVED' ? 'Draft Approved' : 'Draft Rejected'} | Control Center</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; background: #0b0b0b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { font-size: 24px; margin-bottom: 8px; color: ${newStatus === 'APPROVED' ? '#4ade80' : '#f87171'}; }
            p { color: #a1a1aa; line-height: 1.5; margin: 12px 0; }
            .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin: 12px 0; background: ${newStatus === 'APPROVED' ? '#052e16' : '#450a0a'}; color: ${newStatus === 'APPROVED' ? '#4ade80' : '#f87171'}; border: 1px solid ${newStatus === 'APPROVED' ? '#166534' : '#991b1b'}; }
            .preview { background: #111; padding: 16px; border-radius: 8px; text-align: left; font-size: 14px; color: #e4e4e7; margin: 16px 0; max-height: 150px; overflow-y: auto; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">${newStatus === 'APPROVED' ? 'APPROVED' : 'REJECTED'}</span>
            <h1>Thank you, ${draft.brand.name}</h1>
            <p>The post draft has been marked as <strong>${newStatus === 'APPROVED' ? 'Approved for publishing' : 'Rejected for revision'}</strong>.</p>
            <div class="preview">${draft.caption}</div>
            <p style="font-size: 12px; color: #71717a;">Control Center Marketing Engine - Autonomous AI Marketing Agent</p>
          </div>
        </body>
      </html>
    `);
  });

  // 17. POST /api/marketing/drafts/:id/publish (Direct publish draft to live platforms or sandbox)
  app.post('/drafts/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const draft = await prisma.socialDraft.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!draft) return reply.code(404).send({ error: 'Draft not found' });

    const pubResult = await publishDraftToSocialPlatforms(draft, draft.brand);
    const updated = await prisma.socialDraft.update({
      where: { id: draft.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        metrics: {
          ...((draft.metrics as Record<string, unknown>) ?? {}),
          platformPostId: pubResult.platformPostId,
          live: pubResult.live,
          simulated: pubResult.simulated,
          permalink: pubResult.permalink,
          publishedAt: new Date().toISOString(),
        },
      },
      include: { brand: { select: { name: true, slug: true } } },
    });

    return {
      draft: toDraftView(updated),
      publishResult: pubResult,
    };
  });

  // 18. POST /api/marketing/drafts/publish-pending (Batch publisher for scheduled posts)
  app.post('/drafts/publish-pending', async () => {
    const result = await checkAndPublishScheduledDrafts(prisma);
    return result;
  });

  // 19. PUT /api/marketing/brands/:slug/integrations (Configure API keys and autonomy toggles)
  app.put('/brands/:slug/integrations', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parsed = UpdateBrandIntegrationsInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid integrations payload' });
    }

    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const existingIntegrations = (brand.integrations ?? {}) as Record<string, unknown>;
    const mergedIntegrations = parsed.data.integrations !== undefined
      ? { ...existingIntegrations, ...parsed.data.integrations }
      : existingIntegrations;

    const updated = await prisma.brand.update({
      where: { slug },
      data: {
        integrations: mergedIntegrations as any,
        ...(parsed.data.autoPublish !== undefined ? { autoPublish: parsed.data.autoPublish } : {}),
        ...(parsed.data.autoReplyChat !== undefined ? { autoReplyChat: parsed.data.autoReplyChat } : {}),
      },
    });

    return { brand: toBrandView(updated) };
  });

  // 20. POST /api/marketing/brands/:slug/test-integration (Test channels: Telegram, WhatsApp, Meta)
  app.post('/brands/:slug/test-integration', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = (req.body ?? {}) as { channel: 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'META_ADS' };
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const integrations = (brand.integrations ?? {}) as Record<string, string | undefined>;

    if (body.channel === 'TELEGRAM') {
      const tgToken = integrations.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      const tgChatId = brand.telegramChatId || integrations.telegramOwnerChatId;
      if (!tgToken || !tgChatId) {
        return {
          ok: false,
          channel: 'TELEGRAM',
          message: 'Telegram Bot Token and Owner Chat ID must be configured in Integrations tab.',
        };
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: `[Control Center] Test notification for ${brand.name}. Integrations connection is verified and active.`,
          }),
        });
        const data = (await res.json()) as { ok: boolean; description?: string };
        return {
          ok: data.ok,
          channel: 'TELEGRAM',
          message: data.ok ? 'Telegram ping delivered successfully to owner.' : (data.description || 'Telegram API returned error.'),
        };
      } catch (err: any) {
        return { ok: false, channel: 'TELEGRAM', message: err?.message || 'Failed to reach Telegram API.' };
      }
    }

    if (body.channel === 'WHATSAPP') {
      const phone = brand.whatsappNumber || integrations.whatsappOwnerNumber;
      return {
        ok: true,
        channel: 'WHATSAPP',
        message: `WhatsApp dispatcher ready for target ${phone || 'configured phone'}.`,
      };
    }

    if (body.channel === 'INSTAGRAM' || body.channel === 'META_ADS') {
      const token = integrations.metaAccessToken || integrations.metaPageAccessToken;
      const igId = integrations.instagramAccountId || integrations.metaInstagramAccountId;
      return {
        ok: Boolean(token),
        channel: body.channel,
        message: token
          ? `Meta credentials found for Instagram Account ${igId || 'connected'}. Ready for live posting.`
          : 'Meta Access Token missing in Integrations tab. System is operating in Sandbox mode.',
      };
    }

    return { ok: true, channel: body.channel, message: 'Channel configured.' };
  });

  // 21. GET /api/marketing/brands/:slug/conversations (List recent client DM threads)
  app.get('/brands/:slug/conversations', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    const conversations = await prisma.brandConversation.findMany({
      where: { brandId: brand.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
    });

    return {
      conversations: conversations.map(toConversationView),
    };
  });

  // 22. POST /api/marketing/brands/:slug/conversations/chat (Interactive DM Simulator & AI Responder)
  app.post('/brands/:slug/conversations/chat', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parsed = TestChatMessageInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid message payload' });
    }

    const brand = await prisma.brand.findUnique({ where: { slug } });
    if (!brand) return reply.code(404).send({ error: 'Brand not found' });

    let conversation = null;
    if (parsed.data.conversationId) {
      conversation = await prisma.brandConversation.findUnique({
        where: { id: parsed.data.conversationId },
      });
    }

    if (!conversation) {
      conversation = await prisma.brandConversation.create({
        data: {
          brandId: brand.id,
          platform: 'INSTAGRAM_DM',
          customerHandle: parsed.data.customerName ? `@${parsed.data.customerName.toLowerCase().replace(/\s+/g, '')}` : '@guest_client',
          customerName: parsed.data.customerName || 'Potential Client',
          status: 'ACTIVE',
          messages: [],
        },
      });
    }

    const currentMessages = (conversation.messages ?? []) as any[];
    const nowIso = new Date().toISOString();

    const clientMsg = {
      role: 'customer' as const,
      content: parsed.data.message,
      timestamp: nowIso,
      source: 'web' as const,
    };

    const history = currentMessages.map((m: any) => ({
      sender: m.role === 'customer' ? ('customer' as const) : ('assistant' as const),
      text: m.content,
    }));

    const replyResult = await generateBrandChatReply({
      brand: {
        name: brand.name,
        website: brand.website,
        toneOfVoice: brand.toneOfVoice,
        styleDirectives: (brand.styleDirectives ?? {}) as Record<string, unknown>,
        targetAudience: brand.targetAudience,
        dossierMd: brand.dossierMd ?? undefined,
        socialStyleMd: brand.socialStyleMd ?? undefined,
        instagramHandle: brand.instagramHandle ?? undefined,
      },
      incomingMessage: parsed.data.message,
      customerName: conversation.customerName ?? undefined,
      customerHandle: conversation.customerHandle ?? undefined,
      history,
    });

    const assistantMsg = {
      role: 'assistant' as const,
      content: replyResult.replyText,
      timestamp: new Date().toISOString(),
      source: 'web' as const,
    };

    const updatedMessages = [...currentMessages, clientMsg, assistantMsg];

    const updatedConversation = await prisma.brandConversation.update({
      where: { id: conversation.id },
      data: {
        messages: updatedMessages as any,
        lastMessageAt: new Date(),
      },
    });

    return {
      conversation: toConversationView(updatedConversation),
      reply: replyResult,
    };
  });

  // 23. GET /api/marketing/webhooks/whatsapp (Meta Webhook verification)
  app.get('/webhooks/whatsapp', async (req, reply) => {
    const query = req.query as {
      'hub.mode'?: string;
      'hub.verify_token'?: string;
      'hub.challenge'?: string;
    };
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'control_center_marketing_token';
    if (mode === 'subscribe' && token === expectedToken) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send('Forbidden verification token');
  });

  // 24. POST /api/marketing/webhooks/whatsapp (Incoming WhatsApp message events)
  app.post('/webhooks/whatsapp', async (req, reply) => {
    return reply.code(200).send({ status: 'EVENT_RECEIVED' });
  });

  // 25. POST /api/marketing/webhooks/telegram (Incoming Telegram Bot Webhook)
  app.post('/webhooks/telegram', async (req, reply) => {
    const body = (req.body ?? {}) as any;
    if (body.callback_query?.data) {
      const data = String(body.callback_query.data);
      const [action, token] = data.split(':');
      if (token && (action === 'approve' || action === 'reject')) {
        const draft = await prisma.socialDraft.findUnique({
          where: { approvalToken: token },
          include: { brand: true },
        });
        if (draft) {
          const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
          await prisma.socialDraft.update({
            where: { id: draft.id },
            data: {
              status: newStatus,
              feedback: `Decided via Telegram inline keyboard (${action})`,
            },
          });
          if (newStatus === 'APPROVED') {
            await attemptAutoPublish(draft.id);
          }
        }
      }
    }
    return reply.code(200).send({ ok: true });
  });
};
