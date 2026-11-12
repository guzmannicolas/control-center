import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { CloudflareOverview, CloudflareDnsItem } from '@cc/shared';
import {
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

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const infraRoutes: FastifyPluginAsync = async (app) => {
  // --- Deployments & CI/CD Routes -----------------------------------------------------------------

  app.post('/webhooks/deploy/:repo', async (req, reply) => {
    const { repo } = req.params as { repo: string };
    if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
      return reply.code(400).send({ error: 'Invalid repository name' });
    }

    if ((req.query as Record<string, string>)?.secret) {
      return reply.code(400).send({ error: 'Passing secret in query string is not allowed; use x-deploy-secret or x-hub-signature-256 header' });
    }

    const expectedSecret = process.env.DEPLOY_SECRET;
    if (!expectedSecret) {
      return reply.code(503).send({ error: 'DEPLOY_SECRET is not configured on the server' });
    }

    const headerSecret = typeof req.headers['x-deploy-secret'] === 'string' ? req.headers['x-deploy-secret'] : '';
    const githubSig = typeof req.headers['x-hub-signature-256'] === 'string' ? req.headers['x-hub-signature-256'] : '';
    const rawPayload = JSON.stringify(req.body ?? {});
    const expectedHmac = `sha256=${createHmac('sha256', expectedSecret).update(rawPayload).digest('hex')}`;

    const validHeader = headerSecret ? constantTimeEquals(headerSecret, expectedSecret) : false;
    const validHmac = githubSig ? constantTimeEquals(githubSig, expectedHmac) : false;

    if (!validHeader && !validHmac) {
      return reply.code(401).send({ error: 'Invalid webhook secret or signature' });
    }

    const body = (req.body ?? {}) as {
      ref?: string;
      head_commit?: { id?: string; message?: string; author?: { name?: string } };
    };
    const branch = body.ref ? body.ref.replace('refs/heads/', '') : 'main';
    if (!/^[a-zA-Z0-9._/-]+$/.test(branch) || branch.includes('..') || branch.startsWith('-')) {
      return reply.code(400).send({ error: 'Invalid branch name' });
    }
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
};
