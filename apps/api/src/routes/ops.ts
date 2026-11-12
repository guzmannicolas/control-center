import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
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
import type { PrismaClient } from '../generated/prisma/client.js';

export const opsRoutes: FastifyPluginAsync<{ prisma: PrismaClient }> = async (app, { prisma }) => {
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
};
