import { useState } from 'react';
import type { CheckStatus, IncidentView, TargetView } from '@cc/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { ago, checkerLabel, dateTime, duration } from '../format.ts';
import { StatusIcon } from '../components/Status.tsx';
import { TargetCard } from '../components/TargetCard.tsx';
import {
  VpsIcon,
  LeadsIcon,
  BackupIcon,
  KnowledgeIcon,
  VaultIcon,
  CloudflareIcon,
  VercelIcon,
  FilesIcon,
  DealsIcon,
  MarketingIcon,
} from '../components/Icons.tsx';

const STATUS_TILES: { key: CheckStatus | 'unknown'; label: string; badgeBg: string; badgeColor: string }[] = [
  { key: 'ok', label: 'Operational', badgeBg: '#052e16', badgeColor: '#4ade80' },
  { key: 'warn', label: 'Warning', badgeBg: '#422006', badgeColor: '#facc15' },
  { key: 'fail', label: 'Down', badgeBg: '#450a0a', badgeColor: '#f87171' },
  { key: 'error', label: 'Failed Check', badgeBg: '#27272a', badgeColor: '#a1a1aa' },
];

function IncidentRow({ incident }: { incident: IncidentView }) {
  const open = incident.resolvedAt === null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
      <StatusIcon status={open ? incident.severity : 'ok'} size={16} />
      <span className="font-medium text-ink">{incident.targetName}</span>
      <span className="text-ink-2">
        {checkerLabel(incident.checker)}: {incident.lastMessage}
      </span>
      <span className="ml-auto whitespace-nowrap text-xs text-muted">
        {open
          ? `for ${duration(incident.openedAt, null)}`
          : `${dateTime(incident.openedAt)} · lasted ${duration(incident.openedAt, incident.resolvedAt)}`}
      </span>
    </li>
  );
}

