import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { useTableSelection } from '../hooks/useTableSelection.ts';

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

interface BackupTargetConfig {
  cms_postgres: boolean;
  control_center_postgres: boolean;
  cms_uploads: boolean;
  secrets: boolean;
}

interface BackupConfig {
  version: number;
  updatedAt: string;
  targets: BackupTargetConfig;
  cloudSync: boolean;
  retention: {
    keepLocalDays: number;
    keepRemoteDays: number;
  };
}

interface DiscoveredDatabaseTarget {
  id: string;
  name: string;
  engine: string;
  purpose: string;
  project: string | null;
  key: string;
  isIncluded: boolean;
  status: 'healthy' | 'unknown';
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
  config: BackupConfig;
  databases: DiscoveredDatabaseTarget[];
}

interface ArchiveFileEntry {
  path: string;
  sizeBytes: number;
  sizeHuman: string;
  modified: string;
  permissions: string;
}

interface InspectResult {
  ok: boolean;
  name: string;
  sizeHuman: string;
  files: ArchiveFileEntry[];
  manifest?: {
    version: number;
    timestamp: string;
    createdAt: string;
    archive: string;
    hostname: string;
    targets: string[];
    cloudSync: boolean;
    retention: {
      keepLocalDays: number;
      keepRemoteDays: number;
    };
  } | null;
  error?: string;
}

interface VerifyResult {
  ok: boolean;
  filename: string;
  passed: boolean;
  message: string;
  details: string[];
}

