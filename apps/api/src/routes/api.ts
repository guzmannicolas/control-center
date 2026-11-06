import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CHECK_STATUSES, DatabaseConfig, ImprovementInput, ImprovementPatch, ModuleId, PRIORITIES, statusRank, worstStatus,
  type ImprovementView, type LearningProgressView,
  type CheckSnapshot, type CheckStatus, type DatabaseView, type DomainDetails, type DomainView, type IncidentView, type MonitorView, type Overview,
  type ResultPoint, type TargetView,
} from '@cc/shared';
import { SESSION_COOKIE, findSessionUser } from '../auth/sessions.js';
import { subdomainsOf } from '../subdomains.js';
import { fetchCloudflareDnsRecords } from '../cloudflare.js';
import { runAgentLoop, type ChatTurnMessage } from '../agent/engine.js';
import {
  GENERAL_CONTEXT,
  listAvailableRepos,
  loadChatSessions,
  upsertChatSession,
  deleteChatSession,
  type StoredChatSession,
} from '../agent/tools.js';
import {
  fetchVercelProjects,
  getBackupsOverview,
  runManualBackup,
  getVpsStatus,
  runVpsCleanup,
} from '../ops.js';
import {
  scrapeGoogleMapsPlaces,
  enrichLeadSocials,
  guessSuggestedDemo,
} from '../leads/scraper.js';
import type { PrismaClient } from '../generated/prisma/client.js';

const asMetrics = (value: unknown) => (value ?? {}) as Record<string, number>;

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string } | null;
  }
}

type ImprovementRow = {
  id: string; title: string; details: string; area: string; priority: ImprovementView['priority'];
  status: ImprovementView['status']; createdAt: Date; doneAt: Date | null;
};
const improvementView = (i: ImprovementRow): ImprovementView => ({
  id: i.id, title: i.title, details: i.details, area: i.area as ImprovementView['area'], priority: i.priority,
  status: i.status, createdAt: i.createdAt.toISOString(), doneAt: i.doneAt?.toISOString() ?? null,
});
const IdParam = z.object({ id: z.uuid() });

