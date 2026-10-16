import type { CheckStatus, IncidentView, User } from '@cc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { ago, checkerLabel, dateTime, duration } from '../format.ts';
import { StatusIcon } from './Status.tsx';
import { TargetCard } from './TargetCard.tsx';

const TILES: { key: CheckStatus | 'unknown'; label: string }[] = [
  { key: 'ok', label: 'OK' },
  { key: 'warn', label: 'Warning' },
  { key: 'fail', label: 'Down' },
  { key: 'error', label: 'Check failed' },
];

function IncidentRow({ incident }: { incident: IncidentView }) {
  const open = incident.resolvedAt === null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
      <StatusIcon status={open ? incident.severity : 'ok'} size={16} />
      <span className="font-medium">{incident.targetName}</span>
      <span className="text-ink-2">{checkerLabel(incident.checker)}: {incident.lastMessage}</span>
      <span className="ml-auto whitespace-nowrap text-xs text-muted">
        {open ? `for ${duration(incident.openedAt, null)}` : `${dateTime(incident.openedAt)} · lasted ${duration(incident.openedAt, incident.resolvedAt)}`}
      </span>
    </li>
  );
}

export function Dashboard({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 30_000 });
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.incidents, refetchInterval: 60_000 });
  const logout = useMutation({
    mutationFn: api.logout,
    // Reset (not clear) "who am I": it refetches, gets 401 and shows the login screen. Then drop the private data.
    onSettled: async () => {
      await queryClient.resetQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });

  const open = incidents.data?.filter((i) => i.resolvedAt === null) ?? [];
  const past = incidents.data?.filter((i) => i.resolvedAt !== null) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 py-6">
        <h1 className="text-xl font-semibold">Control Center</h1>
        <span className="text-sm text-muted">
          {overview.data ? `Updated ${ago(overview.data.generatedAt)}` : overview.isError ? 'Could not refresh' : 'Loading…'}
        </span>
        <span className="ml-auto truncate text-sm text-ink-2">{user.email}</span>
        <button onClick={() => logout.mutate()} className="rounded-md border border-line px-3 py-1 text-sm hover:bg-grid/40">
          Sign out
        </button>
      </header>

      {overview.data && (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TILES.map((t) => (
              <div key={t.key} className="rounded-xl border border-line bg-surface p-4">
                <div className="text-3xl font-semibold">{overview.data.counts[t.key]}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                  <StatusIcon status={t.key === 'unknown' ? null : t.key} size={14} /> {t.label}
                </div>
              </div>
            ))}
          </section>

          {open.length > 0 && (
            <section className="mt-6 overflow-hidden rounded-xl border border-critical/40 bg-surface">
              <h2 className="px-4 pt-3 text-sm font-semibold">Open incidents</h2>
              <ul className="divide-y divide-line">{open.map((i) => <IncidentRow key={i.id} incident={i} />)}</ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Everything I run · {overview.data.targets.length} targets</h2>
            <div className="grid items-start gap-3 md:grid-cols-2">
              {overview.data.targets.map((t) => <TargetCard key={t.id} target={t} />)}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Recent incidents</h2>
            {past.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {past.map((i) => <IncidentRow key={i.id} incident={i} />)}
              </ul>
            ) : (
              <p className="text-sm text-muted">None so far.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
