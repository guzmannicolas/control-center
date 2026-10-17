import type { DomainView } from '@cc/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../api.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { StatusIcon, statusLabel } from '../components/Status.tsx';
import { ago } from '../format.ts';

const longDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

function since(iso: string) {
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86_400_000));
  if (months < 1) return 'this month';
  if (months < 12) return `${months} months ago`;
  const y = Math.floor(months / 12);
  return `${y} year${y > 1 ? 's' : ''}${months % 12 ? ` ${months % 12} mo` : ''} ago`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function DomainCard({ domain }: { domain: DomainView }) {
  const d = domain.details;
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <StatusIcon status={domain.status} size={24} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold break-all">
            <a href={`https://${domain.name}`} target="_blank" rel="noreferrer" className="hover:underline">{domain.name}</a>
            <span className="sr-only">: {statusLabel(domain.status)}</span>
          </h2>
          <p className="text-xs text-muted">Checked {ago(domain.checkedAt)}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{domain.daysLeft ?? '—'} <span className="text-base font-normal text-ink-2">days</span></div>
          <div className="text-xs text-ink-2">{d?.expiresOn ? `to renew · ${longDate(d.expiresOn)}` : 'to renew'}</div>
        </div>
      </header>

      {d ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 sm:grid-cols-3">
          <Fact label="Registrar">{d.registrar ?? 'Unknown'}</Fact>
          <Fact label="Registered">{d.registeredOn ? <>{longDate(d.registeredOn)} <span className="text-muted">· {since(d.registeredOn)}</span></> : 'Unknown'}</Fact>
          <Fact label="DNS">
            <span title={d.nameservers.join('\n')}>{d.dnsProvider ?? 'Unknown'}</span>
          </Fact>
          <Fact label="Transfer lock">
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status={d.transferLocked ? 'ok' : 'warn'} size={14} />
              {d.transferLocked ? 'Locked' : 'Unlocked: anyone with the auth code could move it'}
            </span>
          </Fact>
          <Fact label="DNSSEC">{d.dnssec === null ? 'Unknown' : d.dnssec ? 'On' : 'Off'}</Fact>
          <Fact label="Name servers">
            <span className="text-ink-2">{d.nameservers.length ? d.nameservers.join(', ') : '—'}</span>
          </Fact>
        </dl>
      ) : (
        <p className="border-t border-line p-4 text-sm text-ink-2">{domain.message ?? 'Details appear after the first check.'}</p>
      )}

      <div className="border-t border-line px-4 py-3">
        <h3 className="text-xs text-muted">Sites on this domain</h3>
        {domain.sites.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {domain.sites.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm hover:bg-grid/40">
                  <StatusIcon status={s.status} size={14} />
                  {s.name}
                  <span className="sr-only">: {statusLabel(s.status)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-2">None watched yet.</p>
        )}
      </div>
    </article>
  );
}

export function DomainsPage() {
  const domains = useQuery({ queryKey: ['domains'], queryFn: api.domains, refetchInterval: 5 * 60_000 });
  const count = domains.data?.length;

  return (
    <div>
      <PageHeader
        title="Domains"
        subtitle={count === undefined ? (domains.isError ? 'Could not load' : 'Loading…') : `${count} domain${count === 1 ? '' : 's'} · soonest renewal first`}
      />
      <div className="grid gap-3">
        {domains.data?.map((d) => <DomainCard key={d.id} domain={d} />)}
      </div>
    </div>
  );
}