export function OverviewPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 30_000 });
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.incidents, refetchInterval: 60_000 });

  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'demos' | 'issues'>('all');
  const [searchTarget, setSearchTarget] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [backupTriggering, setBackupTriggering] = useState<boolean>(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const openIncidents = incidents.data?.filter((i) => i.resolvedAt === null) ?? [];
  const pastIncidents = incidents.data?.filter((i) => i.resolvedAt !== null) ?? [];

  const handleCopyLlmContext = async () => {
    try {
      const res = await api.agentContext('all');
      const text = typeof res === 'string' ? res : res.context;
      await navigator.clipboard.writeText(text);
      setCopyFeedback('System Context Copied!');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback('Failed to copy context');
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  const handleTriggerBackup = async () => {
    setBackupTriggering(true);
    setBackupNotice('Triggering dual backup...');
    try {
      const res = await fetch('/api/backups/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudSync: true }),
      });
      if (res.ok) {
        setBackupNotice('Backup initiated successfully (local + Google Drive sync).');
      } else {
        setBackupNotice('Backup request failed.');
      }
    } catch {
      setBackupNotice('Error connecting to backup daemon.');
    } finally {
      setBackupTriggering(false);
      setTimeout(() => setBackupNotice(null), 4000);
    }
  };

  // Filter targets
  const allTargets = overview.data?.targets ?? [];
  const filteredTargets = allTargets.filter((t: TargetView) => {
    // Category filter
    if (activeCategory === 'issues' && t.status === 'ok') return false;
    if (activeCategory === 'demos') {
      const isDemo =
        t.tags.includes('demo') ||
        t.name.toLowerCase().includes('demo') ||
        t.url?.toLowerCase().includes('demo') ||
        t.type.toLowerCase().includes('demo');
      if (!isDemo) return false;
    }
    if (activeCategory === 'core') {
      const isCore =
        t.tags.includes('core') ||
        t.tags.includes('production') ||
        t.name.toLowerCase().includes('nicoguzmandev') ||
        t.name.toLowerCase().includes('api') ||
        t.name.toLowerCase().includes('cms');
      if (!isCore) return false;
    }

    // Search filter
    if (searchTarget.trim()) {
      const q = searchTarget.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchUrl = t.url?.toLowerCase().includes(q) ?? false;
      const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchName || matchUrl || matchTags;
    }

    return true;
  });

  const telemetry = overview.data?.telemetry;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header with Live Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <PageHeader
            title="Overview & Mission Control"
            subtitle={
              overview.data
                ? `Updated ${ago(overview.data.generatedAt)} · Contabo VPS (173.212.224.70) · Dual Backup Sync`
                : overview.isError
                  ? 'Could not refresh telemetry'
                  : 'Loading live telemetry...'
            }
          />
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopyLlmContext}
            style={{
              background: '#1e3a8a',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {copyFeedback ? copyFeedback : 'Copy Context for LLM'}
          </button>

          <button
            type="button"
            onClick={handleTriggerBackup}
            disabled={backupTriggering}
            style={{
              background: '#064e3b',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: backupTriggering ? 'default' : 'pointer',
            }}
          >
            {backupTriggering ? 'Triggering...' : 'Run Backup Now'}
          </button>

          <button
            type="button"
            onClick={() => {
              void overview.refetch();
              void incidents.refetch();
            }}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Backup Notification Toast */}
      {backupNotice && (
        <div style={{ background: '#052e16', border: '1px solid #166534', color: '#4ade80', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
          {backupNotice}
        </div>
      )}

      {/* 4 Pillars of Operations (Executive Telemetry Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Pillar 1: Infrastructure & Compute */}
        <div
          style={{
            background: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <VpsIcon /> Infrastructure & Host
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#064e3b', color: '#6ee7b7', fontWeight: 700 }}>
              ONLINE
            </span>
          </div>

          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {telemetry?.vps.hostname ?? 'ContaboVPS'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.15rem' }}>
              173.212.224.70:2222 · Caddy + 4 Containers
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}>
            {/* RAM Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                <span>Memory RAM</span>
                <span>{telemetry?.vps.ramUsedGb ?? 0} / {telemetry?.vps.ramTotalGb ?? 0} GB ({telemetry?.vps.ramUsedPercent ?? 0}%)</span>
              </div>
              <div style={{ height: '5px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(telemetry?.vps.ramUsedPercent ?? 0, 100)}%`, background: '#38bdf8' }} />
              </div>
            </div>

            {/* Disk Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                <span>Root Disk</span>
                <span>{telemetry?.vps.diskUsedGb ?? 0} / {telemetry?.vps.diskTotalGb ?? 0} GB ({telemetry?.vps.diskUsedPercent ?? 0}%)</span>
              </div>
              <div style={{ height: '5px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(telemetry?.vps.diskUsedPercent ?? 0, 100)}%`, background: '#34d399' }} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.6rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Uptime: {telemetry?.vps.uptimeHuman ?? 'Normal'}</span>
            <a href="/vps" style={{ fontSize: '0.74rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>Manage VPS &gt;</a>
          </div>
        </div>

        {/* Pillar 2: Sales & Lead Prospecting */}
        <div
          style={{
            background: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#4ade80', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LeadsIcon /> Sales & Outreach
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#052e16', color: '#4ade80', fontWeight: 700 }}>
              ACTIVE PIPELINE
            </span>
          </div>

          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {telemetry?.leads.total ?? 0} Prospects
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              {telemetry?.leads.withoutWebsite ?? 0} High-Value targets without website
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
            <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.5rem' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Uncontacted</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#facc15' }}>{telemetry?.leads.uncontacted ?? 0}</div>
            </div>
            <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.5rem' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase' }}>Clients Won</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4ade80' }}>{telemetry?.leads.converted ?? 0}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.6rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Google Maps Extractor</span>
            <a href="/leads" style={{ fontSize: '0.74rem', color: '#4ade80', textDecoration: 'none', fontWeight: 600 }}>Launch Outreach &gt;</a>
          </div>
        </div>

        {/* Pillar 3: Data Protection & Backups */}
        <div
          style={{
            background: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#facc15', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BackupIcon /> Data Protection
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#422006', color: '#fde68a', fontWeight: 700 }}>
              DUAL SYNC ARMED
            </span>
          </div>

          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {telemetry?.backups.localBackupsCount ?? 0} Snapshots
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              PostgreSQL dump + Directus media uploads
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Latest Snapshot:</span>
              <span style={{ fontWeight: 600 }}>{telemetry?.backups.lastSnapshotTime ? ago(telemetry.backups.lastSnapshotTime) : 'Today'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Cloud Offsite:</span>
              <span style={{ color: '#fde68a', fontWeight: 600 }}>Google Drive (AES-256)</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.6rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Nightly 03:30 schedule</span>
            <a href="/backups" style={{ fontSize: '0.74rem', color: '#facc15', textDecoration: 'none', fontWeight: 600 }}>Inspect Backups &gt;</a>
          </div>
        </div>

        {/* Pillar 4: Neural Core & MCP */}
        <div
          style={{
            background: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <KnowledgeIcon /> Knowledge & MCP
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#3b0764', color: '#d8b4fe', fontWeight: 700 }}>
              AI READY
            </span>
          </div>

          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {telemetry?.knowledge.docsCount ?? 9} Docs / {telemetry?.knowledge.skillsCount ?? 3} Skills
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              Canonical specifications for Antigravity & Cursor
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.2rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>MCP Server:</span>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>Stdio & HTTP /mcp</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Vault Secrets:</span>
              <span style={{ fontWeight: 600 }}>{telemetry?.vault.itemsCount ?? 0} Encrypted items</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.6rem', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Level 1 AI Directive</span>
            <a href="/knowledge" style={{ fontSize: '0.74rem', color: '#c084fc', textDecoration: 'none', fontWeight: 600 }}>Explore Neural Hub &gt;</a>
          </div>
        </div>
      </div>

      {/* Incidents Section */}
      {openIncidents.length > 0 ? (
        <section aria-label="Open incidents" style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.9rem' }}>
              ACTIVE INCIDENTS DETECTED ({openIncidents.length})
            </span>
          </div>
          <ul className="divide-y divide-line">{openIncidents.map((i) => <IncidentRow key={i.id} incident={i} />)}</ul>
        </section>
      ) : (
        <div style={{ background: '#052e16', border: '1px solid #166534', color: '#86efac', padding: '0.75rem 1.25rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.84rem', fontWeight: 600 }}>
            <span>All monitored infrastructure is fully operational. 0 open incidents across production targets.</span>
          </div>
          <span style={{ fontSize: '0.76rem', color: '#4ade80', fontFamily: 'monospace' }}>Uptime Health 100%</span>
        </div>
      )}

      {/* Status Counters Tile Bar */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_TILES.map((t) => (
          <div key={t.key} className="rounded-xl border border-line bg-surface p-3.5 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{overview.data?.counts[t.key] ?? 0}</div>
              <div className="mt-0.5 text-xs text-muted flex items-center gap-1.5">
                <StatusIcon status={t.key === 'unknown' ? null : t.key} size={12} /> {t.label}
              </div>
            </div>
            <span style={{ background: t.badgeBg, color: t.badgeColor, fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
              {t.label}
            </span>
          </div>
        ))}
      </section>

      {/* Quick Access Matrix (Navigation Hub) */}
      <section
        style={{
          background: '#0b0f19',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
            Executive Control & Navigation Hub
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>18 Microservices & Tools Active</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
          {[
            { label: 'Sales Leads', path: '/leads', Icon: LeadsIcon, color: '#4ade80' },
            { label: 'Deals & Promos', path: '/deals', Icon: DealsIcon, color: '#facc15' },
            { label: 'Marketing', path: '/marketing', Icon: MarketingIcon, color: '#f43f5e' },
            { label: 'Contabo VPS', path: '/vps', Icon: VpsIcon, color: '#38bdf8' },
            { label: 'Secrets Vault', path: '/vault', Icon: VaultIcon, color: '#a855f7' },
            { label: 'Cloud Backups', path: '/backups', Icon: BackupIcon, color: '#fbbf24' },
            { label: 'Knowledge Base', path: '/knowledge', Icon: KnowledgeIcon, color: '#c084fc' },
            { label: 'File Manager', path: '/files', Icon: FilesIcon, color: '#34d399' },
            { label: 'Cloudflare DNS', path: '/cloudflare', Icon: CloudflareIcon, color: '#fb923c' },
            { label: 'Vercel Fleet', path: '/vercel', Icon: VercelIcon, color: '#ffffff' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              style={{
                background: '#050811',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.65rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.35rem',
                textDecoration: 'none',
                color: '#cbd5e1',
                fontSize: '0.76rem',
                fontWeight: 600,
                textAlign: 'center',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ color: item.color }}>
                <item.Icon />
              </div>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Target Fleet Grid ("Everything I Run") */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
              Everything I Run · {allTargets.length} Monitored Targets
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Real-time HTTP health, SSL certificate expiration, and background monitors.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter Pills */}
            <div style={{ display: 'flex', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
              {[
                { id: 'all', label: 'All Targets' },
                { id: 'core', label: 'Core Production' },
                { id: 'demos', label: 'Client Demos' },
                { id: 'issues', label: 'Issues Only' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
                  style={{
                    background: activeCategory === cat.id ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: activeCategory === cat.id ? '#38bdf8' : '#94a3b8',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Target Search Input */}
            <input
              type="text"
              placeholder="Search target or URL..."
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.38rem 0.75rem',
                fontSize: '0.8rem',
                minWidth: '200px',
              }}
            />
          </div>
        </div>

        {/* Targets Grid */}
        <div className="grid items-start gap-3 md:grid-cols-2">
          {filteredTargets.map((t) => (
            <TargetCard key={t.id} target={t} />
          ))}
        </div>

        {filteredTargets.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: '#0b0f19', borderRadius: '12px' }}>
            No targets matching &quot;{searchTarget}&quot; in category &quot;{activeCategory}&quot;.
          </div>
        )}
      </section>

      {/* Past Incidents Archive */}
      {pastIncidents.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#94a3b8', fontWeight: 600 }}>
            Incident History (Resolved)
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {pastIncidents.slice(0, 10).map((i) => (
              <IncidentRow key={i.id} incident={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
