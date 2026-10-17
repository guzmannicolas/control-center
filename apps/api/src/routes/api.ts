import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CHECK_STATUSES, DatabaseConfig, ImprovementInput, ImprovementPatch, ModuleId, PRIORITIES, statusRank, worstStatus,
  type ImprovementView, type LearningProgressView,
  type CheckSnapshot, type CheckStatus, type DatabaseView, type DomainDetails, type DomainView, type IncidentView, type MonitorView, type Overview,
  type ResultPoint, type TargetView,
} from '@cc/shared';
import { SESSION_COOKIE, findSessionUser } from '../auth/sessions.js';
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
    const targets = await prisma.target.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
      include: {
        monitors: {
          where: { enabled: true },
          include: { results: { take: 1, orderBy: { checkedAt: 'desc' }, select: { message: true, metrics: true, details: true } } },
        },
      },
    });
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
          .filter((x) => x.host === name || x.host.endsWith(`.${name}`))
          .map(({ host: _host, ...site }) => site),
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
        status: known.length ? worstStatus(known) : null,
        health: snapshot(config.data.engine === 'postgres' ? 'postgres-health' : 'redis-health'),
        backup: snapshot('backup-age'),
      }];
    });
    // Whatever needs attention first.
    return views.sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.name.localeCompare(b.name));
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
};
