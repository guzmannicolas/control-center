import { useEffect, useState } from 'react';

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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

function ProgressBar({ percent, color }: { percent: number; color: string }) {
 return (
 <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden', marginTop: '0.5rem' }}>
 <div style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
 </div>
 );
}

export function VpsPage() {
 const [data, setData] = useState<VpsStatusView | null>(null);
 const [loading, setLoading] = useState(true);
 const [cleaningTarget, setCleaningTarget] = useState<string | null>(null);
 const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
 const [error, setError] = useState<string | null>(null);

 const loadStatus = async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch(`${API_BASE}/api/vps/status`, { credentials: 'include' });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 setData((await res.json()) as VpsStatusView);
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
 const res = await fetch(`${API_BASE}/api/vps/cleanup`, {
 method: 'POST',
 credentials: 'include',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ target }),
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 const json = (await res.json()) as CleanupResult;
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
 <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc' }}>️ VPS Health & Maintenance</h1>
 <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
 Live telemetry for Contabo VPS (`173.212.224.70`), storage breakdown, Docker containers, and one-click cleanup shortcuts.
 </p>
 </div>

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
 cursor: 'pointer',
 }}
 >
 {loading ? 'Refreshing...' : '↻ Refresh Status'}
 </button>
 </div>

 {error && (
 <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
 Error retrieving VPS status: {error}
 </div>
 )}

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
 <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}> Safe One-Click Cleanup Shortcuts</h2>
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
 {cleaningTarget === 'all' ? '⏳ Cleaning all...' : ' Run Full Cleanup'}
 </button>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
 <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
 <div>
 <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}> Docker Prune (Images & Build Cache)</div>
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
 {cleaningTarget === 'docker' ? '⏳ Cleaning Docker...' : 'Clean Docker'}
 </button>
 </div>

 <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
 <div>
 <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}> Legacy VS Code Server Versions</div>
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
 {cleaningTarget === 'vscode' ? '⏳ Cleaning...' : 'Clean VS Code Server'}
 </button>
 </div>

 <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
 <div>
 <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}> Package Caches (npm & pnpm)</div>
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
 {cleaningTarget === 'caches' ? '⏳ Cleaning...' : 'Clean npm/pnpm Caches'}
 </button>
 </div>
 </div>

 {cleanupResult && (
 <div
 style={{
 marginTop: '1rem',
 background: '#052e16',
 border: '1px solid #166534',
 color: '#bbf7d0',
 padding: '0.85rem 1rem',
 borderRadius: '8px',
 fontSize: '0.83rem',
 }}
 >
 <strong>
 Cleanup completed ({cleanupResult.target}): Reclaimed {cleanupResult.freedGb} GB ({cleanupResult.beforeUsedGb} GB → {cleanupResult.afterUsedGb} GB used)
 </strong>
 <pre style={{ margin: '0.45rem 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.76rem', color: '#dcfce7' }}>
 {cleanupResult.log}
 </pre>
 </div>
 )}
 </div>

 {/* Two columns: Storage Breakdown & Docker System DF */}
 {data && (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
 {/* Directories */}
 <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
 <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
 Storage Usage by Directory (`/home/adminnico`)
 </div>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
 <thead>
 <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
 <th style={{ padding: '0.6rem 1rem' }}>Path</th>
 <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Size</th>
 </tr>
 </thead>
 <tbody>
 {(data.topDirectories ?? []).map((d) => (
 <tr key={d.path} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
 <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace' }}>{d.path}</td>
 <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#93c5fd' }}>
 {d.sizeHuman}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Docker System DF */}
 <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
 <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
 Docker Storage Usage (`docker system df`)
 </div>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
 <thead>
 <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
 <th style={{ padding: '0.6rem 0.9rem' }}>Type</th>
 <th style={{ padding: '0.6rem 0.9rem' }}>Total / Active</th>
 <th style={{ padding: '0.6rem 0.9rem' }}>Size</th>
 <th style={{ padding: '0.6rem 0.9rem' }}>Reclaimable</th>
 </tr>
 </thead>
 <tbody>
 {(data.dockerStorage ?? []).map((row) => (
 <tr key={row.type} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
 <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}>{row.type}</td>
 <td style={{ padding: '0.6rem 0.9rem', color: '#94a3b8' }}>
 {row.totalCount} ({row.active} active)
 </td>
 <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace' }}>{row.size}</td>
 <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#4ade80' }}>{row.reclaimable}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Containers list */}
 {data && (
 <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
 <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
 Containers Running on VPS
 </div>
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
 <thead>
 <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
 <th style={{ padding: '0.6rem 1rem' }}>Container</th>
 <th style={{ padding: '0.6rem 1rem' }}>Image</th>
 <th style={{ padding: '0.6rem 1rem' }}>Status</th>
 </tr>
 </thead>
 <tbody>
 {(data.containers ?? []).map((c) => (
 <tr key={c.name} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
 <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{c.name}</td>
 <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace', color: '#94a3b8' }}>{c.image}</td>
 <td style={{ padding: '0.6rem 1rem' }}>
 <span
 style={{
 fontSize: '0.75rem',
 padding: '0.18rem 0.55rem',
 borderRadius: '999px',
 background: c.state === 'running' ? '#052e16' : '#450a0a',
 color: c.state === 'running' ? '#4ade80' : '#f87171',
 border: `1px solid ${c.state === 'running' ? '#166534' : '#991b1b'}`,
 }}
 >
 ● {c.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
}
