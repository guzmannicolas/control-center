import { useEffect, useState } from 'react';
import type { SecurityCheckItem, SecurityCheckStatus, VpsSecurityAudit } from '@cc/shared';
import { api } from '../api.ts';

function getStatusBadge(status: SecurityCheckStatus) {
  switch (status) {
    case 'pass':
      return {
        label: 'PASS',
        bg: 'rgba(34, 197, 94, 0.12)',
        border: 'rgba(34, 197, 94, 0.35)',
        text: '#4ade80',
      };
    case 'warn':
      return {
        label: 'WARN',
        bg: 'rgba(234, 179, 8, 0.12)',
        border: 'rgba(234, 179, 8, 0.35)',
        text: '#facc15',
      };
    case 'fail':
      return {
        label: 'FAIL',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
        text: '#f87171',
      };
  }
}

function getSeverityBadge(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical':
      return { bg: '#450a0a', border: '#991b1b', text: '#fca5a5' };
    case 'high':
      return { bg: '#431407', border: '#9a3412', text: '#fdba74' };
    case 'medium':
      return { bg: '#422006', border: '#a16207', text: '#fde047' };
    case 'low':
      return { bg: '#064e3b', border: '#047857', text: '#6ee7b7' };
    default:
      return { bg: '#0f172a', border: '#334155', text: '#94a3b8' };
  }
}

export function VpsSecurity() {
  const [audit, setAudit] = useState<VpsSecurityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'issues' | 'ssh' | 'network' | 'docker' | 'system'>('all');

  const fetchSecurityAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.vpsSecurity();
      setAudit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSecurityAudit();
  }, []);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredChecks = (audit?.checks ?? []).filter((c) => {
    if (filter === 'issues') return c.status === 'fail' || c.status === 'warn';
    if (filter === 'ssh') return c.category === 'ssh' || c.category === 'auth';
    if (filter === 'network') return c.category === 'network' || c.category === 'firewall';
    if (filter === 'docker') return c.category === 'docker';
    if (filter === 'system') return c.category === 'system';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Host Context */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
            Host Security Posture & Hardening
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
            Provider-agnostic security audit evaluating SSH policies, firewall configuration, exposed listeners, container isolation, and system integrity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchSecurityAudit()}
          disabled={loading}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: '8px',
            padding: '0.5rem 0.95rem',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Evaluating Host...' : 'Re-run Security Audit'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error retrieving security audit: {error}
        </div>
      )}

      {/* Posture Score & KPI Cards */}
      {audit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Overall Score */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Hardening Score
            </div>
            <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: audit.score >= 90 ? '#4ade80' : audit.score >= 70 ? '#facc15' : '#f87171' }}>
                {audit.score}
              </span>
              <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 600 }}>/ 100</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: audit.score >= 90 ? '#4ade80' : '#facc15', fontWeight: 600, marginTop: '0.35rem' }}>
              {audit.score >= 90 ? 'Strongly Hardened' : audit.score >= 70 ? 'Moderate Protection' : 'Needs Immediate Hardening'}
            </div>
          </div>

          {/* Checks Summary */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Audited Rules
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
              {audit.summary.total}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.78rem' }}>
              <span style={{ color: '#4ade80', fontWeight: 600 }}>{audit.summary.passed} Passed</span>
              <span style={{ color: '#facc15', fontWeight: 600 }}>{audit.summary.warned} Warnings</span>
              <span style={{ color: '#f87171', fontWeight: 600 }}>{audit.summary.failed} Failed</span>
            </div>
          </div>

          {/* Operating System Context */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Detected Platform
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              {audit.osInfo.distro}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
              Kernel {audit.osInfo.kernel} ({audit.osInfo.arch})
            </div>
          </div>

          {/* Active Host Node */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Inspected Host Node
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
              {audit.hostname}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
              Last evaluated: {new Date(audit.evaluatedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Filter Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
        {[
          { id: 'all', label: 'All Checks' },
          { id: 'issues', label: `Issues (${(audit?.summary.warned ?? 0) + (audit?.summary.failed ?? 0)})` },
          { id: 'ssh', label: 'SSH & Authentication' },
          { id: 'network', label: 'Firewall & Network' },
          { id: 'docker', label: 'Docker Isolation' },
          { id: 'system', label: 'System & Patches' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            style={{
              background: filter === tab.id ? '#1e293b' : 'transparent',
              border: filter === tab.id ? '1px solid #334155' : '1px solid transparent',
              color: filter === tab.id ? '#38bdf8' : '#94a3b8',
              borderRadius: '7px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Checks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredChecks.map((item: SecurityCheckItem) => {
          const statusStyle = getStatusBadge(item.status);
          const sevStyle = getSeverityBadge(item.severity);

          return (
            <div
              key={item.id}
              style={{
                background: '#0b0f19',
                border: `1px solid ${item.status === 'fail' ? '#7f1d1d' : item.status === 'warn' ? '#78350f' : '#1e293b'}`,
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {/* Status Badge */}
                  <span
                    style={{
                      background: statusStyle.bg,
                      border: `1px solid ${statusStyle.border}`,
                      color: statusStyle.text,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {statusStyle.label}
                  </span>

                  {/* Severity Badge */}
                  <span
                    style={{
                      background: sevStyle.bg,
                      border: `1px solid ${sevStyle.border}`,
                      color: sevStyle.text,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.18rem 0.45rem',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.severity}
                  </span>

                  <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    {item.category}
                  </span>

                  <h3 style={{ margin: 0, fontSize: '0.96rem', color: '#f8fafc', fontWeight: 700 }}>
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Summary and Details */}
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>
                {item.summary}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {item.details}
              </div>

              {/* Remediation snippet if present */}
              {item.remediation && (
                <div
                  style={{
                    marginTop: '0.4rem',
                    background: '#030712',
                    border: '1px solid #1f2937',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Remediation Script (Run on VPS)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.remediation!)}
                      style={{
                        background: copiedId === item.id ? '#065f46' : '#1e293b',
                        border: '1px solid #334155',
                        color: copiedId === item.id ? '#6ee7b7' : '#e2e8f0',
                        borderRadius: '6px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {copiedId === item.id ? 'Copied to Clipboard' : 'Copy Bash Fix'}
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.78rem',
                      color: '#a7f3d0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.remediation}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        {filteredChecks.length === 0 && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#0b0f19', borderRadius: '12px' }}>
            No security checks matching the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
