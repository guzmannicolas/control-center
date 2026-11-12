import { useEffect, useState } from 'react';
import { ShieldIcon, VpsIcon } from '../components/Icons.tsx';
import { VpsSecurity } from '../components/VpsSecurity.tsx';
import { api } from '../api.ts';

interface VpsStatusView {
  hostname: string;
  uptimeHuman: string;
  loadAvg: [number, number, number];
  cpuCores: number;
  memory: {
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
    swapTotalGb: number;
    swapUsedGb: number;
  };
  disk: {
    filesystem: string;
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
  };
  dockerStorage: Array<{
    type: string;
    totalCount: string;
    active: string;
    size: string;
    reclaimable: string;
  }>;
  topDirectories: Array<{
    path: string;
    sizeHuman: string;
  }>;
  containers: Array<{
    name: string;
    image: string;
    status: string;
    state: string;
  }>;
}

interface CleanupResult {
  ok: boolean;
  target: string;
  beforeUsedGb: number;
  afterUsedGb: number;
  freedGb: number;
  log: string;
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden', marginTop: '0.5rem' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
    </div>
  );
}

export function VpsPage() {
  const [activeTab, setActiveTab] = useState<'resources' | 'security'>('resources');
  const [data, setData] = useState<VpsStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaningTarget, setCleaningTarget] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusData = await api.vpsStatus();
      setData(statusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const runCleanup = async (target: 'docker' | 'vscode' | 'caches' | 'all') => {
    if (cleaningTarget) return;
    setCleaningTarget(target);
    setCleanupResult(null);
    try {
      const json = await api.vpsCleanup(target);
      setCleanupResult(json);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleaningTarget(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <VpsIcon />
            <span>VPS Node Control & Telemetry</span>
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Host telemetry for node {data?.hostname ?? 'VPS Node'}, system resources, container status, and security posture.
          </p>
        </div>

        {activeTab === 'resources' && (
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('resources')}
          style={{
            background: activeTab === 'resources' ? '#1e293b' : 'transparent',
            border: activeTab === 'resources' ? '1px solid #334155' : '1px solid transparent',
            color: activeTab === 'resources' ? '#38bdf8' : '#94a3b8',
            borderRadius: '8px',
            padding: '0.45rem 0.9rem',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <VpsIcon />
          <span>System & Resources</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          style={{
            background: activeTab === 'security' ? '#1e293b' : 'transparent',
            border: activeTab === 'security' ? '1px solid #334155' : '1px solid transparent',
            color: activeTab === 'security' ? '#38bdf8' : '#94a3b8',
            borderRadius: '8px',
            padding: '0.45rem 0.9rem',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <ShieldIcon />
          <span>Security & Hardening</span>
        </button>
      </div>

      {error && activeTab === 'resources' && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error retrieving VPS status: {error}
        </div>
      )}

      {/* View Switcher */}
      {activeTab === 'security' ? (
        <VpsSecurity />
      ) : (
        <>
          {/* Telemetry Gauges */}
          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              {/* Disk */}
              <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Disk ({data.disk.filesystem})</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: data.disk.usedPercent > 80 ? '#f87171' : '#4ade80' }}>
                    {data.disk.usedPercent}%
                  </span>
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                  {data.disk.usedGb} GB <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>/ {data.disk.totalGb} GB</span>
                </div>
                <ProgressBar percent={data.disk.usedPercent} color={data.disk.usedPercent > 80 ? '#ef4444' : '#22c55e'} />
                <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 600 }}>
                  {data.disk.availableGb} GB free available
                </div>
              </div>

              {/* Memory */}
              <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>RAM Memory</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>{data.memory.usedPercent}%</span>
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                  {data.memory.usedGb} GB <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>/ {data.memory.totalGb} GB</span>
                </div>
                <ProgressBar percent={data.memory.usedPercent} color="#3b82f6" />
                <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Swap: {data.memory.swapUsedGb} GB / {data.memory.swapTotalGb} GB
                </div>
              </div>

              {/* CPU & Load */}
              <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>CPU Load Average</div>
                <div style={{ marginTop: '0.35rem', fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                  {data.loadAvg[0]} · {data.loadAvg[1]} · {data.loadAvg[2]}
                </div>
                <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#64748b' }}>
                  {data.cpuCores} vCPU Cores · Uptime: <strong style={{ color: '#cbd5e1' }}>{data.uptimeHuman}</strong>
                </div>
              </div>

              {/* Containers count */}
              <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Docker Containers</div>
                <div style={{ marginTop: '0.35rem', fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                  {(data.containers ?? []).filter((c) => c.state === 'running').length} active
                </div>
                <div style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#64748b' }}>
                  of {(data.containers ?? []).length} total containers
                </div>
              </div>
            </div>
          )}

          {/* One-Click Cleanup Shortcuts */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>
                  Safe One-Click Cleanup Shortcuts
                </h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Reclaim disk space without touching running containers or database records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runCleanup('all')}
                disabled={Boolean(cleaningTarget)}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: cleaningTarget ? 'wait' : 'pointer',
                }}
              >
                {cleaningTarget === 'all' ? 'Cleaning all...' : 'Run Full Cleanup'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>Docker Prune (Images & Build Cache)</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Removes dangling images and builder cache without affecting running containers or persistent volumes.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runCleanup('docker')}
                  disabled={Boolean(cleaningTarget)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    borderRadius: '7px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: cleaningTarget ? 'wait' : 'pointer',
                  }}
                >
                  {cleaningTarget === 'docker' ? 'Cleaning Docker...' : 'Clean Docker'}
                </button>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>Legacy VS Code Server Versions</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Retains only the latest active binary in <code>~/.vscode-server/cli/servers</code> and deletes older copies (~500 MB each).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runCleanup('vscode')}
                  disabled={Boolean(cleaningTarget)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    borderRadius: '7px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: cleaningTarget ? 'wait' : 'pointer',
                  }}
                >
                  {cleaningTarget === 'vscode' ? 'Cleaning...' : 'Clean VS Code Server'}
                </button>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>Package Caches (npm & pnpm)</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Clears <code>~/.npm/_cacache</code> and temporary pnpm store artifacts.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runCleanup('caches')}
                  disabled={Boolean(cleaningTarget)}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    borderRadius: '7px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: cleaningTarget ? 'wait' : 'pointer',
                  }}
                >
                  {cleaningTarget === 'caches' ? 'Cleaning...' : 'Clean Caches'}
                </button>
              </div>
            </div>

            {cleanupResult && (
              <div
                style={{
                  marginTop: '0.9rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  background: cleanupResult.ok ? '#064e3b' : '#450a0a',
                  border: `1px solid ${cleanupResult.ok ? '#047857' : '#991b1b'}`,
                  color: '#fff',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {cleanupResult.ok
                    ? `Freed ${cleanupResult.freedGb} GB of disk space (Reduced from ${cleanupResult.beforeUsedGb} GB to ${cleanupResult.afterUsedGb} GB)`
                    : 'Cleanup finished with errors'}
                </div>
                {cleanupResult.log && (
                  <pre
                    style={{
                      marginTop: '0.4rem',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      opacity: 0.9,
                    }}
                  >
                    {cleanupResult.log}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Storage Breakdown & Containers Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
            {/* Top Directories */}
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                Heavy Directories Breakdown
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {(data?.topDirectories ?? []).map((dir) => (
                  <div
                    key={dir.path}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#0f172a',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{dir.path}</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{dir.sizeHuman}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Docker Storage Breakdown */}
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                Docker Resource Footprint
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {(data?.dockerStorage ?? []).map((item) => (
                  <div
                    key={item.type}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#0f172a',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{item.type}</span>
                      <span style={{ color: '#64748b', marginLeft: '0.4rem', fontSize: '0.76rem' }}>
                        ({item.active}/{item.totalCount} active)
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{item.size}</span>
                      {item.reclaimable !== '0B' && item.reclaimable !== '0' && (
                        <span style={{ color: '#4ade80', fontSize: '0.74rem', marginLeft: '0.5rem' }}>
                          ({item.reclaimable} reclaimable)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Docker Containers Table */}
          {data && (
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                  Active Docker Containers
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {(data.containers ?? []).length} registered on daemon
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Container Name</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Image</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>State</th>
                      <th style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.containers ?? []).map((c) => (
                      <tr key={c.name} style={{ borderBottom: '1px solid #0f172a' }}>
                        <td style={{ padding: '0.6rem', fontWeight: 600, color: '#f8fafc' }}>{c.name}</td>
                        <td style={{ padding: '0.6rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {c.image}
                        </td>
                        <td style={{ padding: '0.6rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.18rem 0.55rem',
                              borderRadius: '999px',
                              background: c.state === 'running' ? '#052e16' : '#450a0a',
                              color: c.state === 'running' ? '#4ade80' : '#f87171',
                              border: `1px solid ${c.state === 'running' ? '#166534' : '#991b1b'}`,
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {c.state}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem', color: '#cbd5e1', fontSize: '0.78rem' }}>
                          {c.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
