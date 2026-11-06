import { useEffect, useState } from 'react';

interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  nodeVersion: string | null;
  updatedAt: string;
  repo: string | null;
  productionUrl: string | null;
  domains: string[];
  latestDeployment: {
    id: string;
    url: string;
    state: 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED' | string;
    target: string | null;
    createdAt: string;
    readyAt: string | null;
    commitMessage: string | null;
    commitSha: string | null;
    branch: string | null;
    errorMessage: string | null;
  } | null;
}

interface VercelResponse {
  configured: boolean;
  projects: VercelProjectSummary[];
  fetchedAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

function formatRelative(iso: string | null | undefined) {
  if (!iso) return '—';
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.round(diffHr / 24);
  return `hace ${diffDays}d`;
}

function stateBadge(state: string | undefined) {
  switch (state) {
    case 'READY':
      return { bg: '#052e16', border: '#166534', color: '#4ade80', dot: '#22c55e', label: 'READY' };
    case 'ERROR':
      return { bg: '#450a0a', border: '#991b1b', color: '#f87171', dot: '#ef4444', label: 'ERROR' };
    case 'BUILDING':
    case 'QUEUED':
      return { bg: '#422006', border: '#854d0e', color: '#facc15', dot: '#eab308', label: state };
    default:
      return { bg: '#1e293b', border: '#334155', color: '#94a3b8', dot: '#64748b', label: state || 'NO DEPLOY' };
  }
}

export function VercelPage() {
  const [data, setData] = useState<VercelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ready' | 'error'>('all');
  const [search, setSearch] = useState('');

  const loadProjects = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/vercel/projects${refresh ? '?refresh=1' : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VercelResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects(false);
  }, []);

  const projects = data?.projects ?? [];
  const readyCount = projects.filter((p) => p.latestDeployment?.state === 'READY').length;
  const errorCount = projects.filter((p) => p.latestDeployment?.state === 'ERROR').length;

  const filtered = projects.filter((p) => {
    if (filter === 'ready' && p.latestDeployment?.state !== 'READY') return false;
    if (filter === 'error' && p.latestDeployment?.state !== 'ERROR') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.repo?.toLowerCase().includes(q) ?? false) ||
        p.domains.some((d) => d.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>▲</span> Proyectos en Vercel
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Estado de despliegues en tiempo real, dominios conectados y último commit en producción.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar proyecto, repo o dominio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.85rem',
              minWidth: '220px',
            }}
          />
          <button
            type="button"
            onClick={() => void loadProjects(true)}
            disabled={loading}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: '8px',
              padding: '0.45rem 0.9rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Actualizando...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFilter('all')}
          style={{
            background: filter === 'all' ? '#1e293b' : '#0b0f19',
            border: `1px solid ${filter === 'all' ? '#3b82f6' : '#1e293b'}`,
            color: '#f8fafc',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <span>Total Proyectos</span>
          <span style={{ background: '#334155', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.78rem' }}>
            {projects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('ready')}
          style={{
            background: filter === 'ready' ? '#052e16' : '#0b0f19',
            border: `1px solid ${filter === 'ready' ? '#22c55e' : '#1e293b'}`,
            color: '#4ade80',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <span>● READY</span>
          <span style={{ background: '#064e3b', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.78rem' }}>
            {readyCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('error')}
          style={{
            background: filter === 'error' ? '#450a0a' : '#0b0f19',
            border: `1px solid ${filter === 'error' ? '#ef4444' : '#1e293b'}`,
            color: '#f87171',
            borderRadius: '10px',
            padding: '0.6rem 1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <span>✖ ERROR</span>
          <span style={{ background: '#7f1d1d', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.78rem' }}>
            {errorCount}
          </span>
        </button>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error cargando proyectos de Vercel: {error}
        </div>
      )}

      {!loading && data && !data.configured && (
        <div style={{ background: '#422006', border: '1px solid #854d0e', color: '#fde68a', padding: '1rem', borderRadius: '10px' }}>
          ⚠️ <code>VERCEL_TOKEN</code> no está configurado en el servidor API.
        </div>
      )}

      {/* Grid of projects */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1rem',
        }}
      >
        {filtered.map((p) => {
          const dep = p.latestDeployment;
          const badge = stateBadge(dep?.state);
          return (
            <div
              key={p.id}
              style={{
                background: '#0b0f19',
                border: `1px solid ${dep?.state === 'ERROR' ? '#7f1d1d' : '#1e293b'}`,
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.85rem',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>{p.name}</h3>
                      {p.framework && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            background: '#1e293b',
                            color: '#94a3b8',
                            padding: '0.12rem 0.45rem',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}
                        >
                          {p.framework}
                        </span>
                      )}
                    </div>
                    {p.repo && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                        🐙 {p.repo} {dep?.branch ? `(${dep.branch})` : ''}
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot }} />
                    {badge.label}
                  </span>
                </div>

                {/* Domains */}
                {p.domains.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.7rem' }}>
                    {p.domains.slice(0, 3).map((d) => (
                      <a
                        key={d}
                        href={`https://${d}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.76rem',
                          color: '#60a5fa',
                          background: '#0f172a',
                          border: '1px solid #1e293b',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '6px',
                          textDecoration: 'none',
                        }}
                      >
                        ↗ {d}
                      </a>
                    ))}
                  </div>
                )}

                {/* Latest commit or error */}
                {dep && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.6rem 0.7rem',
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#cbd5e1',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.74rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'monospace' }}>
                        {dep.commitSha ? `#${dep.commitSha.slice(0, 7)}` : 'Deploy manual'}
                      </span>
                      <span>{formatRelative(dep.createdAt)}</span>
                    </div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dep.commitMessage ? dep.commitMessage.split('\n')[0] : 'Sin mensaje de commit'}
                    </div>
                    {dep.errorMessage && (
                      <div style={{ marginTop: '0.35rem', color: '#f87171', fontSize: '0.75rem' }}>
                        ✖ {dep.errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #1e293b',
                  paddingTop: '0.6rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                }}
              >
                <span>Node {p.nodeVersion ?? 'default'}</span>
                {p.productionUrl && (
                  <a
                    href={p.productionUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Abrir producción →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
