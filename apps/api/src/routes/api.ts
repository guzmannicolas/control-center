import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { SESSION_COOKIE, findSessionUser } from '../auth/sessions.js';
import { marketingRoutes } from '../marketing/routes.js';
import { monitoringRoutes } from './monitoring.js';
import { agentRoutes } from './agents.js';
import { opsRoutes } from './ops.js';
import { leadsRoutes } from './leads.js';
import { infraRoutes } from './infra.js';
import { vaultFilesRoutes } from './vault-files.js';
import { knowledgeRoutes } from './knowledge.js';
import { promocionesRoutes } from './promociones.js';
import { observabilityRoutes } from './observability.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string } | null;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function hasValidMcpToken(headers: Record<string, string | string[] | undefined>): boolean {
  const expected = process.env.MCP_API_TOKEN;
  if (!expected) return false;
  const authHeader = typeof headers.authorization === 'string' ? headers.authorization : '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const mcpHeader = typeof headers['x-mcp-token'] === 'string' ? headers['x-mcp-token'].trim() : '';
  const candidate = bearer || mcpHeader;
  if (!candidate) return false;
  return constantTimeEquals(candidate, expected);
}

export const apiRoutes: FastifyPluginAsync<{ prisma: PrismaClient; redis?: Redis }> = async (
  app,
  { prisma, redis }
) => {
  // Every route in this plugin requires a logged-in user, and knows who it is.
  app.decorateRequest('user', null);
  app.addHook('preHandler', async (req, reply) => {
    const pathname = req.url.split('?')[0] ?? '';
    if (
      pathname.startsWith('/api/webhooks/') ||
      pathname.startsWith('/api/marketing/drafts/public/') ||
      pathname.startsWith('/api/marketing/webhooks/')
    )
      return;

    if (pathname === '/api/agent/context' || pathname === '/api/mcp') {
      if (hasValidMcpToken(req.headers)) return;
      const user = await findSessionUser(prisma, req.cookies[SESSION_COOKIE]);
      if (user) {
        req.user = user;
        return;
      }
      return reply.code(401).send({ error: 'Not logged in or missing valid MCP_API_TOKEN' });
    }

    const user = await findSessionUser(prisma, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'Not logged in' });
    req.user = user;
  });

  app.register(marketingRoutes, { prefix: '/marketing', prisma });
  app.register(monitoringRoutes, { prisma });
  app.register(agentRoutes, { prisma });
  app.register(opsRoutes, { prisma });
  app.register(leadsRoutes, { prisma });
  app.register(infraRoutes);
  app.register(vaultFilesRoutes);
  app.register(knowledgeRoutes);
  app.register(promocionesRoutes);
  app.register(observabilityRoutes, { prisma, redis });
};
