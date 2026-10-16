import type { CheckStatus } from '@cc/shared';

// Never color alone: every status has an icon and a word too.
const STATUS = {
  ok: { icon: '✓', label: 'OK', bg: 'var(--good)', fg: '#fff' },
  warn: { icon: '!', label: 'Warning', bg: 'var(--warning)', fg: '#0b0b0b' },
  fail: { icon: '✕', label: 'Down', bg: 'var(--critical)', fg: '#fff' },
  error: { icon: '?', label: 'Check failed', bg: 'var(--muted)', fg: '#fff' },
  unknown: { icon: '·', label: 'Not checked yet', bg: 'var(--muted)', fg: '#fff' },
} as const;

export const statusLabel = (s: CheckStatus | null) => STATUS[s ?? 'unknown'].label;

export function StatusIcon({ status, size = 20 }: { status: CheckStatus | null; size?: number }) {
  const s = STATUS[status ?? 'unknown'];
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full font-bold leading-none"
      style={{ width: size, height: size, background: s.bg, color: s.fg, fontSize: size * 0.55 }}
    >
      {s.icon}
    </span>
  );
}

export function StatusBadge({ status }: { status: CheckStatus | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <StatusIcon status={status} />
      {statusLabel(status)}
    </span>
  );
}
