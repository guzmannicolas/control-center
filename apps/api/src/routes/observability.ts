import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { Redis } from 'ioredis';
import { apm } from '../observability/apm.js';
import { inspectQueues, retryFailedJobs } from '../observability/queues.js';
import type {
  ObservabilityOverview,
  LlmTraceView,
  LlmTelemetrySummary,
} from '@cc/shared';

export interface ObservabilityRoutesOptions {
  prisma: PrismaClient;
  redis?: Redis;
}

export const observabilityRoutes: FastifyPluginAsync<ObservabilityRoutesOptions> = async (
  app,
  opts
) => {
  const { prisma, redis } = opts;

  // --- Overview ------------------------------------------------------------------------------------
  app.get('/observability/overview', async (): Promise<ObservabilityOverview> => {
    // 1. LLM aggregated stats
    const [totalCalls, aggregates, byModelRaw, recentTracesRaw] = await Promise.all([
      prisma.llmTrace.count(),
      prisma.llmTrace.aggregate({
        _sum: {
          totalTokens: true,
          costUsd: true,
          durationMs: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.llmTrace.groupBy({
        by: ['model'],
        _count: { id: true },
        _sum: { totalTokens: true, costUsd: true },
      }),
      prisma.llmTrace.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const errorCalls = await prisma.llmTrace.count({
      where: { status: 'error' },
    });

    const sumTokens = aggregates._sum.totalTokens ?? 0;
    const sumCost = aggregates._sum.costUsd ?? 0;
    const sumDuration = aggregates._sum.durationMs ?? 0;
    const avgDuration = totalCalls > 0 ? Math.round(sumDuration / totalCalls) : 0;
    const errorRate = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 1000) / 10 : 0;

    const byModel = byModelRaw.map((b) => ({
      model: b.model,
      calls: b._count.id,
      tokens: b._sum.totalTokens ?? 0,
      costUsd: Math.round((b._sum.costUsd ?? 0) * 10_000) / 10_000,
    }));

    const llmSummary: LlmTelemetrySummary = {
      totalCalls,
      totalTokens: sumTokens,
      totalCostUsd: Math.round(sumCost * 10_000) / 10_000,
      avgDurationMs: avgDuration,
      errorRatePercent: errorRate,
      byModel,
    };

    // 2. APM metrics
    const apiMetrics = apm.getMetrics();

    // 3. Queue metrics
    let queues: import('@cc/shared').QueueMetricsView[] = [];
    if (redis) {
      queues = await inspectQueues(redis);
    }

    // 4. Format recent traces
    const recentTraces: LlmTraceView[] = recentTracesRaw.map((t) => ({
      id: t.id,
      provider: t.provider,
      model: t.model,
      caller: t.caller,
      promptTokens: t.promptTokens,
      completionTokens: t.completionTokens,
      totalTokens: t.totalTokens,
      costUsd: t.costUsd,
      durationMs: t.durationMs,
      status: t.status as 'ok' | 'error' | 'fallback',
      errorMessage: t.errorMessage,
      promptPreview: t.promptPreview,
      responsePreview: t.responsePreview,
      metadata: (t.metadata as Record<string, unknown>) ?? {},
      createdAt: t.createdAt.toISOString(),
    }));

    return {
      llm: llmSummary,
      api: apiMetrics,
      queues,
      recentTraces,
    };
  });

  // --- Traces List ---------------------------------------------------------------------------------
  app.get('/observability/traces', async (req) => {
    const q = req.query as { limit?: string; model?: string; status?: string };
    const take = Math.min(100, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const where: any = {};
    if (q.model) where.model = q.model;
    if (q.status) where.status = q.status;

    const traces = await prisma.llmTrace.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return traces.map((t) => ({
      id: t.id,
      provider: t.provider,
      model: t.model,
      caller: t.caller,
      promptTokens: t.promptTokens,
      completionTokens: t.completionTokens,
      totalTokens: t.totalTokens,
      costUsd: t.costUsd,
      durationMs: t.durationMs,
      status: t.status,
      errorMessage: t.errorMessage,
      promptPreview: t.promptPreview,
      responsePreview: t.responsePreview,
      metadata: t.metadata,
      createdAt: t.createdAt.toISOString(),
    }));
  });

  // --- APM Breakdown -------------------------------------------------------------------------------
  app.get('/observability/apm', async () => {
    return apm.getMetrics();
  });

  // --- Queues Status -------------------------------------------------------------------------------
  app.get('/observability/queues', async () => {
    if (!redis) return [];
    return inspectQueues(redis);
  });

  // --- Retry Failed Queue Jobs ---------------------------------------------------------------------
  app.post('/observability/queues/:name/retry', async (req, reply) => {
    if (!redis) return reply.code(400).send({ error: 'Redis connection not available' });
    const { name } = req.params as { name: string };
    const res = await retryFailedJobs(redis, name);
    return res;
  });
};
