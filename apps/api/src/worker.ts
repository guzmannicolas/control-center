import { Queue, Worker } from 'bullmq';
import { pino } from 'pino';
import { loadEnv } from './env.js';
import { createPrisma, createRedis } from './infra.js';
import { runMonitor } from './runner.js';
import { QUEUE, syncSchedules, type RunMonitorJob } from './schedules.js';
import { createOutreachWorker } from './leads/outreach-queue.js';

const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL });
const prisma = createPrisma(env.DATABASE_URL);
const queue = new Queue<RunMonitorJob>(QUEUE, { connection: createRedis(env.REDIS_URL) });
const CONCURRENCY = 5;

const worker = new Worker<RunMonitorJob>(
  QUEUE,
  async (job) => {
    const run = await runMonitor(prisma, job.data.monitorId);
    if (!run) return;
    const line = { target: run.target, checker: run.checker, status: run.outcome.status, ms: run.durationMs };
    if (run.incident.kind === 'open') log.warn(line, `incident opened: ${run.outcome.message}`);
    else if (run.incident.kind === 'resolve') log.info(line, `incident resolved: ${run.outcome.message}`);
    else log.info(line, run.outcome.message);
  },
  // A worker needs its own Redis connection: it blocks while waiting for jobs.
  { connection: createRedis(env.REDIS_URL), concurrency: CONCURRENCY },
);
worker.on('failed', (job, err) => log.error({ jobId: job?.id, err }, 'job failed'));

// Background sales outreach queue worker (spaced 60-120s per contact)
const outreachRedis = createRedis(env.REDIS_URL);
const outreachWorker = createOutreachWorker(outreachRedis, prisma, log);

// New, changed or removed monitors are picked up within a minute, without restarting.
async function sync() {
  try {
    const summary = await syncSchedules(prisma, queue);
    if (summary.added + summary.changed + summary.removed > 0) log.info(summary, 'schedules synced');
  } catch (err) {
    log.error({ err }, 'schedule sync failed');
  }
}
await sync();
const timer = setInterval(sync, 60_000);
log.info({ concurrency: CONCURRENCY }, 'worker started');

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    log.info({ signal }, 'shutting down');
    clearInterval(timer);
    await worker.close(); // lets running checks finish
    await outreachWorker.close();
    await queue.close();
    await outreachRedis.quit();
    await prisma.$disconnect();
    process.exit(0);
  });
}
