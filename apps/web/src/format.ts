export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

export function duration(fromIso: string, toIso: string | null, now = Date.now()): string {
  const s = Math.round(((toIso ? new Date(toIso).getTime() : now) - new Date(fromIso).getTime()) / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86_400).toFixed(1)} days`;
}

export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const CHECKER_LABELS: Record<string, string> = {
  'http-uptime': 'Uptime',
  'ssl-expiry': 'HTTPS certificate',
  'domain-expiry': 'Domain renewal',
};
export const checkerLabel = (id: string) => CHECKER_LABELS[id] ?? id;
