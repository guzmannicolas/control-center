import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { QueueMetricsView, QueueJobView } from '@cc/shared';

const KNOWN_QUEUES = [
  'leads-outreach',
  'marketing-publisher',
  'system-tasks',
];

export async function inspectQueues(redis: Redis): Promise<QueueMetricsView[]> {
  const results: QueueMetricsView[] = [];

  for (const name of KNOWN_QUEUES) {
    try {
      const q = new Queue(name, { connection: redis });
      const [counts, isPaused, failedRaw] = await Promise.all([
        q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        q.isPaused().catch(() => false),
        q.getFailed(0, 5).catch(() => []),
      ]);

      const failedJobs: QueueJobView[] = failedRaw.map((j) => ({
        id: j.id ?? 'unknown',
        name: j.name,
        data: j.data,
        failedReason: j.failedReason,
        timestamp: j.timestamp,
        attemptsMade: j.attemptsMade,
      }));

      results.push({
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: isPaused,
        failedJobs,
      });

      await q.close().catch(() => {});
    } catch {
      // If queue is not active or empty, output zeroes
      results.push({
        name,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        failedJobs: [],
      });
    }
  }

  return results;
}

export async function retryFailedJobs(redis: Redis, queueName: string): Promise<{ retried: number }> {
  const q = new Queue(queueName, { connection: redis });
  try {
    const failed = await q.getFailed(0, 50);
    let retried = 0;
    for (const job of failed) {
      await job.retry();
      retried++;
    }
    return { retried };
  } finally {
    await q.close().catch(() => {});
  }
}
