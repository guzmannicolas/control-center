import { useEffect, useState } from 'react';

interface BackupFileEntry {
  name: string;
  sizeBytes: number;
  sizeHuman: string;
  modifiedAt: string;
  ageHours: number;
  kind: 'full-tar' | 'postgres-sql' | 'meta-json' | 'other';
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
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

export function BackupsPage() {
  const [data, setData] = useState<BackupsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [runResult, setRunResult] = useState<{ ok: boolean; output: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const statusColors = {
    ok: { bg: '#052e16', border: '#166534', text: '#4ade80', label: 'SALUDABLE (< 26h)' },
    warning: { bg: '#422006', border: '#854d0e', text: '#facc15', label: 'ATENCIÓN' },
    critical: { bg: '#450a0a', border: '#991b1b', text: '#f87171', label: 'CRÍTICO (> 50h)' },
  };

  const badge = statusColors[data?.status ?? 'warning'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc' }}>💾 Backups & Recuperación</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
             Copias de seguridad de Postgres (Directus CMS), volúmenes de archivos y sincronización con Google Drive (`gcrypt`).
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
            ↻ Refrescar
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
            {runningBackup ? '⏳ Ejecutando Backup...' : '▶ Ejecutar Backup Ahora'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error al consultar backups: {error}
        </div>
      )}

      {data?.rcloneNotice && (
        <div style={{ background: '#422006', border: '1px solid #854d0e', color: '#fde68a', padding: '0.9rem 1rem', borderRadius: '10px', fontSize: '0.88rem' }}>
          ⚠️ <strong>Aviso de Sincronización en la Nube (rclone):</strong> {data.rcloneNotice}
          <div style={{ marginTop: '0.35rem', color: '#fef08a', fontSize: '0.8rem' }}>
            Los backups locales en el VPS se están guardando correctamente todos los días, pero para reactivar la subida a Google Drive podés reconectar el token ejecutando <code>rclone config reconnect gdrive:</code> en la pestaña Terminal.
          </div>
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
          <strong>{runResult.ok ? '✔ Backup ejecutado:' : '✖ Error ejecutando backup:'}</strong>
          <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.78rem' }}>
            {runResult.output}
          </pre>
        </div>
      )}

      {/* KPI Cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Estado General</div>
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
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Último Backup</div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
              {data.latestAgeHours !== null ? `Hace ${data.latestAgeHours}h` : 'Sin backups'}
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>
              {data.latestBackupAt ? new Date(data.latestBackupAt).toLocaleString() : '—'}
            </div>
          </div>

          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Espacio en Backups</div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>{data.totalSizeHuman}</div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#64748b' }}>{data.files.length} archivos en retención</div>
          </div>

          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Ruta & Destino</div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
              {data.backupDir}
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.76rem', color: '#64748b' }}>{data.destination}</div>
          </div>
        </div>
      )}

      {/* Files table */}
      {data && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
            Archivos de Backup en el VPS
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 1rem' }}>Archivo</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Tipo</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Tamaño</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Antigüedad</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(data.files ?? []).map((f) => (
                  <tr key={f.name} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{f.name}</td>
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
                    <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>hace {f.ageHours}h</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>{new Date(f.modifiedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backup Log */}
      {data && data.recentLogLines.length > 0 && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.8rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
            Registro reciente (`backup.log`)
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
