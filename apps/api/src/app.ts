import Fastify, { type FastifyServerOptions } from 'fastify';

// The app receives what it depends on instead of importing it, so tests can pass fakes.
export interface Deps {
  pingDatabase: () => Promise<unknown>;
  pingRedis: () => Promise<unknown>;
}

// A health check that hangs is worse than one that fails: callers cannot tell slow from dead.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function buildApp(deps: Deps, options: FastifyServerOptions = {}, healthTimeoutMs = 2000) {
  const app = Fastify(options);

  app.get('/health', async (_req, reply) => {
    const [database, redis] = await Promise.allSettled([
      withTimeout(deps.pingDatabase(), healthTimeoutMs),
      withTimeout(deps.pingRedis(), healthTimeoutMs),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'ok' : 'fail',
      redis: redis.status === 'fulfilled' ? 'ok' : 'fail',
    } as const;
    const healthy = Object.values(checks).every((s) => s === 'ok');
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'fail', checks });
  });

  return app;
}