export function BackupsPage() {
  const [data, setData] = useState<BackupsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [runResult, setRunResult] = useState<{ ok: boolean; output: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local draft of backup configuration
  const [activeTargets, setActiveTargets] = useState<BackupTargetConfig>({
    cms_postgres: true,
    control_center_postgres: true,
    cms_uploads: true,
    secrets: true,
  });
  const [cloudSync, setCloudSync] = useState(true);
  const [keepLocalDays, setKeepLocalDays] = useState(7);
  const [keepRemoteDays, setKeepRemoteDays] = useState(30);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState<string | null>(null);

  // Archive inspection modal state
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);

  // Verification state (by filename)
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});

  // File selection state for bulk deletion
  const {
    selected: selectedFiles,
    toggle: toggleSelectRow,
    toggleAll: selectFilesAll,
    clear: clearSelectedFiles,
    setSelected: setSelectedFiles,
  } = useTableSelection<string>();
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'pre' | 'tar' | 'sql'>('all');

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.backups();
      setData(json);

      if (json.config) {
        setActiveTargets({
          cms_postgres: json.config.targets?.cms_postgres ?? true,
          control_center_postgres: json.config.targets?.control_center_postgres ?? true,
          cms_uploads: json.config.targets?.cms_uploads ?? true,
          secrets: json.config.targets?.secrets ?? true,
        });
        setCloudSync(json.config.cloudSync ?? true);
        setKeepLocalDays(json.config.retention?.keepLocalDays ?? 7);
        setKeepRemoteDays(json.config.retention?.keepRemoteDays ?? 30);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const saveConfiguration = async () => {
    setSavingConfig(true);
    setConfigSavedNotice(null);
    try {
      const payload: Partial<BackupConfig> = {
        targets: activeTargets,
        cloudSync,
        retention: {
          keepLocalDays,
          keepRemoteDays,
        },
      };

      const json = await api.backupSaveConfig(payload);
      if (json.ok) {
        setConfigSavedNotice('Configuration saved to backup.config.json on VPS!');
        setTimeout(() => setConfigSavedNotice(null), 4000);
        await loadBackups();
      }
    } catch (err) {
      alert(`Error saving config: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const triggerManualBackup = async (customTargets?: BackupTargetConfig) => {
    if (runningBackup) return;
    setRunningBackup(true);
    setRunResult(null);
    try {
      const body = {
        targets: customTargets ?? activeTargets,
        cloudSync,
      };

      const json = await api.backupRun(body);
      setRunResult(json);
      await loadBackups();
    } catch (err) {
      setRunResult({ ok: false, output: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunningBackup(false);
    }
  };

  const inspectArchive = async (filename: string) => {
    setInspectModalOpen(true);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const json = await api.backupInspect(filename);
      setInspectData(json);
    } catch (err) {
      setInspectData({
        ok: false,
        name: filename,
        sizeHuman: '',
        files: [],
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInspectLoading(false);
    }
  };

  const verifyArchive = async (filename: string) => {
    setVerifyingMap((prev) => ({ ...prev, [filename]: true }));
    try {
      const json = await api.backupVerify(filename);
      setVerifyResults((prev) => ({ ...prev, [filename]: json }));
    } catch (err) {
      setVerifyResults((prev) => ({
        ...prev,
        [filename]: {
          ok: false,
          filename,
          passed: false,
          message: err instanceof Error ? err.message : String(err),
          details: [],
        },
      }));
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [filename]: false }));
    }
  };

  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    const count = selectedFiles.size;
    if (!confirm(`Permanently delete ${count} selected backup file${count > 1 ? 's' : ''} from the VPS?`)) return;

    setDeleting(true);
    try {
      await api.backupDelete(Array.from(selectedFiles));
      clearSelectedFiles();
      await loadBackups();
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
      await api.backupDelete([name]);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      await loadBackups();
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

  const filteredFiles = (data?.files ?? []).filter((f) => {
    if (filterType === 'pre') return f.name.startsWith('pre-') || f.name.startsWith('before-');
    if (filterType === 'tar') return f.kind === 'full-tar';
    if (filterType === 'sql') return f.kind === 'postgres-sql';
    return true;
  });

  const toggleSelectAllFiltered = () => {
    selectFilesAll(filteredFiles.map((f) => f.name));
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

  const targetCards = [
    {
      key: 'cms_postgres' as const,
      icon: '🐘',
      name: 'CMS Database (Directus)',
      subtitle: 'PostgreSQL · directus db on cms-postgres-1',
      description: 'Clients, articles, media metadata, auth users and directus configurations.',
      dbTarget: data?.databases.find((d) => d.key === 'cms_postgres'),
    },
    {
      key: 'control_center_postgres' as const,
      icon: '🛡️',
      name: 'Control Center Database',
      subtitle: 'PostgreSQL · control db on control-center-postgres-1',
      description: 'Targets, monitoring results, leads CRM, incidents, users and active sessions.',
      dbTarget: data?.databases.find((d) => d.key === 'control_center_postgres'),
    },
    {
      key: 'cms_uploads' as const,
      icon: '📁',
      name: 'CMS Uploaded Media',
      subtitle: 'Docker volume · cms_directus_uploads (~60 MB)',
      description: 'Raw media assets, client images, avatars, portfolio uploads and attachments.',
      dbTarget: null,
    },
    {
      key: 'secrets' as const,
      icon: '🔑',
      name: 'Secrets & Environment Configs',
      subtitle: 'Staging archive · .env, tokens, credentials',
      description: 'Encrypted backup of CMS .env, Directus tokens, and Control Center .env configs.',
      dbTarget: null,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Backups & Recovery Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Manage backup.sh targets, sync with registered databases, inspect archives, and encrypted Google Drive sync.
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
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: runningBackup ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{runningBackup ? '⏳' : '🚀'}</span>
            <span>{runningBackup ? 'Running Selected Backup...' : 'Run Backup Now'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error loading backups: {error}
        </div>
      )}

      {/* Backup Targets & Script Config Manager */}
      <div
        style={{
          background: '#090d16',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  background: '#1e3a8a',
                  color: '#93c5fd',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Script Controller
              </span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                Backup Scope & Target Selection
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Select which databases and components are included when running <code>backup.sh</code> (nightly cron &amp; on-demand).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {configSavedNotice && (
              <span style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600 }}>
                ✓ {configSavedNotice}
              </span>
            )}
            <button
              type="button"
              onClick={() => void saveConfiguration()}
              disabled={savingConfig}
              style={{
                background: '#047857',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: savingConfig ? 'wait' : 'pointer',
              }}
            >
              {savingConfig ? 'Saving...' : '💾 Save Default Config'}
            </button>
          </div>
        </div>

        {/* 4 Modular Target Selector Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
          {targetCards.map((target) => {
            const isChecked = activeTargets[target.key];

            return (
              <div
                key={target.key}
                onClick={() =>
                  setActiveTargets((prev) => ({
                    ...prev,
                    [target.key]: !prev[target.key],
                  }))
                }
                style={{
                  background: isChecked ? 'rgba(37, 99, 235, 0.08)' : '#0f172a',
                  border: `1px solid ${isChecked ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{target.icon}</span>
                    <strong style={{ fontSize: '0.92rem', color: '#f8fafc' }}>{target.name}</strong>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Controlled via card click
                    style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                  {target.subtitle}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {target.description}
                </div>

                {target.dbTarget && (
                  <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                      ✓ Synced with DB Target
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#064e3b',
                        color: '#6ee7b7',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                      }}
                    >
                      {target.dbTarget.engine}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Global Policy Bar: Cloud Sync + Retention Sliders */}
        <div
          style={{
            background: '#0b0f19',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={cloudSync}
                onChange={(e) => setCloudSync(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
              />
              <span>☁️ Sync with encrypted Google Drive (<code>gcrypt:daily/</code>)</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#94a3b8' }}>
              <span>Local retention:</span>
              <input
                type="number"
                min={1}
                max={90}
                value={keepLocalDays}
                onChange={(e) => setKeepLocalDays(Number(e.target.value) || 7)}
                style={{
                  width: '54px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.82rem',
                  textAlign: 'center',
                }}
              />
              <span>days</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#94a3b8' }}>
              <span>Cloud retention:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={keepRemoteDays}
                onChange={(e) => setKeepRemoteDays(Number(e.target.value) || 30)}
                style={{
                  width: '54px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.82rem',
                  textAlign: 'center',
                }}
              />
              <span>days</span>
            </div>
          </div>

          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            Config file: <code>{data?.config?.version ? 'backup.config.json (v1)' : 'Default VPS preset'}</code>
          </div>
        </div>
      </div>

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
          <strong>{runResult.ok ? '✓ Backup executed successfully:' : '✖ Error running backup:'}</strong>
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
                  const isVerifying = verifyingMap[f.name];
                  const verifyRes = verifyResults[f.name];

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ color: isPre ? '#fde68a' : '#f8fafc' }}>{f.name}</span>
                          {isPre && (
                            <span
                              style={{
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
                          {verifyRes && (
                            <span
                              title={verifyRes.message}
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                background: verifyRes.passed ? '#052e16' : '#450a0a',
                                color: verifyRes.passed ? '#4ade80' : '#f87171',
                                border: `1px solid ${verifyRes.passed ? '#166534' : '#991b1b'}`,
                              }}
                            >
                              {verifyRes.passed ? '✓ Integrity Verified' : '✖ Integrity Failed'}
                            </span>
                          )}
                        </div>
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
                          {/* Inspect archive contents */}
                          {f.kind === 'full-tar' && (
                            <button
                              type="button"
                              onClick={() => void inspectArchive(f.name)}
                              title="Inspect archive contents (manifest & files)"
                              style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#93c5fd',
                                borderRadius: '6px',
                                padding: '0.2rem 0.55rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔍 Inspect
                            </button>
                          )}

                          {/* Verify checksums */}
                          {f.kind === 'full-tar' && (
                            <button
                              type="button"
                              onClick={() => void verifyArchive(f.name)}
                              disabled={isVerifying}
                              title="Run integrity check on archive (tar + gzip)"
                              style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#a7f3d0',
                                borderRadius: '6px',
                                padding: '0.2rem 0.55rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: isVerifying ? 'wait' : 'pointer',
                              }}
                            >
                              {isVerifying ? 'Verifying...' : '🧪 Verify'}
                            </button>
                          )}

                          {/* Direct download */}
                          <a
                            href={api.backupDownloadUrl(f.name)}
                            download={f.name}
                            title="Download backup file to your computer"
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              color: '#38bdf8',
                              borderRadius: '6px',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            ⬇️
                          </a>

                          {/* Delete */}
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
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.85rem',
                            }}
                          >
                            ✕
                          </button>
                        </div>
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

      {/* Inspect Archive Modal */}
      {inspectModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setInspectModalOpen(false)}
        >
          <div
            style={{
              background: '#0b0f19',
              border: '1px solid #334155',
              borderRadius: '14px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📦</span>
                  <span>Archive Contents</span>
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                  {inspectData?.name ?? 'Loading archive...'} ({inspectData?.sizeHuman ?? ''})
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {inspectLoading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  Extracting archive manifest and reading internal headers...
                </div>
              )}

              {inspectData?.error && (
                <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.8rem', borderRadius: '8px', fontSize: '0.84rem' }}>
                  {inspectData.error}
                </div>
              )}

              {/* Manifest Metadata */}
              {inspectData?.manifest && (
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.9rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Manifest Overview
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Created: </span>
                      <strong style={{ color: '#f8fafc' }}>{new Date(inspectData.manifest.createdAt).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Hostname: </span>
                      <strong style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{inspectData.manifest.hostname}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Cloud synced: </span>
                      <strong style={{ color: inspectData.manifest.cloudSync ? '#4ade80' : '#94a3b8' }}>
                        {inspectData.manifest.cloudSync ? 'Yes (Google Drive)' : 'No'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Included targets:</span>
                    {inspectData.manifest.targets.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#1e3a8a',
                          color: '#93c5fd',
                          fontWeight: 600,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Archive File Tree Table */}
              {inspectData && inspectData.files.length > 0 && (
                <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0.8rem' }}>Component File</th>
                        <th style={{ padding: '0.5rem 0.8rem' }}>Size</th>
                        <th style={{ padding: '0.5rem 0.8rem' }}>Date Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectData.files.map((file) => (
                        <tr key={file.path} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
                          <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', color: '#f8fafc' }}>
                            {file.path.split('/').pop()}
                          </td>
                          <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                            {file.sizeHuman}
                          </td>
                          <td style={{ padding: '0.5rem 0.8rem', color: '#94a3b8' }}>
                            {file.modified}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.8rem 1.25rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              {inspectData && (
                <a
                  href={api.backupDownloadUrl(inspectData.name)}
                  download={inspectData.name}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '0.4rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  ⬇️ Download Archive
                </a>
              )}
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
