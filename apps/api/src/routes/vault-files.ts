import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  DirectoryListing,
  FileContent,
  VaultOverview,
  VaultItem,
  VaultProjectConfig,
  VaultAuditSummary,
  VaultDiffResult,
  DiscoveredEnvFile,
} from '@cc/shared';
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

export const vaultFilesRoutes: FastifyPluginAsync = async (app) => {
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

  app.get('/vault/export', async (req) => {
    const query = req.query as { project?: string };
    const project = query.project || 'global';
    const envText = exportEnvText(project);
    return { project, envText };
  });
};
