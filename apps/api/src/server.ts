import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { createPrisma, createRedis } from './infra.js';

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);

const app = buildApp(
  {
    pingDatabase: () => prisma.$queryRaw`SELECT 1`,
    pingRedis: () => redis.ping(),
  },
  { logger: { level: env.LOG_LEVEL } },
);

// Docker sends SIGTERM on stop: finish in-flight requests and close connections cleanly.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