export const apiRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
  // Every route in this plugin requires a logged-in user, and knows who it is.
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (req, reply) => {
    const user = await findSessionUser(prisma, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    req.user = user;
  });

  app.get('/overview', async (): Promise<Overview> => {
    const targets = await prisma.target.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
      include: {
        monitors: {
          where: { enabled: true },
          orderBy: { checker: 'asc' },
          include: {
            results: { take: 1, orderBy: { checkedAt: 'desc' }, select: { message: true, metrics: true } },
            _count: { select: { incidents: { where: { resolvedAt: null } } } },
          },
        },
      },
    });

    const views: TargetView[] = targets.map((t) => {
      const monitors: MonitorView[] = t.monitors.map((m) => ({
        id: m.id,
        checker: m.checker,
        intervalSeconds: m.intervalSeconds,
        status: m.lastStatus,
        lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
        message: m.results[0]?.message ?? null,
        metrics: asMetrics(m.results[0]?.metrics),
        openIncident: m._count.incidents > 0,
      }));
      const known = monitors.flatMap((m) => (m.status ? [m.status] : []));
      const config = t.config as { url?: string };
      return {
        id: t.id, name: t.name, type: t.type, tags: t.tags,
        url: config.url ?? null,
        status: known.length ? worstStatus(known) : null,
        monitors,
      };
    });
    views.sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.name.localeCompare(b.name));

    const counts = Object.fromEntries([...CHECK_STATUSES, 'unknown'].map((s) => [s, 0])) as Overview['counts'];
    for (const t of views) counts[t.status ?? 'unknown']++;
    return { generatedAt: new Date().toISOString(), counts, targets: views };
  });

  app.get('/domains', async (): Promise<DomainView[]> => {
    const [targets, cloudflareDnsMap] = await Promise.all([
      prisma.target.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
      include: {
        monitors: {
          where: { enabled: true },
          include: { results: { take: 1, orderBy: { checkedAt: 'desc' }, select: { message: true, metrics: true, details: true } } },
        },
      },
    }),
      fetchCloudflareDnsRecords(process.env.CLOUDFLARE_API_TOKEN),
    ]);
    const hostOf = (config: unknown) => {
      const url = (config as { url?: string }).url;
      return url ? new URL(url).hostname : null;
    };
    const sites = targets.flatMap((t) => {
      const host = hostOf(t.config);
      if (!host) return [];
      const known = t.monitors.flatMap((m) => (m.lastStatus ? [m.lastStatus] : []));
      return [{ id: t.id, name: t.name, url: (t.config as { url: string }).url, host, status: known.length ? worstStatus(known) : null }];
    });

    const domains = targets.filter((t) => t.type === 'domain').map((t): DomainView => {
      const name = (t.config as { domain: string }).domain;
      const m = t.monitors.find((x) => x.checker === 'domain-expiry');
      const last = m?.results[0];
      const details = last?.details as DomainDetails | undefined;
      return {
        id: t.id,
        name,
        status: m?.lastStatus ?? null,
        message: last?.message ?? null,
        checkedAt: m?.lastCheckedAt?.toISOString() ?? null,
        daysLeft: asMetrics(last?.metrics).daysLeft ?? null,
        details: details && 'expiresOn' in details ? details : null,
        sites: sites
          .filter((x) => x.host === name)
          .map(({ host: _host, ...site }) => site),
        subdomains: subdomainsOf(name, sites, cloudflareDnsMap.get(name) ?? []),
      };
    });
    // Soonest renewal first: that is what needs attention.
    return domains.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
  });

  app.get('/databases', async (): Promise<DatabaseView[]> => {
    const targets = await prisma.target.findMany({
      where: { enabled: true, type: 'database' },
      orderBy: { name: 'asc' },
      include: {
        monitors: {
          where: { enabled: true },
          include: { results: { take: 1, orderBy: { checkedAt: 'desc' }, select: { message: true, metrics: true, details: true } } },
        },
      },
    });
    const views = targets.flatMap((t): DatabaseView[] => {
      const config = DatabaseConfig.safeParse(t.config);
      if (!config.success) return [];
      const snapshot = (checker: string): CheckSnapshot | null => {
        const m = t.monitors.find((x) => x.checker === checker);
        if (!m) return null;
        const last = m.results[0];
        return {
          status: m.lastStatus,
          message: last?.message ?? null,
          checkedAt: m.lastCheckedAt?.toISOString() ?? null,
          metrics: asMetrics(last?.metrics),
          details: (last?.details ?? {}) as Record<string, unknown>,
        };
      };
      const known = t.monitors.flatMap((m) => (m.lastStatus ? [m.lastStatus] : []));
      return [{
        id: t.id,
        name: t.name,
        engine: config.data.engine,
        purpose: config.data.purpose,
        project: config.data.project ?? null,
        status: known.length ? worstStatus(known) : null,
        health: snapshot(config.data.engine === 'postgres' ? 'postgres-health' : 'redis-health'),
        backup: snapshot('backup-age'),
      }];
    });
    // Whatever needs attention first.
    return views.sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.name.localeCompare(b.name));
  });

  // --- Agent Execution Harness ---------------------------------------------------------------------
  app.get('/agent/repos', async () => {
    const repos = await listAvailableRepos();
    return { repos };
  });

  app.get('/agent/sessions', async () => {
    return { sessions: loadChatSessions() };
  });

  app.put('/agent/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<StoredChatSession>;
    const session: StoredChatSession = {
      id,
      title: body.title?.slice(0, 120) || 'Conversación',
      repo: body.repo || GENERAL_CONTEXT,
      model: body.model || 'auto',
      updatedAt: new Date().toISOString(),
      messages: Array.isArray(body.messages) ? body.messages : [],
    };
    return { sessions: upsertChatSession(session) };
  });

  app.delete('/agent/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { sessions: deleteChatSession(id) };
  });

  app.post('/agent/run', async (req, reply) => {
    const body = req.body as {
      repo?: string;
      instruction?: string;
      apiKey?: string;
      provider?: 'gemini' | 'openrouter';
      model?: string;
      history?: ChatTurnMessage[];
    };
    const repo = body.repo?.trim() || GENERAL_CONTEXT;
    const instruction = body.instruction?.trim() || '';

    if (!instruction) {
      return reply.code(400).send({ error: 'Instruction is required' });
    }

    const provider = body.provider || 'gemini';
    const serverApiKey = provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY
      : process.env.GEMINI_API_KEY;

    const apiKey = (body.apiKey && body.apiKey.trim().length > 0)
      ? body.apiKey.trim()
      : serverApiKey;

    if (!apiKey) {
      return reply.code(400).send({
        error: `No hay una API Key configurada para '${provider}'. Por favor ingresá tu API Key en los ajustes o definila en las variables de entorno.`,
      });
    }

    // Inform Fastify that we take manual control of writing the raw response,
    // which prevents Fastify hooks (e.g. onSend) from running and crashing the stream.
    reply.hijack();

    const origin = req.headers.origin || 'https://control.nicoguzmandev.com';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    try {
      const history = Array.isArray(body.history) ? body.history : [];
      for await (const event of runAgentLoop({
        repo,
        instruction,
        apiKey,
        provider,
        modelName: body.model || 'auto',
        priorHistory: history,
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  // --- Improvements: a shared backlog ----------------------------------------------------------------
  const order = (i: ImprovementView) =>
    [['in_progress', 'planned', 'idea', 'done'].indexOf(i.status), PRIORITIES.indexOf(i.priority)] as const;

  app.get('/improvements', async (): Promise<ImprovementView[]> => {
    const rows = await prisma.improvement.findMany({ orderBy: { createdAt: 'desc' } });
    // Work in progress first, then planned, ideas, done; high priority first within each.
    return rows.map(improvementView).sort((a, b) => {
      const [sa, pa] = order(a);
      const [sb, pb] = order(b);
      return sa - sb || pa - pb;
    });
  });

  app.post('/improvements', async (req, reply) => {
    const body = ImprovementInput.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Invalid improvement' });
    const row = await prisma.improvement.create({
      data: { ...body.data, doneAt: body.data.status === 'done' ? new Date() : null },
    });
    return reply.code(201).send(improvementView(row));
  });

  app.patch('/improvements/:id', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const body = ImprovementPatch.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Invalid change' });
    const current = await prisma.improvement.findUnique({ where: { id: params.data.id } });
    if (!current) return reply.code(404).send({ error: 'Not found' });
    // Remember when something was finished; forget it if it is reopened.
    const status = body.data.status ?? current.status;
    const doneAt = status === 'done' ? (current.doneAt ?? new Date()) : null;
    const row = await prisma.improvement.update({ where: { id: current.id }, data: { ...body.data, doneAt } });
    return improvementView(row);
  });

  app.delete('/improvements/:id', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'Invalid id' });
    const { count } = await prisma.improvement.deleteMany({ where: { id: params.data.id } });
    return count ? reply.code(204).send() : reply.code(404).send({ error: 'Not found' });
  });

  // --- Learning: which modules this user has passed ----------------------------------------------------
  app.get('/learning/progress', async (req): Promise<LearningProgressView[]> => {
    const rows = await prisma.learningProgress.findMany({ where: { userId: req.user!.id }, orderBy: { completedAt: 'asc' } });
    return rows.map((r) => ({ moduleId: r.moduleId, score: r.score, completedAt: r.completedAt.toISOString() }));
  });

  const Score = z.object({ score: z.number().int().min(0).max(100) });
  app.put('/learning/progress/:moduleId', async (req, reply) => {
    const moduleId = ModuleId.safeParse((req.params as { moduleId?: string }).moduleId);
    const body = Score.safeParse(req.body);
    if (!moduleId.success || !body.success) return reply.code(400).send({ error: 'Invalid progress' });
    const key = { userId: req.user!.id, moduleId: moduleId.data };
    const row = await prisma.learningProgress.upsert({
      where: { userId_moduleId: key },
      create: { ...key, score: body.data.score },
      update: { score: body.data.score, completedAt: new Date() },
    });
    return { moduleId: row.moduleId, score: row.score, completedAt: row.completedAt.toISOString() };
  });

  app.delete('/learning/progress/:moduleId', async (req, reply) => {
    const moduleId = ModuleId.safeParse((req.params as { moduleId?: string }).moduleId);
    if (!moduleId.success) return reply.code(400).send({ error: 'Invalid module' });
    await prisma.learningProgress.deleteMany({ where: { userId: req.user!.id, moduleId: moduleId.data } });
    return reply.code(204).send();
  });

  const IncidentsQuery = z.object({
    open: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });
  app.get('/incidents', async (req, reply): Promise<IncidentView[] | void> => {
    const q = IncidentsQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Invalid query' });
    const rows = await prisma.incident.findMany({
      where: q.data.open === 'true' ? { resolvedAt: null } : {},
      orderBy: { openedAt: 'desc' },
      take: q.data.limit,
      include: { monitor: { select: { checker: true, target: { select: { name: true } } } } },
    });
    return rows.map((i) => ({
      id: i.id, monitorId: i.monitorId, targetName: i.monitor.target.name, checker: i.monitor.checker,
      severity: i.severity, openedAt: i.openedAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null,
      lastMessage: i.lastMessage,
    }));
  });

  const ResultsParams = z.object({ id: z.uuid() });
  const ResultsQuery = z.object({ hours: z.coerce.number().int().min(1).max(720).default(24) });
  app.get('/monitors/:id/results', async (req, reply): Promise<ResultPoint[] | void> => {
    const params = ResultsParams.safeParse(req.params);
    const query = ResultsQuery.safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'Invalid request' });
    const rows = await prisma.result.findMany({
      where: { monitorId: params.data.id, checkedAt: { gte: new Date(Date.now() - query.data.hours * 3_600_000) } },
      // Newest 5000, then back into time order: a long range keeps its most recent part.
      orderBy: { checkedAt: 'desc' },
      take: 5000,
      select: { checkedAt: true, status: true, durationMs: true, message: true, metrics: true },
    });
    return rows.reverse().map((r) => ({
      checkedAt: r.checkedAt.toISOString(), status: r.status as CheckStatus, durationMs: r.durationMs,
      message: r.message, metrics: asMetrics(r.metrics),
    }));
  });

  // --- Vercel Projects -----------------------------------------------------------------------------
  app.get('/vercel/projects', async (req) => {
    const q = req.query as { refresh?: string };
    const result = await fetchVercelProjects(q.refresh === '1' || q.refresh === 'true');
    return {
      ...result,
      fetchedAt: new Date().toISOString(),
    };
  });

  // --- Backups -------------------------------------------------------------------------------------
  app.get('/backups', async () => {
    return getBackupsOverview();
  });

  app.post('/backups/run', async () => {
    return runManualBackup();
  });

  // --- VPS Health & Cleanup ------------------------------------------------------------------------
  app.get('/vps/status', async () => {
    return getVpsStatus();
  });

  const CleanupBody = z.object({
    target: z.enum(['docker', 'vscode', 'caches', 'all']),
  });
  app.post('/vps/cleanup', async (req, reply) => {
    const parsed = CleanupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid cleanup target' });
    return runVpsCleanup(parsed.data.target);
  });

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
          suggestedDemo: demo,
          status: 'discovered',
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

  app.patch('/leads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      status: 'discovered' | 'enriched' | 'contacted' | 'replied' | 'converted' | 'discarded';
      notes: string;
      email: string;
      phone: string;
    }>;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...body,
        contactedAt: body.status === 'contacted' ? new Date() : undefined,
      },
    });

    return { lead: updated };
  });

  app.delete('/leads/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.lead.delete({ where: { id } });
    return { ok: true };
  });
};
