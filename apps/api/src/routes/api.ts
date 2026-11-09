import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  listKnowledgeDocs,
  readKnowledgeDoc,
  writeKnowledgeDoc,
  getSystemContext,
} from '../knowledge/manager.js';
import { handleMcpRequest, type McpJsonRpcRequest } from '../knowledge/mcp.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CHECK_STATUSES, DatabaseConfig, ImprovementInput, ImprovementPatch, ModuleId, PRIORITIES, statusRank, worstStatus,
  type ImprovementView, type LearningProgressView,
  type CheckSnapshot, type CheckStatus, type DatabaseView, type DomainDetails, type DomainView, type IncidentView, type MonitorView, type Overview, type OverviewTelemetry,
  type ResultPoint, type TargetView, type CloudflareOverview, type CloudflareDnsItem,
  type DirectoryListing, type FileContent, type VaultOverview, type VaultItem,
  type VaultProjectConfig, type VaultAuditSummary, type VaultDiffResult, type DiscoveredEnvFile,
  type PromotionsOverview,
  type PriceGlitchOverview,
  type PriceGlitchItem,
} from '@cc/shared';
import {
  getPromotionsOverview,
  scrapeLiveArgentinePromotions,
  calculateBestSavings,
  getPriceGlitches,
  verifyPriceGlitch,
  verifyPromotionUrl,
} from '../promociones/engine.js';
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  createEntry,
  deleteEntry,
} from '../files/manager.js';
import {
  getVaultOverview,
  upsertVaultItem,
  deleteVaultItem,
  importEnvText,
  exportEnvText,
  upsertProjectConfig,
} from '../vault/vault.js';
import {
  runSecurityAudit,
  computeVaultDiff,
  deployVaultToDisk,
  discoverVpsEnvFiles,
  importEnvFromDiskFile,
} from '../vault/audit.js';
import { SESSION_COOKIE, findSessionUser } from '../auth/sessions.js';
import { subdomainsOf } from '../subdomains.js';
import {
  fetchCloudflareDnsRecords,
  getCloudflareZones,
  getZoneDnsRecords,
  createCloudflareDnsRecord,
  deleteCloudflareDnsRecord,
  purgeCloudflareCache,
  getCloudflareSecurityLevel,
  setCloudflareSecurityLevel,
} from '../cloudflare.js';
import {
  getDeploymentOverview,
  getDeploymentById,
  runDeployment,
} from '../deploy/engine.js';
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
  getBackupConfig,
  saveBackupConfig,
  runManualBackup,
  deleteBackupFiles,
  inspectBackupArchive,
  verifyBackupArchive,
  getBackupDownloadStream,
  getVpsStatus,
  runVpsCleanup,
  getVpsSecurityAudit,
  type BackupConfig,
  type DiscoveredDatabaseTarget,
} from '../ops.js';
import {
  scrapeGoogleMapsPlaces,
  enrichLeadSocials,
  guessSuggestedDemo,
} from '../leads/scraper.js';
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
import { marketingRoutes } from '../marketing/routes.js';
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
  const outreachRedis = createRedis(process.env.REDIS_URL || 'redis://redis:6379');
  const outreachQueue = createOutreachQueue(outreachRedis);
  setPrismaForWhatsApp(prisma);
  void initWhatsAppClient();
  // Every route in this plugin requires a logged-in user, and knows who it is.
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (req, reply) => {
    if (
      req.url.startsWith('/api/webhooks/') ||
      req.url.startsWith('/api/agent/context') ||
      req.url.startsWith('/api/mcp') ||
      req.url.startsWith('/api/marketing/drafts/public/') ||
      req.url.startsWith('/api/marketing/webhooks/')
    )
      return;
    const user = await findSessionUser(prisma, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    req.user = user;
  });

  app.register(marketingRoutes, { prefix: '/marketing', prisma });

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
    // Telemetry calculations
    const [leadsCounts, vpsData] = await Promise.all([
      (async () => {
        try {
          const [total, uncontacted, withoutWebsite, converted] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.count({ where: { status: 'discovered' } }),
            prisma.lead.count({ where: { hasWebsite: false } }),
            prisma.lead.count({ where: { status: 'converted' } }),
          ]);
          return { total, uncontacted, withoutWebsite, converted };
        } catch {
          return { total: 0, uncontacted: 0, withoutWebsite: 0, converted: 0 };
        }
      })(),
      (async () => {
        try {
          return await getVpsStatus();
        } catch {
          return null;
        }
      })(),
    ]);

    let vaultStats = { itemsCount: 0, projectsCount: 0 };
    try {
      const v = getVaultOverview();
      vaultStats = { itemsCount: v.items.length, projectsCount: v.projects.length };
    } catch {}

    let knowledgeStats = { docsCount: 0, skillsCount: 0, mcpOnline: true };
    try {
      const kDocs = listKnowledgeDocs();
      knowledgeStats = {
        docsCount: kDocs.length,
        skillsCount: kDocs.filter((d) => d.category === 'skills').length,
        mcpOnline: true,
      };
    } catch {}

    let backupsStats = {
      lastSnapshotTime: null as string | null,
      localBackupsCount: 0,
      cloudSyncProvider: 'Google Drive (AES-256 gcrypt:daily)',
    };
    try {
      if (existsSync('/home/adminnico/cms/backups')) {
        const bFiles = readdirSync('/home/adminnico/cms/backups').filter(
          (f) => f.endsWith('.tar') || f.endsWith('.tar.gz')
        );
        backupsStats.localBackupsCount = bFiles.length;
        if (bFiles.length > 0) {
          const lastFile = bFiles[bFiles.length - 1];
        if (lastFile) {
          const stats = statSync(join('/home/adminnico/cms/backups', lastFile));
          backupsStats.lastSnapshotTime = stats.mtime.toISOString();
        }
        }
      }
    } catch {}

    const telemetry: OverviewTelemetry = {
      leads: leadsCounts,
      vault: vaultStats,
      knowledge: knowledgeStats,
      backups: backupsStats,
      vps: {
        hostname: vpsData?.hostname ?? 'ContaboVPS',
        uptimeHuman: vpsData?.uptimeHuman ?? 'Up',
        ramUsedPercent: vpsData?.memory.usedPercent ?? 0,
        ramTotalGb: vpsData?.memory.totalGb ?? 0,
        ramUsedGb: vpsData?.memory.usedGb ?? 0,
        diskUsedPercent: vpsData?.disk.usedPercent ?? 0,
        diskTotalGb: vpsData?.disk.totalGb ?? 0,
        diskUsedGb: vpsData?.disk.usedGb ?? 0,
      },
    };

    return { generatedAt: new Date().toISOString(), counts, targets: views, telemetry };
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
    const targets = await prisma.target.findMany({
      where: { enabled: true, type: 'database' },
      orderBy: { name: 'asc' },
    });
    const cfg = getBackupConfig();

    const databases: DiscoveredDatabaseTarget[] = targets.map((t) => {
      const cfgObj = (t.config ?? {}) as Record<string, unknown>;
      const isCms = t.name.toLowerCase().includes('cms') || cfgObj.project === 'CMS';
      const isControl = t.name.toLowerCase().includes('control') || cfgObj.project === 'Control Center';
      const key = isCms ? 'cms_postgres' : isControl ? 'control_center_postgres' : t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const isIncluded =
        key === 'cms_postgres'
          ? cfg.targets.cms_postgres
          : key === 'control_center_postgres'
            ? cfg.targets.control_center_postgres
            : false;

      return {
        id: t.id,
        name: t.name,
        engine: String(cfgObj.engine ?? 'postgres'),
        purpose: String(cfgObj.purpose ?? ''),
        project: cfgObj.project ? String(cfgObj.project) : null,
        key,
        isIncluded,
        status: 'healthy',
      };
    });

    return getBackupsOverview(databases);
  });

  app.post('/backups/config', async (req, reply) => {
    const body = req.body as Partial<BackupConfig>;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'Valid configuration object required' });
    }
    const updated = saveBackupConfig(body);
    return { ok: true, config: updated };
  });

  const RunBackupBody = z.object({
    targets: z
      .object({
        cms_postgres: z.boolean().optional(),
        control_center_postgres: z.boolean().optional(),
        cms_uploads: z.boolean().optional(),
        secrets: z.boolean().optional(),
      })
      .optional(),
    cloudSync: z.boolean().optional(),
  });

  app.post('/backups/run', async (req) => {
    const parsed = RunBackupBody.safeParse(req.body ?? {});
    return runManualBackup(parsed.success ? parsed.data : undefined);
  });

  app.get('/backups/inspect/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const result = await inspectBackupArchive(filename);
    if (!result.ok) {
      return reply.code(400).send({ error: result.error ?? 'Failed to inspect backup file' });
    }
    return result;
  });

  app.post('/backups/verify/:filename', async (req) => {
    const { filename } = req.params as { filename: string };
    return verifyBackupArchive(filename);
  });

  app.get('/backups/download/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    try {
      const { stream, sizeBytes, cleanName } = getBackupDownloadStream(filename);
      reply.header('Content-Type', 'application/x-tar');
      reply.header('Content-Disposition', `attachment; filename="${cleanName}"`);
      reply.header('Content-Length', String(sizeBytes));
      return reply.send(stream);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(404).send({ error: msg });
    }
  });

  const DeleteBackupsBody = z.object({
    names: z.array(z.string().trim().min(1)).min(1),
  });

  app.post('/backups/delete', async (req, reply) => {
    const parsed = DeleteBackupsBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Valid file names array required' });
    return deleteBackupFiles(parsed.data.names);
  });

  // --- VPS Health & Cleanup ------------------------------------------------------------------------
  app.get('/vps/status', async () => {
    return getVpsStatus();
  });

  app.get('/vps/security', async () => {
    return getVpsSecurityAudit();
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

  app.get('/leads/export/csv', async (req, reply) => {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

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

  // --- Deployments & CI/CD Routes -----------------------------------------------------------------

  app.post('/webhooks/deploy/:repo', async (req, reply) => {
    const { repo } = req.params as { repo: string };
    const secretParam = (req.query as Record<string, string>)?.secret || (req.headers['x-deploy-secret'] as string | undefined);
    const expectedSecret = process.env.DEPLOY_SECRET;
    if (expectedSecret && secretParam !== expectedSecret) {
      return reply.code(401).send({ error: 'Invalid webhook secret' });
    }

    const body = (req.body ?? {}) as {
      ref?: string;
      head_commit?: { id?: string; message?: string; author?: { name?: string } };
    };
    const branch = body.ref ? body.ref.replace('refs/heads/', '') : 'main';
    const commitHash = body.head_commit?.id ? body.head_commit.id.slice(0, 7) : null;
    const commitMessage = body.head_commit?.message ?? null;
    const author = body.head_commit?.author?.name ?? 'GitHub Webhook';

    const deployment = await runDeployment({
      repo,
      branch,
      trigger: 'webhook',
      commitHash,
      commitMessage,
      author,
    });

    return { ok: true, deployment };
  });

  app.get('/deployments', async (req) => {
    const host = req.headers.host || '127.0.0.1:4100';
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
    const origin = `${proto}://${host}`;
    return getDeploymentOverview(origin);
  });

  app.get('/deployments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const deployment = getDeploymentById(id);
    if (!deployment) return reply.code(404).send({ error: 'Deployment not found' });
    return deployment;
  });

  app.post('/deployments/trigger', async (req, reply) => {
    const TriggerInput = z.object({
      repo: z.string().min(1),
      branch: z.string().default('main'),
    });
    const parsed = TriggerInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid deployment input' });

    const deployment = await runDeployment({
      repo: parsed.data.repo,
      branch: parsed.data.branch,
      trigger: 'manual',
      author: req.user?.email || 'Manual Dashboard Trigger',
    });

    return { ok: true, deployment };
  });

  // --- Cloudflare Operations Routes ---------------------------------------------------------------

  app.get('/cloudflare/overview', async (req): Promise<CloudflareOverview> => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
      return {
        configured: false,
        zones: [],
        activeZoneId: null,
        dnsRecords: [],
        securityLevel: 'medium',
      };
    }

    const zones = await getCloudflareZones(apiToken);
    const query = req.query as { zoneId?: string };
    const activeZone = zones.find((z) => z.id === query.zoneId) || zones[0];
    const activeZoneId = activeZone ? activeZone.id : null;

    let dnsRecords: CloudflareDnsItem[] = [];
    let securityLevel = 'medium';

    if (activeZoneId) {
      [dnsRecords, securityLevel] = await Promise.all([
        getZoneDnsRecords(apiToken, activeZoneId),
        getCloudflareSecurityLevel(apiToken, activeZoneId),
      ]);
    }

    return {
      configured: true,
      zones,
      activeZoneId,
      dnsRecords,
      securityLevel,
    };
  });

  app.post('/cloudflare/purge-cache', async (req, reply) => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const PurgeInput = z.object({
      zoneId: z.string().min(1),
      purgeEverything: z.boolean().default(true),
      files: z.array(z.string()).optional(),
    });
    const parsed = PurgeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid purge parameters' });

    const res = await purgeCloudflareCache(
      apiToken,
      parsed.data.zoneId,
      parsed.data.purgeEverything,
      parsed.data.files
    );
    if (!res.success) return reply.code(500).send({ error: res.error });
    return { ok: true };
  });

  app.post('/cloudflare/dns', async (req, reply) => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const DnsCreateInput = z.object({
      zoneId: z.string().min(1),
      type: z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'MX']),
      name: z.string().min(1),
      content: z.string().min(1),
      proxied: z.boolean().default(false),
      ttl: z.number().default(1),
      comment: z.string().optional(),
    });
    const parsed = DnsCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid DNS record input' });

    const res = await createCloudflareDnsRecord(apiToken, parsed.data.zoneId, parsed.data);
    if (!res.success) return reply.code(500).send({ error: res.error });
    return { ok: true, record: res.record };
  });

  app.delete('/cloudflare/dns/:recordId', async (req, reply) => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const { recordId } = req.params as { recordId: string };
    const query = req.query as { zoneId?: string };
    if (!query.zoneId) return reply.code(400).send({ error: 'zoneId query param required' });

    const res = await deleteCloudflareDnsRecord(apiToken, query.zoneId, recordId);
    if (!res.success) return reply.code(500).send({ error: res.error });
    return { ok: true };
  });

  app.patch('/cloudflare/security-level', async (req, reply) => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const SecInput = z.object({
      zoneId: z.string().min(1),
      level: z.enum(['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack']),
    });
    const parsed = SecInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid security level input' });

    const res = await setCloudflareSecurityLevel(apiToken, parsed.data.zoneId, parsed.data.level);
    if (!res.success) return reply.code(500).send({ error: res.error });
    return { ok: true };
  });

  // --- VPS File Manager --------------------------------------------------------------------------

  app.get('/files/list', async (req, reply): Promise<DirectoryListing | void> => {
    try {
      const query = req.query as { path?: string };
      const listing = await listDirectory(query.path || '');
      return listing;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to list directory' });
    }
  });

  app.get('/files/read', async (req, reply): Promise<FileContent | void> => {
    try {
      const query = req.query as { path?: string };
      if (!query.path) return reply.code(400).send({ error: 'path parameter required' });
      const content = await readFileContent(query.path);
      return content;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to read file' });
    }
  });

  app.post('/files/write', async (req, reply) => {
    const FileWriteInput = z.object({
      path: z.string().min(1),
      content: z.string(),
    });
    const parsed = FileWriteInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid file write payload' });

    try {
      const res = await writeFileContent(parsed.data.path, parsed.data.content);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to write file' });
    }
  });

  app.post('/files/create', async (req, reply) => {
    const CreateInput = z.object({
      path: z.string().default(''),
      name: z.string().min(1),
      type: z.enum(['file', 'directory']),
    });
    const parsed = CreateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid create payload' });

    try {
      const res = await createEntry(parsed.data.path, parsed.data.name, parsed.data.type);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to create entry' });
    }
  });

  app.delete('/files/delete', async (req, reply) => {
    const DeleteInput = z.object({
      path: z.string().min(1),
    });
    const parsed = DeleteInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid delete payload' });

    try {
      const res = await deleteEntry(parsed.data.path);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to delete entry' });
    }
  });

  // --- Env Vault & Secrets Manager ---------------------------------------------------------------

  app.get('/vault', async (): Promise<VaultOverview> => {
    try {
      const auditSummary = await runSecurityAudit();
      return getVaultOverview(auditSummary);
    } catch {
      return getVaultOverview();
    }
  });

  app.post('/vault/audit', async (): Promise<VaultAuditSummary> => {
    return runSecurityAudit();
  });

  app.post('/vault/project-config', async (req, reply): Promise<VaultProjectConfig | void> => {
    const ProjectConfigInput = z.object({
      projectName: z.string().min(1),
      filePath: z.string().min(1),
      dockerService: z.string().optional(),
      environment: z.enum(['production', 'staging', 'development']).default('production'),
      criticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
      lastSyncedAt: z.string().nullable().default(null),
    });
    const parsed = ProjectConfigInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid project config payload' });

    const updated = upsertProjectConfig(parsed.data);
    return updated;
  });

  app.get('/vault/diff', async (req, reply): Promise<VaultDiffResult | void> => {
    const query = req.query as { project?: string };
    if (!query.project) return reply.code(400).send({ error: 'project parameter is required' });
    try {
      const diff = await computeVaultDiff(query.project);
      return diff;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to compute diff' });
    }
  });

  app.post('/vault/deploy', async (req, reply) => {
    const DeployInput = z.object({
      project: z.string().min(1),
    });
    const parsed = DeployInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid deploy payload' });

    try {
      const res = await deployVaultToDisk(parsed.data.project);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to deploy secrets to disk' });
    }
  });

  app.get('/vault/discover', async (req): Promise<DiscoveredEnvFile[]> => {
    const query = req.query as { path?: string };
    return discoverVpsEnvFiles(query.path);
  });

  app.post('/vault/import-file', async (req, reply) => {
    const ImportFileInput = z.object({
      filePath: z.string().min(1),
      project: z.string().optional(),
    });
    const parsed = ImportFileInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });

    try {
      const res = importEnvFromDiskFile(parsed.data.filePath, parsed.data.project);
      return res;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to import file' });
    }
  });

  app.post('/vault', async (req, reply): Promise<VaultItem | void> => {
    const VaultInput = z.object({
      id: z.string().optional(),
      key: z.string().min(1),
      value: z.string(),
      project: z.string().default('global'),
      description: z.string().optional(),
      isSecret: z.boolean().default(true),
    });
    const parsed = VaultInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid vault item payload' });

    const item = upsertVaultItem(parsed.data);
    return item;
  });

  app.delete('/vault/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const success = deleteVaultItem(id);
    if (!success) return reply.code(404).send({ error: 'Item not found in vault' });
    return { ok: true };
  });

  app.post('/vault/import', async (req, reply) => {
    const ImportInput = z.object({
      project: z.string().min(1),
      envText: z.string(),
    });
    const parsed = ImportInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid import payload' });

    const res = importEnvText(parsed.data.project, parsed.data.envText);
    return res;
  });

  app.get('/vault/export', async (req, reply) => {
    const query = req.query as { project?: string };
    const project = query.project || 'global';
    const envText = exportEnvText(project);
    return { project, envText };
  });

  // Knowledge Base & Agent Context routes
  app.get('/knowledge', async () => {
    return listKnowledgeDocs();
  });

  app.get('/knowledge/*', async (req, reply) => {
    const slug = (req.params as Record<string, string>)['*'];
    if (!slug) {
      return reply.code(400).send({ error: 'Missing document slug' });
    }
    try {
      const doc = readKnowledgeDoc(slug);
      const query = req.query as { raw?: string; format?: string };
      if (query.raw === 'true' || req.headers.accept === 'text/plain' || req.headers.accept === 'text/markdown') {
        reply.header('content-type', 'text/markdown; charset=utf-8');
        return reply.send(doc.content);
      }
      return doc;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(404).send({ error: msg });
    }
  });

  app.put('/knowledge/*', async (req, reply) => {
    const slug = (req.params as Record<string, string>)['*'];
    if (!slug) {
      return reply.code(400).send({ error: 'Missing document slug' });
    }

    let content: string | undefined;
    if (typeof req.body === 'string') {
      content = req.body;
    } else if (req.body && typeof req.body === 'object' && 'content' in req.body) {
      content = String((req.body as { content: unknown }).content);
    }

    if (content === undefined) {
      return reply.code(400).send({ error: 'Document content is required' });
    }

    try {
      const meta = writeKnowledgeDoc(slug, content);
      return { ok: true, meta };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get('/agent/context', async (req, reply) => {
    const query = req.query as { topic?: string; format?: string };
    const topics = query.topic || 'all';
    const markdownContext = getSystemContext(topics);

    if (query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return { topic: topics, context: markdownContext };
    }

    reply.header('content-type', 'text/markdown; charset=utf-8');
    return reply.send(markdownContext);
  });

  app.post('/mcp', async (req, reply) => {
    try {
      const body = req.body as McpJsonRpcRequest;
      const response = handleMcpRequest(body);
      return response;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: msg },
      });
    }
  });

  // --- Promociones de Argentina (Scraping & Deals) --------------------------------------------------

  app.get('/promociones', async (req): Promise<PromotionsOverview> => {
    const query = req.query as { refresh?: string };
    const forceFresh = query.refresh === 'true' || query.refresh === '1';
    return getPromotionsOverview(forceFresh);
  });

  app.post('/promociones/scrape', async (): Promise<PromotionsOverview> => {
    // Triggers a live fresh scraping pass across Argentine sources
    return getPromotionsOverview(true);
  });

  app.post('/promociones/calculate', async (req) => {
    const body = (req.body ?? {}) as { amount: number; category?: any; dayIndex?: number };
    const results = calculateBestSavings(Number(body.amount) || 0, body.category, body.dayIndex);
    return { results };
  });

  app.get('/promociones/glitches', async (req): Promise<PriceGlitchOverview> => {
    const query = req.query as { refresh?: string };
    const forceFresh = query.refresh === 'true' || query.refresh === '1';
    return getPriceGlitches(forceFresh);
  });

  app.post('/promociones/glitches/refresh', async (): Promise<PriceGlitchOverview> => {
    return getPriceGlitches(true);
  });

  app.post('/promociones/:id/verify-url', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await verifyPromotionUrl(id);
    if (!item) return reply.code(404).send({ error: 'Promotion item not found' });
    return item;
  });

  app.post('/promociones/glitches/:id/verify', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await verifyPriceGlitch(id);
    if (!item) return reply.code(404).send({ error: 'Price glitch item not found' });
    return item;
  });

};
