import type { ResultPoint } from '@cc/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { api } from '../api.ts';
import { dateTime, time } from '../format.ts';
import { StatusIcon, statusLabel } from './Status.tsx';

const RANGES = [
  { hours: 24, label: '24 h' },
  { hours: 24 * 7, label: '7 days' },
  { hours: 24 * 30, label: '30 days' },
];
const HEIGHT = 170;
const M = { top: 10, right: 12, bottom: 24, left: 48 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// A round axis maximum (1, 2, 2.5 or 5 × 10^n) so tick labels are easy to read.
function niceMax(value: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
}

const ms = (p: ResultPoint) => p.metrics.responseMs;

function summarize(points: ResultPoint[]) {
  const known = points.filter((p) => p.status !== 'error');
  const up = known.filter((p) => p.status === 'ok' || p.status === 'warn').length;
  const times = points.flatMap((p) => (ms(p) === undefined ? [] : [ms(p)!])).sort((a, b) => a - b);
  return {
    uptime: known.length ? (up / known.length) * 100 : null,
    avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    p95: times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]! : null,
  };
}

export function ResponseChart({ monitorId }: { monitorId: string }) {
  const [hours, setHours] = useState(24);
  const results = useQuery({
    queryKey: ['results', monitorId, hours],
    queryFn: () => api.results(monitorId, hours),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData, // keep the old chart (dimmed) while the new range loads
  });
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const points = results.data ?? [];
  const stats = useMemo(() => summarize(points), [points]);

  const plotW = Math.max(width - M.left - M.right, 10);
  const plotH = HEIGHT - M.top - M.bottom;
  const t1 = Date.now();
  const t0 = t1 - hours * 3_600_000;
  const yMax = niceMax(Math.max(...points.map((p) => ms(p) ?? 0), 100) * 1.1);
  const x = (iso: string) => M.left + ((new Date(iso).getTime() - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;

  // One path, broken wherever a check has no response time (site down or check failed).
  let path = '';
  let penDown = false;
  for (const p of points) {
    const v = ms(p);
    if (v === undefined || p.status === 'fail') {
      penDown = false;
      continue;
    }
    path += `${penDown ? 'L' : 'M'}${x(p.checkedAt).toFixed(1)},${y(v).toFixed(1)}`;
    penDown = true;
  }

  const xTicks = Array.from({ length: 5 }, (_, i) => new Date(t0 + ((t1 - t0) * i) / 4).toISOString());
  const yTicks = [0, yMax / 2, yMax];

  const nearest = (clientX: number, left: number) => {
    const t = t0 + ((clientX - left - M.left) / plotW) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(new Date(points[i]!.checkedAt).getTime() - t) < Math.abs(new Date(points[best]!.checkedAt).getTime() - t)) best = i;
    }
    return best;
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (points.length) setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect().left));
  };
  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return;
    if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, (i ?? points.length) - 1));
    if (e.key === 'ArrowRight') setActive((i) => Math.min(points.length - 1, (i ?? -1) + 1));
  };

  const a = active !== null ? points[active] : undefined;
  const aX = a ? x(a.checkedAt) : 0;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">Response time</h4>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => { setHours(r.hours); setActive(null); }}
              aria-pressed={hours === r.hours}
              className={`rounded-md px-2 py-0.5 text-xs ${hours === r.hours ? 'bg-ink text-page' : 'text-ink-2 hover:bg-grid'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-2 tabular-nums">
        {stats.uptime === null ? 'No data yet' : `Uptime ${stats.uptime.toFixed(stats.uptime === 100 ? 0 : 2)}%`}
        {stats.avg !== null && ` · average ${stats.avg} ms · 95% under ${stats.p95} ms`}
      </p>

      <div
        ref={ref}
        className={`relative mt-2 transition-opacity ${results.isPlaceholderData ? 'opacity-50' : ''}`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        aria-label="Response time chart. Use the arrow keys to read values."
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-hidden>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
                  {t >= 1000 ? `${t / 1000} s` : `${t} ms`}
                </text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text key={t} x={x(t)} y={HEIGHT - 6} fontSize={11} fill="var(--muted)" className="tabular-nums"
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {hours <= 24 ? time(t) : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </text>
            ))}
            <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* Outages: a red tick on the baseline for every failed check. */}
            {points.map((p) =>
              p.status === 'fail' ? (
                <rect key={p.checkedAt} x={x(p.checkedAt) - 1.5} y={M.top + plotH - 10} width={3} height={10} rx={1} fill="var(--critical)" />
              ) : null,
            )}
            {a && (
              <g pointerEvents="none">
                <line x1={aX} x2={aX} y1={M.top} y2={M.top + plotH} stroke="var(--axis)" />
                {ms(a) !== undefined && a.status !== 'fail' && (
                  <circle cx={aX} cy={y(ms(a)!)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
                )}
              </g>
            )}
            <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="transparent"
              onPointerMove={onMove} onPointerLeave={() => setActive(null)} />
          </svg>
        )}
        {a && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max max-w-56 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: Math.min(Math.max(aX - 60, 0), Math.max(width - 200, 0)) }}
          >
            <div className="flex items-center gap-1.5">
              <StatusIcon status={a.status} size={14} />
              <strong className="text-sm tabular-nums">{ms(a) !== undefined && a.status !== 'fail' ? `${ms(a)} ms` : statusLabel(a.status)}</strong>
            </div>
            <div className="mt-0.5 text-ink-2">{dateTime(a.checkedAt)}</div>
            {a.status !== 'ok' && <div className="mt-0.5 text-ink-2">{a.message}</div>}
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-ink-2">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted">
              <tr><th className="py-1 font-normal">Time</th><th className="font-normal">Status</th><th className="font-normal">Result</th></tr>
            </thead>
            <tbody>
              {[...points].reverse().slice(0, 100).map((p) => (
                <tr key={p.checkedAt} className="border-t border-line">
                  <td className="py-1 pr-3 whitespace-nowrap">{dateTime(p.checkedAt)}</td>
                  <td className="pr-3 whitespace-nowrap">{statusLabel(p.status)}</td>
                  <td>{p.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
