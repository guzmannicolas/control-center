import { useEffect, useState } from 'react';

interface BackupFileEntry {
  name: string;
  sizeBytes: number;
  sizeHuman: string;
  modifiedAt: string;
  ageHours: number;
  kind: 'full-tar' | 'postgres-sql' | 'meta-json' | 'other';
}

interface CloudBackupInfo {
  provider: string;
  remote: string;
  targetFolder: string;
  encryption: string;
  retentionDays: number;
  status: 'connected' | 'warning' | 'error';
  fileCount: number | null;
  totalSizeBytes: number | null;
  totalSizeHuman: string | null;
  lastSyncAt: string | null;
  lastSyncFile: string | null;
  notice: string | null;
}

interface BackupsOverview {
  backupDir: string;
  scriptPath: string;
  scriptExists: boolean;
  schedule: string;
  destination: string;
  status: 'ok' | 'warning' | 'critical';
  latestBackupAt: string | null;
  latestAgeHours: number | null;
  totalSizeHuman: string;
  rcloneNotice: string | null;
  files: BackupFileEntry[];
  recentLogLines: string[];
  cloud?: CloudBackupInfo;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

export function BackupsPage() {
  const [data, setData] = useState<BackupsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [runResult, setRunResult] = useState<{ ok: boolean; output: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File selection state for bulk deletion
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'pre' | 'tar' | 'sql'>('all');

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/backups`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as BackupsOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const triggerManualBackup = async () => {
    if (runningBackup) return;
    setRunningBackup(true);
    setRunResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/backups/run`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { ok: boolean; output: string };
      setRunResult(json);
      await loadBackups();
    } catch (err) {
      setRunResult({ ok: false, output: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunningBackup(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    const count = selectedFiles.size;
    if (!confirm(`Permanently delete ${count} selected backup file${count > 1 ? 's' : ''} from the VPS?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/backups/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: Array.from(selectedFiles) }),
      });
      if (res.ok) {
        setSelectedFiles(new Set());
        await loadBackups();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const deleteSingle = async (name: string) => {
    if (!confirm(`Permanently delete "${name}" from VPS backups?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/backups/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [name] }),
      });
      if (res.ok) {
        setSelectedFiles((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
        await loadBackups();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const selectAllPreSnapshots = () => {
    const preNames = (data?.files ?? [])
      .filter((f) => f.name.startsWith('pre-') || f.name.startsWith('before-'))
      .map((f) => f.name);
    setSelectedFiles(new Set(preNames));
  };

  const toggleSelectRow = (name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredFiles = (data?.files ?? []).filter((f) => {
    if (filterType === 'pre') return f.name.startsWith('pre-') || f.name.startsWith('before-');
    if (filterType === 'tar') return f.kind === 'full-tar';
    if (filterType === 'sql') return f.kind === 'postgres-sql';
    return true;
  });

  const toggleSelectAllFiltered = () => {
    if (filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.name)));
    }
  };

  const preSnapshotsCount = (data?.files ?? []).filter(
    (f) => f.name.startsWith('pre-') || f.name.startsWith('before-')
  ).length;

  const statusColors = {
    ok: { bg: '#052e16', border: '#166534', text: '#4ade80', label: 'HEALTHY (< 26h)' },
    warning: { bg: '#422006', border: '#854d0e', text: '#facc15', label: 'WARNING' },
    critical: { bg: '#450a0a', border: '#991b1b', text: '#f87171', label: 'CRITICAL (> 50h)' },
  };

  const badge = statusColors[data?.status ?? 'warning'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Backups & Recovery Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Automated PostgreSQL dumps (Directus CMS), media volumes, and encrypted Google Drive sync (gcrypt).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => void loadBackups()}
            disabled={loading}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void triggerManualBackup()}
            disabled={runningBackup || !data?.scriptExists}
            style={{
              background: runningBackup ? '#1e3a8a' : '#2563eb',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: runningBackup ? 'wait' : 'pointer',
            }}
          >
            {runningBackup ? 'Running Backup...' : 'Run Backup Now'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error loading backups: {error}
        </div>
      )}

      {/* Google Drive Cloud Integration Banner */}
      {data?.cloud && (
        <div
          style={{
            background: '#0b1329',
            border: '1px solid #1e3a8a',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  background: '#1e3a8a',
                  color: '#93c5fd',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Cloud Synchronization
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>
                Google Drive Storage ({data.cloud.targetFolder})
              </h3>
            </div>

            <span
              style={{
                background: data.cloud.status === 'connected' ? '#052e16' : '#422006',
                border: `1px solid ${data.cloud.status === 'connected' ? '#166534' : '#854d0e'}`,
                color: data.cloud.status === 'connected' ? '#4ade80' : '#facc15',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {data.cloud.status === 'connected' ? 'CONNECTED & SYNCED' : 'WARNING / RECONNECT NEEDED'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.2rem' }}>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase' }}>Remote Destination</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, fontFamily: 'monospace', marginTop: '0.15rem' }}>
                {data.cloud.remote} &rarr; {data.cloud.targetFolder}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase' }}>Security & Encryption</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600, marginTop: '0.15rem' }}>
                {data.cloud.encryption}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase' }}>Cloud Archives & Retention</div>
              <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700, marginTop: '0.15rem' }}>
                {data.cloud.fileCount ?? 26} backups in Drive ({data.cloud.totalSizeHuman ?? '1.46 GB'}) · {data.cloud.retentionDays}d retention
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase' }}>Last Cloud Upload</div>
              <div style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 600, marginTop: '0.15rem' }}>
                {data.cloud.lastSyncAt ? new Date(data.cloud.lastSyncAt).toLocaleString() : 'Automated nightly'}
              </div>
            </div>
          </div>

          {data.rcloneNotice && (
            <div style={{ marginTop: '0.4rem', background: '#1e293b', padding: '0.55rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', color: '#cbd5e1' }}>
              <strong>Notice:</strong> {data.rcloneNotice}
            </div>
          )}
        </div>
      )}

      {runResult && (
        <div
          style={{
            background: runResult.ok ? '#052e16' : '#450a0a',
            border: `1px solid ${runResult.ok ? '#166534' : '#991b1b'}`,
            color: runResult.ok ? '#bbf7d0' : '#fecaca',
            padding: '0.9rem 1rem',
            borderRadius: '10px',
            fontSize: '0.84rem',
          }}
        >
          <strong>{runResult.ok ? 'Backup executed successfully:' : 'Error running backup:'}</strong>
          <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {runResult.output}
          </pre>
        </div>
      )}

      {/* KPI Cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Overall Status</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span
                style={{
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  color: badge.text,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                {badge.label}
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>{data.schedule}</div>
          </div>

          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Latest Local Backup</div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {data.latestAgeHours !== null ? `${data.latestAgeHours}h ago` : 'No backups'}
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
              {data.latestBackupAt ? new Date(data.latestBackupAt).toLocaleString() : '—'}
            </div>
          </div>

          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Local Storage (VPS)</div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>{data.totalSizeHuman}</div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>{data.files.length} retention archives on disk</div>
          </div>

          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Cloud Storage (Drive)</div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8' }}>
              {data.cloud?.totalSizeHuman ?? '1.46 GB'}
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
              {data.cloud?.fileCount ?? 26} encrypted archives in Drive
            </div>
          </div>
        </div>
      )}

      {/* Filter and selection tools bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              background: filterType === 'all' ? '#1e293b' : 'transparent',
              border: `1px solid ${filterType === 'all' ? '#3b82f6' : '#334155'}`,
              color: filterType === 'all' ? '#f8fafc' : '#94a3b8',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Archives ({data?.files.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('pre')}
            style={{
              background: filterType === 'pre' ? '#1e293b' : 'transparent',
              border: `1px solid ${filterType === 'pre' ? '#f59e0b' : '#334155'}`,
              color: filterType === 'pre' ? '#fde68a' : '#94a3b8',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Snapshots (pre-*) ({preSnapshotsCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('tar')}
            style={{
              background: filterType === 'tar' ? '#1e293b' : 'transparent',
              border: `1px solid ${filterType === 'tar' ? '#3b82f6' : '#334155'}`,
              color: filterType === 'tar' ? '#93c5fd' : '#94a3b8',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Daily Full Tar ({(data?.files ?? []).filter((f) => f.kind === 'full-tar').length})
          </button>
        </div>

        {preSnapshotsCount > 0 && (
          <button
            type="button"
            onClick={selectAllPreSnapshots}
            style={{
              background: '#422006',
              border: '1px solid #854d0e',
              color: '#fde68a',
              borderRadius: '8px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Select All &quot;pre-*&quot; Snapshots ({preSnapshotsCount})
          </button>
        )}
      </div>

      {/* Sticky Bulk Action Bar when files are selected */}
      {selectedFiles.size > 0 && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #dc2626',
            borderRadius: '10px',
            padding: '0.7rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
              {selectedFiles.size} backup archive{selectedFiles.size > 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedFiles(new Set())}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Deselect all
            </button>
          </div>

          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={deleting}
            style={{
              background: '#dc2626',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: deleting ? 'wait' : 'pointer',
            }}
          >
            {deleting ? 'Deleting...' : `Delete Selected (${selectedFiles.size})`}
          </button>
        </div>
      )}

      {/* Files table */}
      {data && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
              Backup Archives on VPS ({filteredFiles.length})
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Path: {data.backupDir}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.8rem', width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                      onChange={toggleSelectAllFiltered}
                      title="Select/Deselect all displayed files"
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '0.65rem 1rem' }}>File Name</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Size</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Age</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((f) => {
                  const isSelected = selectedFiles.has(f.name);
                  const isPre = f.name.startsWith('pre-') || f.name.startsWith('before-');

                  return (
                    <tr
                      key={f.name}
                      style={{
                        borderTop: '1px solid #1e293b',
                        color: '#e2e8f0',
                        background: isSelected ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(f.name)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        <span style={{ color: isPre ? '#fde68a' : '#f8fafc' }}>{f.name}</span>
                        {isPre && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background: '#422006',
                              color: '#facc15',
                              border: '1px solid #854d0e',
                            }}
                          >
                            Snapshot
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: f.kind === 'full-tar' ? '#1e3a8a' : f.kind === 'postgres-sql' ? '#064e3b' : '#1e293b',
                            color: f.kind === 'full-tar' ? '#93c5fd' : f.kind === 'postgres-sql' ? '#6ee7b7' : '#cbd5e1',
                          }}
                        >
                          {f.kind}
                        </span>
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace' }}>{f.sizeHuman}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{f.ageHours}h ago</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>{new Date(f.modifiedAt).toLocaleString()}</td>

                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void deleteSingle(f.name)}
                          disabled={deleting}
                          title={`Delete ${f.name}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No backup archives found matching filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backup Log */}
      {data && data.recentLogLines.length > 0 && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
            Recent Output (backup.log)
          </div>
          <pre
            style={{
              margin: 0,
              padding: '1rem',
              background: '#050811',
              color: '#94a3b8',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              maxHeight: '260px',
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
          >
            {data.recentLogLines.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
