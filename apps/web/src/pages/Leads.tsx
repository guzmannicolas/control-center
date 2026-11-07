import { useEffect, useState } from 'react';
import type { LeadView, LeadStatus } from '@cc/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

const STATUS_BADGES: Record<LeadStatus, { label: string; bg: string; color: string; border: string }> = {
  discovered: { label: 'Discovered', bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  enriched: { label: 'Enriched (Data ready)', bg: '#1e3a8a', color: '#93c5fd', border: '#2563eb' },
  contacted: { label: 'Contacted', bg: '#422006', color: '#facc15', border: '#854d0e' },
  replied: { label: 'Replied', bg: '#064e3b', color: '#34d399', border: '#059669' },
  converted: { label: 'Client Won!', bg: '#052e16', color: '#4ade80', border: '#166534' },
  discarded: { label: 'Discarded', bg: '#450a0a', color: '#f87171', border: '#991b1b' },
};

export const PRESET_NICHES = [
  { value: 'Odontology / Dental Clinics', label: 'Odontology / Dental Clinics', demo: 'https://odontologia-ten.vercel.app' },
  { value: 'Barber Shops / Hair Salons', label: 'Barber Shops / Hair Salons', demo: 'https://barberia-demo.vercel.app' },
  { value: 'Pizzerias & Restaurants', label: 'Pizzerias & Restaurants', demo: 'https://pizzeria-demo.vercel.app' },
  { value: 'Aesthetics & Spa / Nail Salons', label: 'Aesthetics & Spa / Nail Salons', demo: 'https://estetica-demo.vercel.app' },
  { value: 'Gyms & Crossfit Centers', label: 'Gyms & Crossfit Centers', demo: 'https://gym-web-demo.vercel.app' },
  { value: 'Real Estate / Properties', label: 'Real Estate / Properties', demo: 'https://inmobiliaria-demo.vercel.app' },
  { value: 'Clothing & Boutiques', label: 'Clothing & Boutiques', demo: 'https://indumentaria-demo.vercel.app' },
  { value: 'Veterinary / Pet Shops', label: 'Veterinary / Pet Shops', demo: 'https://v0-e-commerce-storefront-design.vercel.app' },
  { value: 'Lawyers & Legal Studies', label: 'Lawyers & Legal Studies', demo: 'https://v0-e-commerce-storefront-design.vercel.app' },
  { value: 'Automotive Mechanics / Workshops', label: 'Automotive Mechanics / Workshops', demo: 'https://v0-e-commerce-storefront-design.vercel.app' },
];

export const PRESET_AREAS = [
  'Cordoba Capital, Argentina',
  'Nueva Cordoba, Cordoba',
  'Cerro de las Rosas, Cordoba',
  'Palermo, CABA, Argentina',
  'Belgrano, CABA, Argentina',
  'Recoleta, CABA, Argentina',
  'Caballito, CABA, Argentina',
  'Rosario, Santa Fe, Argentina',
  'Mendoza Capital, Argentina',
  'Mar del Plata, Buenos Aires',
  'San Isidro / Vicente Lopez, Buenos Aires',
  'La Plata, Buenos Aires',
  'San Miguel de Tucuman, Argentina',
  'Salta Capital, Argentina',
];

const DEFAULT_PITCH_TEMPLATE =
  'Hola {name}! Vi sus excelentes calificaciones en Google ({rating}★) en {city}. Noté que aún no tienen sitio web propio y les armé una propuesta interactiva de cómo quedaría su página web moderna para {category}: {demo} ¿Les gustaría que les comparta más detalles?';

export function LeadsPage() {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchActionRunning, setBatchActionRunning] = useState(false);

  // Outreach Assistant State
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachIndex, setOutreachIndex] = useState(0);
  const [pitchTemplate, setPitchTemplate] = useState(DEFAULT_PITCH_TEMPLATE);
  const [showPitchEditor, setShowPitchEditor] = useState(false);
  const [generatingPitchId, setGeneratingPitchId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [aiPitchOverride, setAiPitchOverride] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<{ waiting: number; active: number; completed: number; isPaused: boolean } | null>(null);
  const [queuingCampaign, setQueuingCampaign] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waStatus, setWaStatus] = useState<{ state: string; qrDataUrl: string | null; phoneNumber: string | null; userName: string | null; error?: string | null }>({
    state: 'disconnected',
    qrDataUrl: null,
    phoneNumber: null,
    userName: null,
  });
  const [waLoading, setWaLoading] = useState(false);

  // Form states with dropdowns
  const [category, setCategory] = useState(PRESET_NICHES[4]!.value);
  const [customCategory, setCustomCategory] = useState('');
  const [city, setCity] = useState(PRESET_AREAS[3]!);
  const [customCity, setCustomCity] = useState('');
  const [limit, setLimit] = useState(15);
  const [filterWithoutWeb, setFilterWithoutWeb] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error loading leads');
      const data = (await res.json()) as { leads: LeadView[] };
      setLeads(data.leads ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, []);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scraping) return;
    const finalCategory = category === 'custom' ? customCategory.trim() : category;
    const finalCity = city === 'custom' ? customCity.trim() : city;
    if (!finalCategory || !finalCity) return;

    setScraping(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/scrape`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: finalCategory, city: finalCity, limit }),
      });
      if (res.ok) {
        await loadLeads();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScraping(false);
    }
  };

  const handleEnrich = async (id: string) => {
    setEnrichingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${id}/enrich`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await loadLeads();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnrichingId(null);
    }
  };

  const updateStatus = async (id: string, status: LeadStatus) => {
    try {
      await fetch(`${API_BASE}/api/leads/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status, contactedAt: status === 'contacted' ? new Date().toISOString() : l.contactedAt } : l)));
    } catch (err) {
      console.error(err);
    }
  };

  // --- Deletion Handlers ---

  const deleteLead = async (id: string) => {
    if (!confirm('Permanently delete this prospect?')) return;
    try {
      await fetch(`${API_BASE}/api/leads/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSelectedLeads = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected prospects?`)) return;

    setBatchActionRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/batch-delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  const clearAllLeads = async () => {
    if (leads.length === 0) return;
    if (!confirm(`Are you sure you want to delete ALL ${leads.length} stored prospects? This will remove all previous scraping data.`)) return;

    setBatchActionRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/batch-delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setLeads([]);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  const updateSelectedStatus = async (status: LeadStatus) => {
    if (selectedIds.size === 0) return;
    setBatchActionRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/batch-update`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            selectedIds.has(l.id)
              ? { ...l, status, contactedAt: status === 'contacted' ? new Date().toISOString() : l.contactedAt }
              : l
          )
        );
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  // --- Multi-selection helpers ---
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  // --- Filtering ---
  const filtered = leads.filter((l) => {
    if (filterWithoutWeb && l.hasWebsite) return false;
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.phone?.includes(q) ?? false)
      );
    }
    return true;
  });

  // --- Outreach Queue Candidates ---
  // Qualified targets: has phone number and not yet contacted (discovered or enriched)
  const outreachQueue = leads.filter(
    (l) => Boolean(l.phoneFormatted) && (l.status === 'discovered' || l.status === 'enriched')
  );

  const currentOutreachLead = outreachQueue[outreachIndex];

  const buildPitch = (lead: LeadView | undefined): string => {
    if (!lead) return '';
    return pitchTemplate
      .replace(/{name}/g, lead.name)
      .replace(/{city}/g, lead.city.split(',')[0] ?? lead.city)
      .replace(/{rating}/g, lead.rating ? String(lead.rating) : '5.0')
      .replace(/{reviews}/g, String(lead.reviewsCount || 'varias'))
      .replace(/{category}/g, lead.category)
      .replace(/{demo}/g, lead.suggestedDemo ?? 'https://v0-e-commerce-storefront-design.vercel.app');
  };

  const loadWhatsAppStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
      }
    } catch {
      // ignore
    }
  };

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    void loadWhatsAppStatus();
    const interval = setInterval(() => {
      void loadWhatsAppStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadQueueStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leads/outreach/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQueueStatus(data.status);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadQueueStatus();
    const interval = setInterval(loadQueueStatus, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerateAiPitch = async (lead: LeadView) => {
    setGeneratingPitchId(lead.id);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${lead.id}/generate-pitch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFollowUp: lead.status === 'contacted' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pitch) setAiPitchOverride(data.pitch);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPitchId(null);
    }
  };

  const handleQueueCampaign = async (leadIds: string[]) => {
    if (queuingCampaign || leadIds.length === 0) return;
    setQueuingCampaign(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/outreach/queue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      });
      if (res.ok) {
        await loadQueueStatus();
        await loadLeads();
        alert(`🚀 ¡Campaña iniciada! Se encolaron ${leadIds.length} mensajes con despacho espaciado en segundo plano.`);
      } else {
        const errJson = await res.json();
        alert(`Error: ${errJson.error || 'No se pudo iniciar la campaña'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQueuingCampaign(false);
    }
  };

  const getInstagramUsername = (igUrl: string | null | undefined): string | null => {
    if (!igUrl) return null;
    try {
      const clean = igUrl.trim().replace(/\/+$/, '');
      const parts = clean.split('/');
      const last = parts[parts.length - 1];
      if (last && !last.includes('?') && last !== 'instagram.com') return last;
      if (last && last.includes('?')) return last.split('?')[0] ?? null;
      return null;
    } catch {
      return null;
    }
  };

  const handleOpenInstagramDM = (lead: LeadView, customPitchText?: string) => {
    const pitch = customPitchText || aiPitchOverride || buildPitch(lead);
    const username = getInstagramUsername(lead.instagram);

    // Copy personalized pitch to clipboard
    navigator.clipboard.writeText(pitch).then(() => {
      setCopiedToast(`📋 ¡Mensaje copiado! Pegalo en el chat de ${lead.name}`);
      setTimeout(() => setCopiedToast(null), 4000);
    }).catch(() => {});

    // Target profile URL (desktop-friendly: opens profile where you can click 'Enviar mensaje')
    // If opened on mobile, Instagram app opens directly.
    const targetUrl = username
      ? `https://www.instagram.com/${username}/`
      : (lead.instagram || 'https://www.instagram.com/');

    window.open(targetUrl, '_blank');

    // Auto mark as contacted
    void updateStatus(lead.id, 'contacted');

    // Advance assistant queue if open
    if (outreachOpen && outreachIndex + 1 < outreachQueue.length) {
      setOutreachIndex((i) => i + 1);
      setAiPitchOverride(null);
    }
  };

  const handleOpenWhatsAppAndAdvance = (lead: LeadView) => {
    const rawDigits = lead.phoneFormatted ? lead.phoneFormatted.replace('+', '') : '';
    if (!rawDigits) return;

    const pitch = buildPitch(lead);
    const waUrl = `https://wa.me/${rawDigits}?text=${encodeURIComponent(pitch)}`;

    // Open WhatsApp in new tab
    window.open(waUrl, '_blank');

    // Mark as contacted
    void updateStatus(lead.id, 'contacted');

    // Advance queue
    if (outreachIndex + 1 < outreachQueue.length) {
      setOutreachIndex((i) => i + 1); setAiPitchOverride(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            B2B Sales & Outreach Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Live Google Maps business extraction, verified website detection, and semi-automated outreach dispatcher.
          </p>
        </div>

        {/* Global Action Tools */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {queueStatus && (queueStatus.waiting > 0 || queueStatus.active > 0) && (
            <div style={{
              background: '#0f172a',
              border: '1px solid #0284c7',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite' }} />
              Campaña activa: {queueStatus.waiting} en cola ({queueStatus.active} enviando)
            </div>
          )}

          {/* WhatsApp Connection Button */}
          <button
            type="button"
            onClick={() => {
              void loadWhatsAppStatus();
              setWaModalOpen(true);
            }}
            style={{
              background: waStatus.state === 'connected' ? '#064e3b' : '#1e293b',
              border: `1px solid ${waStatus.state === 'connected' ? '#059669' : '#334155'}`,
              color: waStatus.state === 'connected' ? '#34d399' : '#94a3b8',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: waStatus.state === 'connected' ? '#34d399' : waStatus.state === 'waiting_qr' ? '#facc15' : '#ef4444',
            }} />
            <span>
              {waStatus.state === 'connected'
                ? `WhatsApp (${waStatus.phoneNumber ?? 'Activo'})`
                : waStatus.state === 'waiting_qr'
                ? 'Escanear QR de WhatsApp'
                : 'Conectar WhatsApp'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleQueueCampaign(outreachQueue.map((l) => l.id))}
            disabled={outreachQueue.length === 0 || queuingCampaign}
            title="Despachar mensajes automáticamente en segundo plano con intervalos seguros de 60-120s"
            style={{
              background: '#4338ca',
              border: '1px solid #6366f1',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: outreachQueue.length > 0 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {queuingCampaign ? '⏳ Encolando...' : `⚡ Auto-Despachar Cola (${outreachQueue.length})`}
          </button>

          <button
            type="button"
            onClick={() => {
              setOutreachIndex(0); setAiPitchOverride(null);
              setOutreachOpen(true);
            }}
            disabled={outreachQueue.length === 0}
            style={{
              background: outreachQueue.length > 0 ? '#065f46' : '#1e293b',
              border: `1px solid ${outreachQueue.length > 0 ? '#059669' : '#334155'}`,
              color: outreachQueue.length > 0 ? '#34d399' : '#64748b',
              borderRadius: '8px',
              padding: '0.55rem 1rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: outreachQueue.length > 0 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            Launch Outreach Assistant ({outreachQueue.length} ready)
          </button>

          <button
            type="button"
            onClick={() => void clearAllLeads()}
            disabled={leads.length === 0 || batchActionRunning}
            title="Permanently remove all scraped leads"
            style={{
              background: '#450a0a',
              border: '1px solid #7f1d1d',
              color: '#f87171',
              borderRadius: '8px',
              padding: '0.55rem 0.9rem',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: leads.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Clear All Scraps ({leads.length})
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Leads</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{leads.length}</div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>No Website (Targets)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f87171', marginTop: '0.2rem' }}>
            {leads.filter((l) => !l.hasWebsite).length}
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Ready for Outreach</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
            {outreachQueue.length}
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#facc15', textTransform: 'uppercase', fontWeight: 600 }}>Contacted</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15', marginTop: '0.2rem' }}>
            {leads.filter((l) => l.status === 'contacted').length}
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#4ade80', textTransform: 'uppercase', fontWeight: 600 }}>Converted Clients</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80', marginTop: '0.2rem' }}>
            {leads.filter((l) => l.status === 'converted').length}
          </div>
        </div>
      </div>

      {/* Scraper Launcher Box */}
      <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
        <h2 style={{ margin: '0 0 0.8rem', fontSize: '1.05rem', color: '#f8fafc' }}>
          Launch Live Google Maps Scraping
        </h2>
        <form onSubmit={handleScrape} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          {/* Niche Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Category / Niche</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.5rem 0.8rem',
                fontSize: '0.85rem',
                minWidth: '220px',
              }}
            >
              {PRESET_NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
              <option value="custom">+ Custom Niche...</option>
            </select>
            {category === 'custom' && (
              <input
                type="text"
                placeholder="Type custom niche..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  marginTop: '0.2rem',
                }}
              />
            )}
          </div>

          {/* City / Area Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>City / Area</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.5rem 0.8rem',
                fontSize: '0.85rem',
                minWidth: '220px',
              }}
            >
              {PRESET_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="custom">+ Custom City / Area...</option>
            </select>
            {city === 'custom' && (
              <input
                type="text"
                placeholder="Type custom area (e.g. Rosario Centro)..."
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                required
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  marginTop: '0.2rem',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Max Results</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min={1}
              max={50}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.5rem 0.8rem',
                fontSize: '0.85rem',
                width: '80px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={scraping}
            style={{
              background: scraping ? '#1e3a8a' : '#2563eb',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.55rem 1.2rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: scraping ? 'wait' : 'pointer',
            }}
          >
            {scraping ? 'Extracting from Google Maps...' : 'Start Scraping'}
          </button>
        </form>
      </div>

      {/* Filter and stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterWithoutWeb(!filterWithoutWeb)}
            style={{
              background: filterWithoutWeb ? '#052e16' : '#1e293b',
              border: `1px solid ${filterWithoutWeb ? '#22c55e' : '#334155'}`,
              color: filterWithoutWeb ? '#4ade80' : '#cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {filterWithoutWeb ? 'Only WITHOUT website' : 'Show all websites'}
          </button>

          {/* Filter by Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.8rem',
            }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_BADGES).map(([st, badge]) => (
              <option key={st} value={st}>
                {badge.label}
              </option>
            ))}
          </select>

          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Showing: <strong style={{ color: '#f8fafc' }}>{filtered.length}</strong> / {leads.length}
          </span>
        </div>

        <input
          type="text"
          placeholder="Filter by name, phone, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#f8fafc',
            borderRadius: '8px',
            padding: '0.45rem 0.8rem',
            fontSize: '0.84rem',
            minWidth: '240px',
          }}
        />
      </div>

      {/* Sticky Bulk Action Bar when leads are selected */}
      {selectedIds.size > 0 && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #3b82f6',
            borderRadius: '10px',
            padding: '0.65rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
              {selectedIds.size} leads selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Deselect all
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void updateSelectedStatus('contacted')}
              disabled={batchActionRunning}
              style={{
                background: '#422006',
                border: '1px solid #854d0e',
                color: '#facc15',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Mark Contacted ({selectedIds.size})
            </button>

            <button
              type="button"
              onClick={() => void updateSelectedStatus('discarded')}
              disabled={batchActionRunning}
              style={{
                background: '#334155',
                border: '1px solid #475569',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Mark Discarded
            </button>

            <button
              type="button"
              onClick={() => void deleteSelectedLeads()}
              disabled={batchActionRunning}
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Delete Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem 0.75rem', width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAllFiltered}
                    title="Select/Deselect all filtered leads"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '0.65rem 1rem' }}>Business</th>
                <th style={{ padding: '0.65rem 1rem' }}>Address & Maps Link</th>
                <th style={{ padding: '0.65rem 1rem' }}>Website Status</th>
                <th style={{ padding: '0.65rem 1rem' }}>Contact Details</th>
                <th style={{ padding: '0.65rem 1rem' }}>Suggested Pitch</th>
                <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const badge = STATUS_BADGES[lead.status] ?? STATUS_BADGES.discovered;
                const waNumber = lead.phoneFormatted ? lead.phoneFormatted.replace('+', '') : null;
                const metaSource = (lead.metadata as { sourceUrl?: string })?.sourceUrl;
                const mapsSearchUrl = metaSource || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address}`)}`;
                const pitchText = buildPitch(lead);
                const isSelected = selectedIds.has(lead.id);

                return (
                  <tr
                    key={lead.id}
                    style={{
                      borderTop: '1px solid #1e293b',
                      color: '#e2e8f0',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(lead.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Name and Rating */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{lead.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {lead.category}
                      </div>
                      {lead.rating && (
                        <div style={{ fontSize: '0.74rem', color: '#eab308', marginTop: '0.15rem' }}>
                          ★ {lead.rating} ({lead.reviewsCount} reviews)
                        </div>
                      )}
                    </td>

                    {/* Address & Direct Google Maps link */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ color: '#cbd5e1', fontSize: '0.8rem', maxWidth: '240px' }}>
                        {lead.address || lead.city}
                      </div>
                      <div style={{ marginTop: '0.25rem' }}>
                        <a
                          href={mapsSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Verify listing directly on Google Maps"
                          style={{
                            fontSize: '0.72rem',
                            color: '#38bdf8',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          Verify on Google Maps ↗
                        </a>
                      </div>
                    </td>

                    {/* Website */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      {lead.hasWebsite && lead.website ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ color: '#4ade80', fontSize: '0.72rem', fontWeight: 700 }}>
                            HAS WEBSITE
                          </span>
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: '#60a5fa',
                              textDecoration: 'none',
                              fontSize: '0.76rem',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        </div>
                      ) : (
                        <span
                          style={{
                            background: '#450a0a',
                            color: '#f87171',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}
                        >
                          NO WEBSITE TARGET
                        </span>
                      )}
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {lead.phone ? (
                          <div style={{ fontFamily: 'monospace', color: '#93c5fd', fontSize: '0.78rem' }}>
                            {lead.phone}
                          </div>
                        ) : null}
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            style={{ color: '#34d399', fontSize: '0.78rem', textDecoration: 'none' }}
                          >
                            {lead.email}
                          </a>
                        ) : null}
                        {lead.instagram ? (
                          <a
                            href={lead.instagram}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#f472b6', fontSize: '0.75rem', textDecoration: 'none' }}
                          >
                            Instagram Profile ↗
                          </a>
                        ) : null}
                        {!lead.email && !lead.phone && (
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>No phone available</span>
                        )}
                      </div>
                    </td>

                    {/* Suggested Pitch / Demo */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      {lead.suggestedDemo ? (
                        <a
                          href={lead.suggestedDemo}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#a78bfa',
                            textDecoration: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          Pitch Demo ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <select
                        value={lead.status}
                        onChange={(e) => void updateStatus(lead.id, e.target.value as LeadStatus)}
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          borderRadius: '6px',
                          padding: '0.2rem 0.4rem',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {Object.entries(STATUS_BADGES).map(([key, item]) => (
                          <option key={key} value={key} style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        {waNumber && (
                          <a
                            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(pitchText)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => void updateStatus(lead.id, 'contacted')}
                            title="Open WhatsApp chat with prefilled pitch"
                            style={{
                              background: '#064e3b',
                              border: '1px solid #059669',
                              color: '#6ee7b7',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            WhatsApp
                          </a>
                        )}

                        {lead.instagram && (
                          <button
                            type="button"
                            onClick={() => handleOpenInstagramDM(lead)}
                            title="Abrir Instagram DM y copiar mensaje personalizado"
                            style={{
                              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                              border: 'none',
                              color: '#ffffff',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              boxShadow: '0 2px 4px rgba(219, 39, 119, 0.25)',
                            }}
                          >
                            <span>📸</span> DM
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleEnrich(lead.id)}
                          disabled={enrichingId === lead.id}
                          title="Search public email and Instagram profile"
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#cbd5e1',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          {enrichingId === lead.id ? '...' : 'Find Socials'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteLead(lead.id)}
                          title="Delete this prospect"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.88rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    No prospects found. Launch a new Google Maps scraping scan above to populate real leads!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Gateway Connection Modal */}
      {waModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📱</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                    Conectar WhatsApp
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Vinculá tu línea secundaria de WhatsApp Business
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
              >
                ✕
              </button>
            </div>

            {waStatus.state === 'connected' ? (
              <div style={{
                background: '#064e3b20',
                border: '1px solid #059669',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <div>
                  <div style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem' }}>
                    ¡WhatsApp Conectado y Listo!
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Línea vinculada: <strong>{waStatus.phoneNumber}</strong> {waStatus.userName ? `(${waStatus.userName})` : ''}
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                    Las campañas se despacharán automáticamente desde este número. Las respuestas te llegarán directamente a tu WhatsApp Business en el celular.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleDisconnectWhatsApp()}
                  disabled={waLoading}
                  style={{
                    marginTop: '0.5rem',
                    background: '#450a0a',
                    border: '1px solid #991b1b',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {waLoading ? 'Desconectando...' : 'Desconectar esta línea'}
                </button>
              </div>
            ) : waStatus.state === 'waiting_qr' && waStatus.qrDataUrl ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Abrí WhatsApp Business en tu celular &rarr; <strong>Dispositivos vinculados</strong> &rarr; <strong>Vincular dispositivo</strong> y escaneá este código:
                </p>

                <div style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}>
                  <img
                    src={waStatus.qrDataUrl}
                    alt="WhatsApp QR Code"
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: '#facc15' }}>
                  ⏳ Esperando escaneo... (el código se actualiza automáticamente)
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                textAlign: 'center',
                padding: '1rem 0',
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Para enviar mensajes de forma 100% automática, vinculá la sesión escaneando un código QR con tu WhatsApp Business.
                </p>

                <button
                  type="button"
                  onClick={() => void handleConnectWhatsApp()}
                  disabled={waLoading}
                  style={{
                    background: '#059669',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {waLoading ? 'Iniciando sesión...' : '📲 Generar Código QR de Conexión'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Automated Outreach Assistant Modal */}
      {outreachOpen && currentOutreachLead && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '14px',
              maxWidth: '650px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Semi-Automated Outreach Assistant
                </span>
                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: '#f8fafc' }}>
                  Target {outreachIndex + 1} of {outreachQueue.length}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOutreachOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Target Details Card */}
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>{currentOutreachLead.name}</h4>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    {currentOutreachLead.category} • {currentOutreachLead.address}
                  </div>
                </div>

                {!currentOutreachLead.hasWebsite ? (
                  <span style={{ background: '#450a0a', color: '#f87171', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>
                    NO WEBSITE TARGET
                  </span>
                ) : (
                  <span style={{ background: '#052e16', color: '#4ade80', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>
                    HAS WEBSITE
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                {currentOutreachLead.phone && (
                  <div>
                    <span style={{ color: '#64748b' }}>Phone: </span>
                    <strong style={{ color: '#93c5fd', fontFamily: 'monospace' }}>{currentOutreachLead.phone}</strong>
                  </div>
                )}
                {currentOutreachLead.rating && (
                  <div>
                    <span style={{ color: '#64748b' }}>Rating: </span>
                    <strong style={{ color: '#eab308' }}>★ {currentOutreachLead.rating} ({currentOutreachLead.reviewsCount} reviews)</strong>
                  </div>
                )}
                {currentOutreachLead.suggestedDemo && (
                  <div>
                    <span style={{ color: '#64748b' }}>Demo: </span>
                    <a
                      href={currentOutreachLead.suggestedDemo}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {currentOutreachLead.suggestedDemo.replace('https://', '')} ↗
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Pitch Message Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  Tailored WhatsApp Message Pitch:
                </label>
                <button
                  type="button"
                  onClick={() => setShowPitchEditor(!showPitchEditor)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {showPitchEditor ? 'Done editing template' : 'Edit pitch template'}
                </button>
              </div>

              {showPitchEditor ? (
                <textarea
                  rows={4}
                  value={pitchTemplate}
                  onChange={(e) => setPitchTemplate(e.target.value)}
                  style={{
                    background: '#0b0f19',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    padding: '0.6rem',
                    fontSize: '0.82rem',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <div>
                  <div
                    style={{
                      background: '#0b0f19',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      color: '#e2e8f0',
                      fontSize: '0.84rem',
                      lineHeight: '1.4',
                    }}
                  >
                    {aiPitchOverride || buildPitch(currentOutreachLead)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => void handleGenerateAiPitch(currentOutreachLead)}
                      disabled={generatingPitchId === currentOutreachLead.id}
                      style={{
                        background: '#1e3a8a',
                        border: '1px solid #2563eb',
                        color: '#bfdbfe',
                        borderRadius: '6px',
                        padding: '0.3rem 0.7rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      {generatingPitchId === currentOutreachLead.id ? '⏳ Redactando...' : '✨ Regenerar Pitch con IA'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setOutreachIndex((i) => Math.max(0, i - 1))}
                  disabled={outreachIndex === 0}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: outreachIndex === 0 ? '#475569' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: outreachIndex === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (outreachIndex + 1 < outreachQueue.length) setOutreachIndex((i) => i + 1);
                  }}
                  disabled={outreachIndex + 1 >= outreachQueue.length}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: outreachIndex + 1 >= outreachQueue.length ? '#475569' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: outreachIndex + 1 >= outreachQueue.length ? 'not-allowed' : 'pointer',
                  }}
                >
                  Skip &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    void updateStatus(currentOutreachLead.id, 'contacted');
                    if (outreachIndex + 1 < outreachQueue.length) setOutreachIndex((i) => i + 1);
                  }}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#93c5fd',
                    borderRadius: '8px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Mark Contacted (Skip tab)
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppAndAdvance(currentOutreachLead)}
                  style={{
                    background: '#059669',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '0.5rem 1.1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  WhatsApp & Next &rarr;
                </button>

                {currentOutreachLead.instagram && (
                  <button
                    type="button"
                    onClick={() => handleOpenInstagramDM(currentOutreachLead)}
                    title="Abre el chat de Instagram del negocio y copia el pitch listo para pegar"
                    style={{
                      background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 6px -1px rgba(219, 39, 119, 0.2)',
                    }}
                  >
                    <span>📸</span> Abrir Instagram DM &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Copied to clipboard toast */}
      {copiedToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: '#0f172a',
            border: '1px solid #db2777',
            color: '#f472b6',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-in',
          }}
        >
          {copiedToast}
        </div>
      )}
    </div>
  );
}
