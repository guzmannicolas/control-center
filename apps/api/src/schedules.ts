import type { Queue } from 'bullmq';
import type { PrismaClient } from './generated/prisma/client.js';

export const QUEUE = 'checks';
export const RUN_MONITOR = 'run-monitor';
export interface RunMonitorJob {
  monitorId: string;
}

// The database says what should run; BullMQ (in Redis) holds the timers. This keeps them in step.
// Unchanged schedulers are left alone: re-creating one would restart its clock, and a 24 h check would never fire.
export async function syncSchedules(prisma: PrismaClient, queue: Queue<RunMonitorJob>) {
  const monitors = await prisma.monitor.findMany({
    where: { enabled: true, target: { enabled: true } },
    select: { id: true, intervalSeconds: true },
  });
  const existing = new Map((await queue.getJobSchedulers()).map((s) => [s.key, s.every]));
  const wanted = new Set(monitors.map((m) => m.id));
  const summary = { added: 0, changed: 0, removed: 0 };

  for (const m of monitors) {
    const every = m.intervalSeconds * 1000;
    if (existing.get(m.id) === every) continue;
    summary[existing.has(m.id) ? 'changed' : 'added']++;
    await queue.upsertJobScheduler(m.id, { every }, {
      name: RUN_MONITOR,
      data: { monitorId: m.id },
      opts: { removeOnComplete: 100, removeOnFail: 500 },
    });
  }
  for (const key of existing.keys()) {
    if (wanted.has(key)) continue;
    await queue.removeJobScheduler(key);
    summary.removed++;
  }
  return summary;
}
