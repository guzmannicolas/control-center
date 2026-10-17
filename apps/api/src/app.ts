import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Redis } from 'ioredis';
import { authRoutes } from './auth/routes.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { withTimeout } from './lib/timeout.js';
import { apiRoutes } from './routes/api.js';

export interface AppDeps {
  prisma: PrismaClient;
  probes: { database: () => Promise<unknown>; redis: () => Promise<unknown> };
  dashboardOrigin: string; // the only site allowed to call this API from a browser
  cookieSecure: boolean;
  rateLimitRedis?: Redis; // shared counters; in-memory when absent (tests)
  healthTimeoutMs?: number;
}

export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  // CORS: browsers may call this API only from the dashboard, with its cookie.
  app.register(cors, { origin: deps.dashboardOrigin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  app.register(cookie);
  app.register(rateLimit, { global: false, redis: deps.rateLimitRedis, nameSpace: 'cc-rate-limit:' });

  // CSRF: a request that changes something must come from the dashboard's own origin.
  // Browsers always send Origin on these, and another site cannot fake it.
  app.addHook('onRequest', async (req, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    if (req.headers.origin !== deps.dashboardOrigin) return reply.code(403).send({ error: 'Forbidden origin' });
  });

  // Private data must never be stored by a proxy or CDN along the way (the dashboard reaches us through Vercel).
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/auth/')) reply.header('cache-control', 'no-store');
  });

  // A health check that hangs is worse than one that fails: callers cannot tell slow from dead.
  app.get('/health', async (_req, reply) => {
    const ms = deps.healthTimeoutMs ?? 2000;
    const [database, redis] = await Promise.allSettled([
      withTimeout(deps.probes.database(), ms),
      withTimeout(deps.probes.redis(), ms),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'ok' : 'fail',
      redis: redis.status === 'fulfilled' ? 'ok' : 'fail',
    } as const;
    const healthy = Object.values(checks).every((s) => s === 'ok');
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'fail', checks });
  });

  app.register(authRoutes, { prisma: deps.prisma, cookieSecure: deps.cookieSecure });
  app.register(apiRoutes, { prefix: '/api', prisma: deps.prisma });

  return app;
}
