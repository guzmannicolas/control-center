import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  scrapeGoogleMapsPlaces,
  enrichLeadSocials,
  guessSuggestedDemo,
} from '../leads/scraper.js';
import { verifyInstagramProfile } from '../leads/instagram.js';
import { generatePersonalizedPitch } from '../leads/pitch.js';
import { createOutreachQueue, type OutreachJobData } from '../leads/outreach-queue.js';
import {
  initWhatsAppClient,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  setPrismaForWhatsApp,
} from '../leads/whatsapp.js';
import { createRedis } from '../infra.js';
import type { PrismaClient } from '../generated/prisma/client.js';

const escapeCsv = (val: unknown) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

export const leadsRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
  const outreachRedis = createRedis(process.env.REDIS_URL || 'redis://redis:6379');
  const outreachQueue = createOutreachQueue(outreachRedis);
  setPrismaForWhatsApp(prisma);
  void initWhatsAppClient();

  // --- Leads / B2B Sales Prospecting ---------------------------------------------------------------
  app.get('/leads', async (req) => {
    const q = req.query as {
      status?: string;
      category?: string;
      city?: string;
      hasWebsite?: string;
      search?: string;
    };

    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = { contains: q.category, mode: 'insensitive' };
    if (q.city) where.city = { contains: q.city, mode: 'insensitive' };
    if (q.hasWebsite !== undefined) where.hasWebsite = q.hasWebsite === 'true';
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      leads: leads.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        contactedAt: l.contactedAt?.toISOString() ?? null,
      })),
    };
  });

  const ScrapeInput = z.object({
    category: z.string().trim().min(2),
    city: z.string().trim().min(2),
    limit: z.coerce.number().min(1).max(50).default(15),
  });

  app.post('/leads/scrape', async (req, reply) => {
    const parsed = ScrapeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Category and city are required' });

    const { category, city, limit } = parsed.data;
    const places = await scrapeGoogleMapsPlaces(category, city, limit);

    const saved = [];
    for (const p of places) {
      let leadInstagram = p.instagram ?? null;
      let leadFacebook = p.facebook ?? null;
      let leadEmail: string | null = null;

      // Automatically search socials/Instagram if not directly extracted from Google Maps
      if (!leadInstagram) {
        try {
          const social = await enrichLeadSocials(p.name, city);
          if (social.instagram) leadInstagram = social.instagram;
          if (social.facebook && !leadFacebook) leadFacebook = social.facebook;
          if (social.email) leadEmail = social.email;
        } catch {
          // ignore enrichment error during scraping
        }
      }

      const demo = guessSuggestedDemo(p.category, category);
      const lead = await prisma.lead.create({
        data: {
          name: p.name,
          query: `${category} en ${city}`,
          category,
          city,
          address: p.address,
          rating: p.rating,
          reviewsCount: p.reviewsCount,
          phone: p.phone,
          phoneFormatted: p.phoneFormatted,
          website: p.website,
          hasWebsite: p.hasWebsite,
          instagram: leadInstagram,
          facebook: leadFacebook,
          email: leadEmail,
          suggestedDemo: demo,
          status: leadInstagram || leadEmail || p.phone ? 'enriched' : 'discovered',
          metadata: {
            sourceUrl: p.sourceUrl,
          },
        },
      });
      saved.push(lead);
    }

    return { count: saved.length, leads: saved };
  });

  app.post('/leads/:id/enrich', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const enriched = await enrichLeadSocials(lead.name, lead.city);
    const updated = await prisma.lead.update({
      where: { id },
      data: {
        email: enriched.email ?? lead.email,
        instagram: enriched.instagram ?? lead.instagram,
        facebook: enriched.facebook ?? lead.facebook,
        status: enriched.email || lead.phone ? 'enriched' : lead.status,
      },
    });

    return { lead: updated };
  });

  app.post('/leads/:id/verify-instagram', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });
    if (!lead.instagram) return reply.code(400).send({ error: 'Lead has no Instagram URL' });

    const result = await verifyInstagramProfile(lead.instagram);
    const existingMeta = (lead.metadata as Record<string, unknown>) ?? {};
    const normalizedUrl = result.username ? `https://www.instagram.com/${result.username}/` : lead.instagram;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        instagram: normalizedUrl,
        metadata: {
          ...existingMeta,
          instagramVerified: result.valid,
          instagramStatusCode: result.statusCode,
          instagramCheckedAt: new Date().toISOString(),
          instagramReason: result.reason ?? null,
        },
      },
    });

    return { lead: updated, verification: result };
  });

  app.post('/leads/verify-all-instagram', async () => {
    const leads = await prisma.lead.findMany({
      where: {
        instagram: { not: null },
      },
    });

    let verifiedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < leads.length; i += 3) {
      const batch = leads.slice(i, i + 3);
      await Promise.all(
        batch.map(async (lead) => {
          if (!lead.instagram) return;
          try {
            const res = await verifyInstagramProfile(lead.instagram);
            const existingMeta = (lead.metadata as Record<string, unknown>) ?? {};
            const normalizedUrl = res.username ? `https://www.instagram.com/${res.username}/` : lead.instagram;

            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                instagram: normalizedUrl,
                metadata: {
                  ...existingMeta,
                  instagramVerified: res.valid,
                  instagramStatusCode: res.statusCode,
                  instagramCheckedAt: new Date().toISOString(),
                  instagramReason: res.reason ?? null,
                },
              },
            });

            if (res.valid) verifiedCount++;
            else failedCount++;
          } catch {
            failedCount++;
          }
        })
      );
    }

    return { total: leads.length, verifiedCount, failedCount };
  });

  app.patch('/leads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      status: 'discovered' | 'enriched' | 'contacted' | 'replied' | 'converted' | 'discarded';
      notes: string;
      email: string;
      phone: string;
      metadata: Record<string, unknown>;
      contactedAt?: string;
    }>;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Lead not found' });

    const mergedMetadata = body.metadata
      ? { ...((existing.metadata as Record<string, unknown>) ?? {}), ...body.metadata }
      : existing.metadata;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.status === 'contacted' ? { contactedAt: new Date() } : {}),
        ...(body.contactedAt !== undefined ? { contactedAt: new Date(body.contactedAt) } : {}),
        metadata: mergedMetadata as any,
      },
    });

    return { lead: updated };
  });

  app.get('/leads/export/csv', async (_req, reply) => {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'ID',
      'Name',
      'Category',
      'City',
      'Address',
      'Rating',
      'Reviews Count',
      'Phone',
      'Email',
      'Website',
      'Instagram',
      'Status',
      'Contacted At',
      'Follow Ups Count',
      'Notes',
      'Suggested Demo',
      'Created At',
    ].join(',');

    const rows = leads.map((l) =>
      [
        escapeCsv(l.id),
        escapeCsv(l.name),
        escapeCsv(l.category),
        escapeCsv(l.city),
        escapeCsv(l.address),
        escapeCsv(l.rating),
        escapeCsv(l.reviewsCount),
        escapeCsv(l.phoneFormatted || l.phone),
        escapeCsv(l.email),
        escapeCsv(l.website),
        escapeCsv(l.instagram),
        escapeCsv(l.status),
        escapeCsv(l.contactedAt ? l.contactedAt.toISOString() : ''),
        escapeCsv((l.metadata as any)?.followUpCount || 0),
        escapeCsv(l.notes),
        escapeCsv(l.suggestedDemo),
        escapeCsv(l.createdAt.toISOString()),
      ].join(',')
    );

    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="control-center-leads-export.csv"')
      .send(csvContent);
  });

  const BatchDeleteInput = z.object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
    status: z.string().optional(),
  });

  app.post('/leads/batch-delete', async (req, reply) => {
    const parsed = BatchDeleteInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid batch delete parameters' });

    const { ids, all, status } = parsed.data;
    const where: Record<string, unknown> = {};

    if (all) {
      if (status) where.status = status;
    } else if (ids && ids.length > 0) {
      where.id = { in: ids };
    } else {
      return reply.code(400).send({ error: 'No target leads specified for deletion' });
    }

    const res = await prisma.lead.deleteMany({ where });
    return { ok: true, count: res.count };
  });

  const BatchUpdateInput = z.object({
    ids: z.array(z.string()).min(1),
    status: z.enum(['discovered', 'enriched', 'contacted', 'replied', 'converted', 'discarded']),
  });

  app.post('/leads/batch-update', async (req, reply) => {
    const parsed = BatchUpdateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid batch update parameters' });

    const { ids, status } = parsed.data;
    const res = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        contactedAt: status === 'contacted' ? new Date() : undefined,
      },
    });
    return { ok: true, count: res.count };
  });

  app.delete('/leads/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.lead.delete({ where: { id } });
    return { ok: true };
  });

  // --- Automated Outreach & AI Pitch Engine ---

  app.post('/leads/:id/generate-pitch', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'Lead not found' });

    const body = (req.body ?? {}) as { isFollowUp?: boolean; apiKey?: string };
    const result = await generatePersonalizedPitch(
      {
        name: lead.name,
        category: lead.category,
        city: lead.city,
        rating: lead.rating,
        reviewsCount: lead.reviewsCount,
        suggestedDemo: lead.suggestedDemo,
        address: lead.address,
      },
      Boolean(body.isFollowUp),
      body.apiKey
    );

    return { ...result, leadId: lead.id };
  });

  app.get('/leads/outreach/status', async () => {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      outreachQueue.getWaitingCount(),
      outreachQueue.getActiveCount(),
      outreachQueue.getCompletedCount(),
      outreachQueue.getFailedCount(),
      outreachQueue.getDelayedCount(),
      outreachQueue.isPaused(),
    ]);

    return {
      status: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        isPaused,
      },
    };
  });

  const QueueOutreachInput = z.object({
    leadIds: z.array(z.string()).min(1),
    customPitch: z.string().optional(),
    isFollowUp: z.boolean().optional(),
  });

  app.post('/leads/outreach/queue', async (req, reply) => {
    const parsed = QueueOutreachInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid queue parameters' });

    const { leadIds, customPitch, isFollowUp } = parsed.data;
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        phoneFormatted: { not: null },
      },
    });

    if (leads.length === 0) {
      return reply.code(400).send({ error: 'None of the selected leads have a valid phone number' });
    }

    const queuedJobs = [];
    for (const l of leads) {
      const jobData: OutreachJobData = {
        leadId: l.id,
        phone: l.phoneFormatted ?? l.phone ?? '',
        name: l.name,
        category: l.category,
        city: l.city,
        suggestedDemo: l.suggestedDemo,
        customPitch,
        isFollowUp,
      };

      const job = await outreachQueue.add(`outreach-${l.id}`, jobData);
      queuedJobs.push({ jobId: job.id, leadId: l.id, name: l.name });
    }

    return { ok: true, queuedCount: queuedJobs.length, jobs: queuedJobs };
  });

  app.post('/leads/outreach/pause', async () => {
    await outreachQueue.pause();
    return { ok: true, isPaused: true };
  });

  app.post('/leads/outreach/resume', async () => {
    await outreachQueue.resume();
    return { ok: true, isPaused: false };
  });

  // --- WhatsApp Headless Gateway Routes ---

  app.get('/whatsapp/status', async () => {
    return { status: getWhatsAppStatus() };
  });

  app.post('/whatsapp/connect', async () => {
    const status = await initWhatsAppClient();
    return { status };
  });

  app.post('/whatsapp/disconnect', async () => {
    await disconnectWhatsApp();
    return { status: getWhatsAppStatus() };
  });

  app.post('/whatsapp/send-test', async (req, reply) => {
    const body = (req.body ?? {}) as { phone: string; message: string };
    if (!body.phone || !body.message) {
      return reply.code(400).send({ error: 'phone and message are required' });
    }
    const result = await sendWhatsAppMessage(body.phone, body.message);
    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }
    return { ok: true };
  });
};
