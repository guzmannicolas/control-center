import type { TargetView } from '@cc/shared';
import { useState } from 'react';
import { ago, checkerLabel } from '../format.ts';
import { ResponseChart } from './ResponseChart.tsx';
import { StatusIcon, statusLabel } from './Status.tsx';

const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function TargetCard({ target }: { target: TargetView }) {
  const uptime = target.monitors.find((m) => m.checker === 'http-uptime');
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <StatusIcon status={target.status} size={24} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {target.name}
            <span className="sr-only">: {statusLabel(target.status)}</span>
          </h3>
          <p className="truncate text-sm text-muted">
            {target.url ? (
              <a href={target.url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">{shortUrl(target.url)}</a>
            ) : (
              target.type
            )}
          </p>
        </div>
        <ul className="hidden flex-wrap justify-end gap-1 sm:flex">
          {target.tags.map((t) => (
            <li key={t} className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">{t}</li>
          ))}
        </ul>
      </header>

      <ul className="divide-y divide-line border-t border-line">
        {target.monitors.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
            <StatusIcon status={m.status} size={16} />
            <span className="font-medium sm:w-36">{checkerLabel(m.checker)}</span>
            <span className="order-last min-w-0 basis-full truncate pl-7 text-ink-2 sm:order-none sm:basis-0 sm:flex-1 sm:pl-0" title={m.message ?? undefined}>
              {m.message ?? '—'}
            </span>
            <span className="ml-auto whitespace-nowrap text-xs text-muted sm:ml-0">{ago(m.lastCheckedAt)}</span>
          </li>
        ))}
      </ul>

      {uptime && (
        <div className="border-t border-line">
          <button
            onClick={() => setChartOpen((o) => !o)}
            aria-expanded={chartOpen}
            className="w-full px-4 py-2 text-left text-xs text-ink-2 hover:bg-grid/40"
          >
            {chartOpen ? '▾ Hide response time' : '▸ Response time'}
          </button>
          {chartOpen && (
            <div className="px-4 pb-4">
              <ResponseChart monitorId={uptime.id} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
