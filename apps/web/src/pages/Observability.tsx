import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import type { LlmTraceView, QueueMetricsView } from '@cc/shared';
import { PageHeader } from '../components/PageHeader.tsx';
import { ObservabilityIcon, RefreshIcon, AlertTriangleIcon } from '../components/Icons.tsx';

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatCurrency(usd: number): string {
  if (usd < 0.0001 && usd > 0) return '< $0.0001';
  return `$${usd.toFixed(4)}`;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  return `${diffDays}d ago`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'ok':
      return { bg: '#052e16', border: '#166534', color: '#4ade80', label: 'OK' };
    case 'fallback':
      return { bg: '#422006', border: '#854d0e', color: '#facc15', label: 'FALLBACK' };
    case 'error':
      return { bg: '#450a0a', border: '#991b1b', color: '#f87171', label: 'ERROR' };
    default:
      return { bg: '#1e293b', border: '#334155', color: '#94a3b8', label: status.toUpperCase() };
  }
}

export function ObservabilityPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'llm' | 'apm' | 'queues'>('llm');
  const [selectedTrace, setSelectedTrace] = useState<LlmTraceView | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error' | 'fallback'>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['observability', 'overview'],
    queryFn: api.observabilityOverview,
    refetchInterval: 15_000,
  });

  const tracesQuery = useQuery({
    queryKey: ['observability', 'traces', modelFilter, statusFilter],
    queryFn: () =>
      api.observabilityTraces({
        model: modelFilter !== 'all' ? modelFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      }),
    refetchInterval: 15_000,
    enabled: activeTab === 'llm',
  });

  const retryMutation = useMutation({
    mutationFn: (queueName: string) => api.observabilityRetryQueue(queueName),
    onSuccess: (data, queueName) => {
      setRetryFeedback(`Retried ${data.retried} jobs in '${queueName}'`);
      void queryClient.invalidateQueries({ queryKey: ['observability'] });
      setTimeout(() => setRetryFeedback(null), 4000);
    },
    onError: (err) => {
      setRetryFeedback(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setRetryFeedback(null), 5000);
    },
  });

  const overview = overviewQuery.data;
  const traces = tracesQuery.data ?? overview?.recentTraces ?? [];
  const apm = overview?.api;
  const queues = overview?.queues ?? [];

  const totalTokens = overview?.llm.totalTokens ?? 0;
  const totalCost = overview?.llm.totalCostUsd ?? 0;
  const totalCalls = overview?.llm.totalCalls ?? 0;
  const avgDuration = overview?.llm.avgDurationMs ?? 0;

  const totalFailedJobs = queues.reduce((acc, q) => acc + q.failed, 0);
  const totalActiveJobs = queues.reduce((acc, q) => acc + q.active + q.waiting, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Observability & Telemetry"
            subtitle="Real-time LLM token usage, Fastify API latency & throughput, and BullMQ background queues."
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['observability'] })}
            disabled={overviewQuery.isFetching}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line disabled:opacity-50"
          >
            <RefreshIcon size={14} className={overviewQuery.isFetching ? 'animate-spin' : ''} />
            {overviewQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">LLM Tokens Today</div>
          <div className="mt-2 text-2xl font-bold text-ink">{formatNumber(totalTokens)}</div>
          <div className="mt-1 text-xs text-ink-2">{formatNumber(totalCalls)} invocations · avg {avgDuration}ms</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Est. AI Spend</div>
          <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(totalCost)}</div>
          <div className="mt-1 text-xs text-ink-2">Error rate: {overview?.llm.errorRatePercent ?? 0}%</div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">API Latency (p95)</div>
          <div className="mt-2 text-2xl font-bold text-ink">{apm?.latency.p95Ms ?? 0} ms</div>
          <div className="mt-1 text-xs text-ink-2">
            {apm?.requestsPerMinute ?? 0} req/min · avg {apm?.latency.avgMs ?? 0}ms
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Queue Depth</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{totalActiveJobs}</span>
            <span className="text-xs text-muted">active / queued</span>
          </div>
          <div className="mt-1 text-xs text-ink-2">
            {totalFailedJobs > 0 ? (
              <span className="font-semibold text-rose-400">{totalFailedJobs} failed jobs</span>
            ) : (
              <span className="text-emerald-400">All queues healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('llm')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'llm'
              ? 'bg-series text-white'
              : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink'
          }`}
        >
          LLM & Agent Traces
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('apm')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'apm'
              ? 'bg-series text-white'
              : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink'
          }`}
        >
          API Performance (APM)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('queues')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'queues'
              ? 'bg-series text-white'
              : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink'
          }`}
        >
          <span>Queues & Workers</span>
          {totalFailedJobs > 0 && (
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-400">
              {totalFailedJobs}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LLM Traces */}
      {activeTab === 'llm' && (
        <div className="flex flex-col gap-4">
          {/* Model Breakdown Pills */}
          {overview?.llm.byModel && overview.llm.byModel.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModelFilter('all')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  modelFilter === 'all'
                    ? 'border-series bg-series/10 text-series'
                    : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
                }`}
              >
                All Models ({overview.llm.totalCalls})
              </button>
              {overview.llm.byModel.map((m) => (
                <button
                  key={m.model}
                  type="button"
                  onClick={() => setModelFilter(m.model)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    modelFilter === m.model
                      ? 'border-series bg-series/10 text-series'
                      : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  <span>{m.model}</span>
                  <span className="text-muted">({m.calls} calls · {formatNumber(m.tokens)} tok · {formatCurrency(m.costUsd)})</span>
                </button>
              ))}
            </div>
          )}

          {/* Status Filters */}
          <div className="flex gap-2">
            {(['all', 'ok', 'fallback', 'error'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
                  statusFilter === st
                    ? 'bg-line text-ink font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Traces Table */}
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Model & Caller</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Tokens (In / Out)</th>
                  <th className="px-4 py-3 font-semibold">Est. Cost</th>
                  <th className="px-4 py-3 font-semibold">Latency</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {traces.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      No telemetry traces recorded yet. Traces will appear as AI agents run.
                    </td>
                  </tr>
                ) : (
                  traces.map((t) => {
                    const badge = statusBadge(t.status);
                    return (
                      <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink">{t.model}</div>
                          <div className="text-[11px] text-muted">
                            {t.provider} · caller: {t.caller}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-block rounded px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink">
                          <span className="font-medium">{formatNumber(t.totalTokens)}</span>
                          <span className="text-muted ml-1">({formatNumber(t.promptTokens)} / {formatNumber(t.completionTokens)})</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-ink-2">{formatCurrency(t.costUsd)}</td>
                        <td className="px-4 py-3 text-ink">{t.durationMs} ms</td>
                        <td className="px-4 py-3 text-muted">{formatRelative(t.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTrace(t)}
                            className="rounded border border-line bg-surface-2 px-2 py-1 font-semibold text-ink hover:bg-line"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: APM Performance */}
      {activeTab === 'apm' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-muted uppercase">HTTP Status Codes</div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-semibold">2xx / 3xx Success</span>
                  <span className="font-mono text-ink">{formatNumber(apm?.statusCodes.status2xx ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400 font-semibold">4xx Client Errors</span>
                  <span className="font-mono text-ink">{formatNumber(apm?.statusCodes.status4xx ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-rose-400 font-semibold">5xx Server Errors</span>
                  <span className="font-mono text-ink">{formatNumber(apm?.statusCodes.status5xx ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-muted uppercase">Latency Percentiles</div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Median (p50)</span>
                  <span className="font-mono font-semibold text-ink">{apm?.latency.p50Ms ?? 0} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">95th Percentile (p95)</span>
                  <span className="font-mono font-semibold text-amber-400">{apm?.latency.p95Ms ?? 0} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">99th Percentile (p99)</span>
                  <span className="font-mono font-semibold text-rose-400">{apm?.latency.p99Ms ?? 0} ms</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-muted uppercase">Total Requests Handled</div>
              <div className="mt-2 text-2xl font-bold text-ink">{formatNumber(apm?.totalRequests ?? 0)}</div>
              <div className="mt-1 text-xs text-muted">Continuous sampling in-memory buffer</div>
            </div>
          </div>

          {/* Slowest Endpoints Table */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">Top Endpoints by Latency</h3>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface-2 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Method & Route</th>
                    <th className="px-4 py-3 font-semibold">Calls</th>
                    <th className="px-4 py-3 font-semibold">Avg Latency</th>
                    <th className="px-4 py-3 font-semibold">Max Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(!apm?.topSlowRoutes || apm.topSlowRoutes.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted">
                        No route telemetry recorded yet.
                      </td>
                    </tr>
                  ) : (
                    apm.topSlowRoutes.map((r, i) => (
                      <tr key={i} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-ink">
                          <span className="mr-2 font-bold text-series">{r.method}</span>
                          {r.route}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-ink-2">{r.calls}</td>
                        <td className="px-4 py-2.5 font-mono text-ink">
                          <span className={r.avgDurationMs > 500 ? 'text-rose-400 font-semibold' : ''}>
                            {r.avgDurationMs} ms
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted">{r.maxDurationMs} ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BullMQ Queues */}
      {activeTab === 'queues' && (
        <div className="flex flex-col gap-6">
          {retryFeedback && (
            <div className="rounded-lg border border-series/30 bg-series/10 px-4 py-2.5 text-xs font-semibold text-series">
              {retryFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {queues.map((q) => (
              <div key={q.name} className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-ink">{q.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        q.paused ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {q.paused ? 'PAUSED' : 'ACTIVE'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-surface-2 p-2">
                      <div className="text-muted">Waiting</div>
                      <div className="text-base font-bold text-ink">{q.waiting}</div>
                    </div>
                    <div className="rounded bg-surface-2 p-2">
                      <div className="text-muted">Active</div>
                      <div className="text-base font-bold text-emerald-400">{q.active}</div>
                    </div>
                    <div className="rounded bg-surface-2 p-2">
                      <div className="text-muted">Completed</div>
                      <div className="text-base font-bold text-ink-2">{q.completed}</div>
                    </div>
                    <div className="rounded bg-surface-2 p-2">
                      <div className="text-muted">Failed</div>
                      <div className={`text-base font-bold ${q.failed > 0 ? 'text-rose-400' : 'text-ink-2'}`}>
                        {q.failed}
                      </div>
                    </div>
                  </div>
                </div>

                {q.failed > 0 && (
                  <button
                    type="button"
                    onClick={() => retryMutation.mutate(q.name)}
                    disabled={retryMutation.isPending}
                    className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {retryMutation.isPending ? 'Retrying...' : `Retry ${q.failed} Failed Jobs`}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Failed Jobs Details if any */}
          {queues.some((q) => q.failedJobs && q.failedJobs.length > 0) && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <AlertTriangleIcon size={16} />
                Recent Failed Jobs
              </h3>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-2 text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Job ID</th>
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Reason</th>
                      <th className="px-4 py-2.5 font-semibold">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {queues.flatMap((q) => q.failedJobs ?? []).map((j) => (
                      <tr key={j.id} className="hover:bg-surface-2/50">
                        <td className="px-4 py-2.5 font-mono text-ink">{j.id}</td>
                        <td className="px-4 py-2.5 text-ink-2">{j.name}</td>
                        <td className="px-4 py-2.5 text-rose-400 font-mono text-[11px]">{j.failedReason || 'Unknown error'}</td>
                        <td className="px-4 py-2.5 font-mono text-muted">{j.attemptsMade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trace Inspector Modal */}
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="font-semibold text-ink">Trace Details</h3>
                <p className="text-xs text-muted font-mono">{selectedTrace.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrace(null)}
                className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-muted text-[11px]">Model</div>
                  <div className="font-semibold text-ink mt-0.5">{selectedTrace.model}</div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-muted text-[11px]">Total Tokens</div>
                  <div className="font-semibold text-ink mt-0.5">{formatNumber(selectedTrace.totalTokens)}</div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-muted text-[11px]">Cost USD</div>
                  <div className="font-semibold text-ink mt-0.5">{formatCurrency(selectedTrace.costUsd)}</div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2.5">
                  <div className="text-muted text-[11px]">Latency</div>
                  <div className="font-semibold text-ink mt-0.5">{selectedTrace.durationMs} ms</div>
                </div>
              </div>

              {selectedTrace.errorMessage && (
                <div>
                  <div className="text-xs font-semibold text-rose-400">Error Message</div>
                  <pre className="mt-1 max-h-32 overflow-auto rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 font-mono text-[11px] text-rose-300">
                    {selectedTrace.errorMessage}
                  </pre>
                </div>
              )}

              {selectedTrace.promptPreview && (
                <div>
                  <div className="text-xs font-semibold text-ink">Prompt Preview</div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-2 whitespace-pre-wrap">
                    {selectedTrace.promptPreview}
                  </pre>
                </div>
              )}

              {selectedTrace.responsePreview && (
                <div>
                  <div className="text-xs font-semibold text-ink">Response Preview</div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-2 whitespace-pre-wrap">
                    {selectedTrace.responsePreview}
                  </pre>
                </div>
              )}

              {selectedTrace.metadata && Object.keys(selectedTrace.metadata).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-ink">Metadata</div>
                  <pre className="mt-1 max-h-32 overflow-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-[11px] text-ink-2">
                    {JSON.stringify(selectedTrace.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
