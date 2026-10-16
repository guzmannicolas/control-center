import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { PrismaClient } from './generated/prisma/client.js';

const env = loadEnv();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

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
