import type { CheckSnapshot, DatabaseView } from '@cc/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../api.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { StatusIcon, statusLabel } from '../components/Status.tsx';
import { ago, bytes, uptime } from '../format.ts';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums">{children}</dd>
    </div>
  );
}

const str = (v: unknown) => (typeof v === 'string' ? v : null);

function PostgresFacts({ health }: { health: CheckSnapshot }) {
  const m = health.metrics;
  const tables = (health.details.biggestTables ?? []) as { name: string; bytes: number }[];
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 sm:grid-cols-4">
        <Fact label="Connections">{m.connections ?? '—'} <span className="text-muted">/ {m.maxConnections ?? '—'}</span></Fact>
        <Fact label="Running for">{m.uptimeSeconds !== undefined ? uptime(m.uptimeSeconds) : '—'}</Fact>
        <Fact label="Cache hits">{m.cacheHitPct !== undefined ? `${m.cacheHitPct}%` : '—'}</Fact>
        <Fact label="Database">{str(health.details.database) ?? '—'}</Fact>
      </dl>
      {tables.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <h3 className="text-xs text-muted">Biggest tables</h3>
          <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {tables.map((t) => (
              <li key={t.name} className="flex justify-between gap-3">
                <span className="truncate font-mono text-xs leading-5">{t.name}</span>
                <span className="text-ink-2 tabular-nums">{bytes(t.bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function RedisFacts({ health }: { health: CheckSnapshot }) {
  const m = health.metrics;
  const d = health.details;
  const persistence = d.aofEnabled ? 'Every write saved (append-only file)' : str(d.lastSaveAt) ? `Snapshot · last ${ago(str(d.lastSaveAt))}` : 'Memory only';
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 sm:grid-cols-4">
      <Fact label="Keys">{m.keys ?? '—'}</Fact>
      <Fact label="Clients">{m.clients ?? '—'}</Fact>
      <Fact label="Running for">{m.uptimeSeconds !== undefined ? uptime(m.uptimeSeconds) : '—'}</Fact>
      <Fact label="Persistence">{persistence}</Fact>
    </dl>
  );
}

function Backup({ db }: { db: DatabaseView }) {
  const b = db.backup;
  if (!b) {
    // A cache can be rebuilt; a database with real data and no backup is a risk worth showing.
    return db.engine === 'redis' ? (
      <p className="text-sm text-ink-2">Not backed up: holds nothing that cannot be rebuilt.</p>
    ) : (
      <p className="inline-flex items-center gap-1.5 text-sm">
        <StatusIcon status="warn" size={14} /> No backup is set up for this database.
      </p>
    );
  }
  const warnings = (b.details.warnings ?? []) as string[];
  return (
    <div className="text-sm">
      <p className="flex items-center gap-1.5">
        <StatusIcon status={b.status} size={14} />
        <span>{b.message ?? 'Not checked yet'}</span>
      </p>
      {str(b.details.destination) && <p className="mt-0.5 pl-5 text-xs text-ink-2">Stored in: {str(b.details.destination)}</p>}
      {warnings.length > 0 && (
        <ul className="mt-2 grid gap-1 pl-5">
          {warnings.map((w) => (
            <li key={w} className="rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs text-ink">{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DatabaseCard({ db }: { db: DatabaseView }) {
  const h = db.health;
  const version = h ? str(h.details.version) : null;
  const size = db.engine === 'postgres' ? h?.metrics.sizeBytes : h?.metrics.usedMemoryBytes;
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <StatusIcon status={db.status} size={24} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {db.name}
            <span className="sr-only">: {statusLabel(db.status)}</span>
          </h2>
          <p className="text-sm text-ink-2">
            <span className="mr-2 rounded border border-line px-1.5 py-0.5 text-xs">
              {db.engine === 'postgres' ? 'PostgreSQL' : 'Redis'}{version ? ` ${version}` : ''}
            </span>
            {db.purpose}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{size !== undefined ? bytes(size) : '—'}</div>
          <div className="text-xs text-ink-2">{db.engine === 'postgres' ? 'on disk' : 'in memory'}</div>
        </div>
      </header>

      {h?.status === 'fail' || !h ? (
        <p className="border-t border-line p-4 text-sm text-ink-2">{h?.message ?? 'Not checked yet.'}</p>
      ) : db.engine === 'postgres' ? (
        <PostgresFacts health={h} />
      ) : (
        <RedisFacts health={h} />
      )}

      <div className="border-t border-line px-4 py-3">
        <h3 className="mb-1.5 text-xs text-muted">Backups</h3>
        <Backup db={db} />
      </div>
      {h?.checkedAt && <p className="border-t border-line px-4 py-2 text-xs text-muted">Checked {ago(h.checkedAt)}</p>}
    </article>
  );
}

export function DatabasesPage() {
  const databases = useQuery({ queryKey: ['databases'], queryFn: api.databases, refetchInterval: 60_000 });
  const count = databases.data?.length;
  return (
    <div>
      <PageHeader
        title="Databases"
        subtitle={count === undefined ? (databases.isError ? 'Could not load' : 'Loading…') : `${count} database${count === 1 ? '' : 's'}`}
      />
      <div className="grid gap-3">
        {databases.data?.map((db) => <DatabaseCard key={db.id} db={db} />)}
      </div>
    </div>
  );
}
