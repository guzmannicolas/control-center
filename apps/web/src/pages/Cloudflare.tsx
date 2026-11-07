import { useEffect, useState } from 'react';
import type { CloudflareOverview, CloudflareDnsItem } from '@cc/shared';
import { api } from '../api.ts';

export function CloudflarePage() {
  const [data, setData] = useState<CloudflareOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeZoneId, setActiveZoneId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Purge Cache action state
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  // Security Level update state
  const [updatingSec, setUpdatingSec] = useState(false);

  // Add DNS Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState<'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX'>('CNAME');
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newProxied, setNewProxied] = useState(true);
  const [addingDns, setAddingDns] = useState(false);

  const loadData = async (zoneId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.cloudflareOverview(zoneId || activeZoneId);
      setData(res);
      if (res.activeZoneId && !activeZoneId) {
        setActiveZoneId(res.activeZoneId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleZoneChange = (zoneId: string) => {
    setActiveZoneId(zoneId);
    void loadData(zoneId);
  };

  const handlePurgeCache = async () => {
    if (!activeZoneId || purging) return;
    if (!confirm('Are you sure you want to purge the entire Cloudflare edge cache? This will cause all assets to be re-fetched from the origin.')) {
      return;
    }
    setPurging(true);
    setPurgeSuccess(false);
    try {
      await api.purgeCloudflareCache(activeZoneId, true);
      setPurgeSuccess(true);
      setTimeout(() => setPurgeSuccess(false), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPurging(false);
    }
  };

  const handleSecurityLevelChange = async (level: string) => {
    if (!activeZoneId || updatingSec) return;
    setUpdatingSec(true);
    try {
      await api.setCloudflareSecurityLevel(activeZoneId, level);
      await loadData(activeZoneId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingSec(false);
    }
  };

  const handleAddDns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZoneId || addingDns || !newName.trim() || !newContent.trim()) return;
    setAddingDns(true);
    try {
      await api.createCloudflareDns({
        zoneId: activeZoneId,
        type: newType,
        name: newName.trim(),
        content: newContent.trim(),
        proxied: newProxied,
      });
      setShowAddModal(false);
      setNewName('');
      setNewContent('');
      await loadData(activeZoneId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingDns(false);
    }
  };

  const handleDeleteDns = async (record: CloudflareDnsItem) => {
    if (!activeZoneId) return;
    if (!confirm(`Delete DNS record "${record.name}" (${record.type} → ${record.content})?`)) {
      return;
    }
    try {
      await api.deleteCloudflareDns(activeZoneId, record.id);
      await loadData(activeZoneId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredDns = (data?.dnsRecords ?? []).filter((r) => {
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
    }
    return true;
  });

  const activeZone = data?.zones.find((z) => z.id === activeZoneId) ?? data?.zones[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="emoji-bw">⚡</span> Cloudflare Operations
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Live DNS management, 1-click edge cache purge, and WAF security controls.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void loadData(activeZoneId)}
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
        </div>
      </div>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fecaca', padding: '0.9rem 1rem', borderRadius: '10px' }}>
          Error loading Cloudflare: {error}
        </div>
      )}

      {!loading && data && !data.configured && (
        <div style={{ background: '#422006', border: '1px solid #854d0e', color: '#fde68a', padding: '1rem', borderRadius: '10px', fontSize: '0.88rem' }}>
          <span className="emoji-bw mr-1">⚠️</span> <code>CLOUDFLARE_API_TOKEN</code> is not configured on the API server. Configure it in <code>.env</code> to manage DNS and purge cache.
        </div>
      )}

      {/* Quick Action Operations Strip */}
      {data?.configured && activeZone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Zone & Cache Card */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                  Active Zone
                </span>
                <span style={{ fontSize: '0.72rem', background: '#052e16', color: '#4ade80', border: '1px solid #166534', padding: '0.12rem 0.45rem', borderRadius: '999px', fontWeight: 700 }}>
                  ● {activeZone.status.toUpperCase()}
                </span>
              </div>

              {data.zones.length > 1 ? (
                <select
                  value={activeZoneId}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.45rem', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {data.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeZone.name}
                </div>
              )}

              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                Nameservers: {activeZone.nameServers.slice(0, 2).join(', ') || 'Cloudflare Anycast'}
              </div>
            </div>

            {/* 1-Click Cache Purge */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0' }}>Edge Cache</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  {purgeSuccess ? <span style={{ color: '#4ade80' }}>✔ All cache purged successfully!</span> : 'Reclaim fresh static files across global CDN'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handlePurgeCache()}
                disabled={purging}
                style={{
                  background: purging ? '#1e3a8a' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '7px',
                  padding: '0.42rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: purging ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span className="emoji-bw">⚡</span> {purging ? 'Purging...' : '1-Click Purge Cache'}
              </button>
            </div>
          </div>

          {/* WAF & Security Level Card */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: '0.5rem' }}>
                WAF & Security Mode
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: data.securityLevel === 'under_attack' ? '#f87171' : '#f8fafc', textTransform: 'capitalize' }}>
                    {data.securityLevel === 'under_attack' ? '🚨 Under Attack Mode' : `${data.securityLevel} Security`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {data.securityLevel === 'under_attack'
                      ? 'Aggressive JavaScript challenge active for all incoming requests.'
                      : 'Standard firewall protection filtering malicious requests.'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Level preset:</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['medium', 'high', 'under_attack'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => void handleSecurityLevelChange(lvl)}
                    disabled={updatingSec || data.securityLevel === lvl}
                    style={{
                      background: data.securityLevel === lvl ? (lvl === 'under_attack' ? '#7f1d1d' : '#1e3a8a') : '#1e293b',
                      border: `1px solid ${data.securityLevel === lvl ? (lvl === 'under_attack' ? '#ef4444' : '#3b82f6') : '#334155'}`,
                      color: data.securityLevel === lvl ? '#ffffff' : '#94a3b8',
                      borderRadius: '6px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {lvl === 'under_attack' ? 'Under Attack' : lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DNS Management Section */}
      {data?.configured && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="emoji-bw">🌐</span> DNS Records ({filteredDns.length})
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '7px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Types</option>
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
                <option value="MX">MX</option>
              </select>

              <input
                type="text"
                placeholder="Search record name or target..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', minWidth: '130px', flex: '1 1 auto' }}
              />

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '7px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add Record
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Name</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Content / Value</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Proxy Status</th>
                  <th style={{ padding: '0.65rem 1rem' }}>TTL</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDns.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      No DNS records found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredDns.map((record) => (
                    <tr key={record.id} style={{ borderTop: '1px solid #1e293b', color: '#e2e8f0' }}>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{ fontSize: '0.72rem', background: '#1e293b', color: '#93c5fd', border: '1px solid #334155', padding: '0.12rem 0.45rem', borderRadius: '5px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {record.type}
                        </span>
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {record.name}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: '#cbd5e1', maxWidth: '320px', wordBreak: 'break-all' }}>
                        {record.content}
                      </td>

                      <td style={{ padding: '0.65rem 1rem' }}>
                        {record.proxied ? (
                          <span style={{ fontSize: '0.72rem', background: '#451a03', color: '#fb923c', border: '1px solid #9a3412', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }} />
                            Proxied
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} />
                            DNS Only
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {record.ttl === 1 ? 'Auto' : `${record.ttl}s`}
                      </td>

                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => void handleDeleteDns(record)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.78rem', cursor: 'pointer', padding: '0.2rem 0.4rem', borderRadius: '4px' }}
                          title="Delete record"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add DNS Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', width: '100%', maxWidth: '440px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="emoji-bw">➕</span> Add New DNS Record
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleAddDns(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Record Type:
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as typeof newType)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.55rem', fontSize: '0.85rem' }}
                >
                  <option value="A">A (IPv4 Address)</option>
                  <option value="AAAA">AAAA (IPv6 Address)</option>
                  <option value="CNAME">CNAME (Domain Alias)</option>
                  <option value="TXT">TXT (Verification / Text)</option>
                  <option value="MX">MX (Mail Exchange)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Name / Subdomain:
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. app or api (or @ for apex)"
                  required
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Content / Value:
                </label>
                <input
                  type="text"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. 173.212.224.70 or cname.vercel-dns.com"
                  required
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '7px', padding: '0.55rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                <input
                  type="checkbox"
                  id="proxied-check"
                  checked={newProxied}
                  onChange={(e) => setNewProxied(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="proxied-check" style={{ fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  Enable Cloudflare Proxy (CDN, DDoS & SSL)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '7px', padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDns}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', borderRadius: '7px', padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: addingDns ? 'wait' : 'pointer' }}
                >
                  {addingDns ? 'Creating...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
