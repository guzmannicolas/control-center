import { useEffect, useState } from 'react';
import type { DeploymentOverview, DeploymentRecord } from '@cc/shared';
import { api } from '../api.ts';

export function DeploysPage() {
  const [data, setData] = useState<DeploymentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual Trigger Modal
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [triggering, setTriggering] = useState(false);

  // Log View Modal
  const [viewingRecord, setViewingRecord] = useState<DeploymentRecord | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.deployments();
      setData(res);
      if (res.availableRepos.length > 0 && !selectedRepo) {
        setSelectedRepo(res.availableRepos[0] ?? 'control-center');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || triggering) return;
    setTriggering(true);
    try {
      const res = await api.triggerDeployment(selectedRepo, branch);
      setShowTriggerModal(false);
      await loadData(true);
      if (res.deployment) {
        setViewingRecord(res.deployment);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const getStatusBadge = (status: DeploymentRecord['status']) => {
    switch (status) {
      case 'success':
        return { label: '✔ SUCCESS', bg: '#052e16', color: '#4ade80', border: '#166534' };
      case 'failed':
        return { label: '✖ FAILED', bg: '#450a0a', color: '#f87171', border: '#991b1b' };
      case 'running':
        return { label: '⏳ RUNNING', bg: '#1e3a8a', color: '#93c5fd', border: '#2563eb' };
      case 'queued':
      default:
        return { label: '● QUEUED', bg: '#1e293b', color: '#94a3b8', border: '#334155' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="emoji-bw">🚀</span> VPS Deployments & CI/CD
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Automated GitHub webhook triggers, branch pull, and Docker Compose builds on the VPS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void loadData()}
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
            ↻ Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowTriggerModal(true)}
            style={{
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span className="emoji-bw">⚡</span> Trigger Manual Deploy
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error loading deployments: {error}
        </div>
      )}

      {/* Webhook Info Card */}
      {data && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="emoji-bw">🔗</span> GitHub Webhook Auto-Deploy Endpoint
              </div>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: '#94a3b8', maxWidth: '680px' }}>
                Configure this webhook in your GitHub repository (<code style={{ color: '#93c5fd' }}>Settings → Webhooks</code>) to trigger automatic deployments on every push to <code style={{ color: '#4ade80' }}>main</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(`${data.webhookUrl}/<repo-name>`)}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: copiedWebhook ? '#4ade80' : '#e2e8f0',
                borderRadius: '7px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedWebhook ? '✔ Copied to Clipboard' : '📋 Copy Webhook URL'}
            </button>
          </div>

          <div style={{ marginTop: '0.75rem', background: '#070a12', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.6rem 0.9rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#38bdf8', overflowX: 'auto' }}>
            POST {data.webhookUrl}/&lt;repository-name&gt;
          </div>
        </div>
      )}

      {/* Deployments List */}
      <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
          Deployment History
        </div>

        {data?.recentDeployments.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
            No deployments recorded yet. Trigger a manual deploy above or send a GitHub push webhook.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Repository</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Branch</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Commit / Message</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Triggered By</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Duration</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentDeployments ?? []).map((dep) => {
                  const badge = getStatusBadge(dep.status);
                  const durationSec = dep.durationMs ? `${(dep.durationMs / 1000).toFixed(1)}s` : '—';
                  const dateStr = new Date(dep.startedAt).toLocaleString();

                  return (
                    <tr key={dep.id} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {dep.repo}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {dep.branch}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', maxWidth: '300px' }}>
                        {dep.commitHash && (
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#1e293b', padding: '0.12rem 0.4rem', borderRadius: '4px', marginRight: '0.4rem', color: '#93c5fd' }}>
                            {dep.commitHash}
                          </span>
                        )}
                        <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {dep.commitMessage || 'Automated deployment trigger'}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                          {dateStr}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#e2e8f0' }}>{dep.trigger}</span>
                        {dep.author && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dep.author}</div>}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {durationSec}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setViewingRecord(dep)}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#93c5fd',
                            borderRadius: '6px',
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Trigger Modal */}
      {showTriggerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="emoji-bw">⚡</span> Trigger Manual VPS Deployment
              </div>
              <button
                type="button"
                onClick={() => setShowTriggerModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleManualTrigger(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Target Repository:
                </label>
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.55rem', fontSize: '0.85rem' }}
                >
                  {(data?.availableRepos ?? []).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Git Branch:
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTriggerModal(false)}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '7px', padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggering}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', borderRadius: '7px', padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: triggering ? 'wait' : 'pointer' }}
                >
                  {triggering ? 'Launching...' : 'Deploy Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Build Logs Modal */}
      {viewingRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ background: '#070a12', border: '1px solid #1e293b', borderRadius: '12px', width: '100%', maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', background: '#0b0f19', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                  Deployment Log — {viewingRecord.repo} ({viewingRecord.branch})
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.6rem' }}>
                  ID: {viewingRecord.id}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => copyToClipboard(viewingRecord.log)}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {copiedWebhook ? '✔ Copied' : 'Copy Log'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewingRecord(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer', padding: '0 0.3rem' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <pre style={{ margin: 0, padding: '1rem', overflowY: 'auto', flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', color: '#d1d5db', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {viewingRecord.log}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
