import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  GenerateDraftInput,
  UpdateDraftStatusInput,
  DispatchApprovalInput,
  UpdateAdCampaignInput,
  type MarketingOverview,
  type SocialDraftView,
  type AdCampaignView,
  type BrandView,
} from '@cc/shared';
import { generateSocialCreative, auditAdCampaigns } from './agent.js';
import { dispatchDraftApproval } from './dispatch.ts';
import { ensureMarketingSeed } from './seed-helper.js';

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

    return { draft: toDraftView(updated) };
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
        error: `GUARDRAIL VIOLATION: El presupuesto diario solicitado ($${dailyBudget}) excede el límite máximo de seguridad ($${effectiveGuardrail}). La IA tiene prohibido sobrepasar este techo sin reconfiguración explícita del guardrail.`,
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
        styleDirectives: body.styleDirectives ?? {},
        targetAudience: body.targetAudience ?? null,
        whatsappNumber: body.whatsappNumber ?? null,
        telegramChatId: body.telegramChatId ?? null,
      },
      update: {
        name: body.name,
        website: body.website,
        toneOfVoice: body.toneOfVoice,
        styleDirectives: body.styleDirectives ?? {},
        targetAudience: body.targetAudience ?? null,
        whatsappNumber: body.whatsappNumber ?? null,
        telegramChatId: body.telegramChatId ?? null,
      },
    });

    return { brand: toBrandView(brand) };
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
    const feedback = body.feedback || (newStatus === 'APPROVED' ? 'Aprobado vía enlace rápido' : 'Rechazado vía enlace rápido');

    const updated = await prisma.socialDraft.update({
      where: { id: draft.id },
      data: {
        status: newStatus,
        feedback,
      },
      include: { brand: true },
    });

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${newStatus === 'APPROVED' ? 'Borrador Aprobado' : 'Borrador Rechazado'} | Control Center</title>
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
            <span class="badge">${newStatus === 'APPROVED' ? '✓ APROBADO' : '✗ RECHAZADO'}</span>
            <h1>¡Gracias, ${draft.brand.name}!</h1>
            <p>La publicación ha sido marcada como <strong>${newStatus === 'APPROVED' ? 'Aprobada para publicación' : 'Rechazada para revisión'}</strong>.</p>
            <div class="preview">${draft.caption}</div>
            <p style="font-size: 12px; color: #71717a;">Control Center Marketing Engine · Gestión autónoma asistida por IA</p>
          </div>
        </body>
      </html>
    `);
  });
};
