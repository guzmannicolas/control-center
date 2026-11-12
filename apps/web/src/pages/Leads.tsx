import { useEffect, useState } from 'react';
import type { LeadView, LeadStatus } from '@cc/shared';
import { api } from '../api.ts';
import { useTableSelection } from '../hooks/useTableSelection.ts';

const STATUS_BADGES: Record<LeadStatus, { label: string; bg: string; color: string; border: string }> = {
  discovered: { label: 'Discovered', bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  enriched: { label: 'Enriched (Data ready)', bg: '#1e3a8a', color: '#93c5fd', border: '#2563eb' },
  contacted: { label: 'Contacted', bg: '#422006', color: '#facc15', border: '#854d0e' },
  replied: { label: 'Replied', bg: '#064e3b', color: '#34d399', border: '#059669' },
  converted: { label: 'Client Won!', bg: '#052e16', color: '#4ade80', border: '#166534' },
  discarded: { label: 'Discarded', bg: '#450a0a', color: '#f87171', border: '#991b1b' },
};

export const PRESET_NICHES = [
  { value: 'Barber Shops / Hair Salons', label: 'Barber Shops / Hair Salons', demo: 'https://templates.nicoguzmandev.com/demos/barbershop/' },
  { value: 'Automotive Mechanics / Workshops', label: 'Automotive Mechanics / Workshops', demo: 'https://templates.nicoguzmandev.com/demos/auto-repair/' },
  { value: 'Cafes & Bakeries', label: 'Cafes & Bakeries', demo: 'https://templates.nicoguzmandev.com/demos/coffee-shop/' },
  { value: 'Hardware Stores / Corralón', label: 'Hardware Stores / Corralón', demo: 'https://templates.nicoguzmandev.com/demos/hardware-store/' },
  { value: 'Photography & Visual Studios', label: 'Photography & Visual Studios', demo: 'https://templates.nicoguzmandev.com/demos/photography/' },
  { value: 'Real Estate / Properties', label: 'Real Estate / Properties', demo: 'https://templates.nicoguzmandev.com/demos/real-estate/' },
  { value: 'Pizzerias & Restaurants', label: 'Pizzerias & Restaurants', demo: 'https://templates.nicoguzmandev.com/demos/restaurant/' },
  { value: 'Tattoo & Piercing Studios', label: 'Tattoo & Piercing Studios', demo: 'https://templates.nicoguzmandev.com/demos/tattoo/' },
  { value: 'Odontology / Dental Clinics', label: 'Odontology / Dental Clinics', demo: 'https://templates.nicoguzmandev.com/demos/barbershop/' },
  { value: 'Aesthetics & Spa / Nail Salons', label: 'Aesthetics & Spa / Nail Salons', demo: 'https://templates.nicoguzmandev.com/demos/tattoo/' },
  { value: 'Gyms & Crossfit Centers', label: 'Gyms & Crossfit Centers', demo: 'https://templates.nicoguzmandev.com/' },
  { value: 'Clothing & Boutiques', label: 'Clothing & Boutiques', demo: 'https://templates.nicoguzmandev.com/' },
  { value: 'Veterinary / Pet Shops', label: 'Veterinary / Pet Shops', demo: 'https://templates.nicoguzmandev.com/' },
  { value: 'Lawyers & Legal Studies', label: 'Lawyers & Legal Studies', demo: 'https://templates.nicoguzmandev.com/' },
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

export interface SpeechPreset {
  id: string;
  label: string;
  description: string;
  template: string;
}

export const INITIAL_SPEECH_PRESETS: SpeechPreset[] = [
  {
    id: 'web_local',
    label: 'Web para Comercios (Sin Web)',
    description: 'Para comercios locales sin sitio web. Enfasis en desarrollador independiente que ayuda a tener exposicion en Google con demo armada.',
    template:
      'Buenas! Che te escribo por acá porque vi su negocio en {city} y me gustó mucho lo que hacen. Te cuento: soy desarrollador y esto lo hago como un plus mientras tanto para darle una mano a negocios y que tengan más exposición en Google. Vi que todavía no tienen página web propia, así que les armé una demo de muestra para su rubro: {demo} Como la idea es ayudarlos el costo es súper accesible, nada más para cubrir el hosting y mantenerla activa. Mírenla tranquilos y si les sirve o quieren adaptarla con sus fotos y servicios me avisan, cero compromiso!',
  },
  {
    id: 'automation',
    label: 'Automatización de Respuestas (Inmobiliarias / Con Web)',
    description: 'Para inmobiliarias o negocios con pagina. Enfocado en responder consultas repetitivas 24/7 en Instagram y WhatsApp sin perder tiempo.',
    template:
      'Buenas! Che te escribo por acá porque vi lo que hacen en {name} y la presencia que manejan. Te cuento: soy desarrollador y trabajo armando automatizaciones para negocios. Se que muchas veces se pierde tiempo respondiendo siempre las mismas consultas por DM o WhatsApp (precios, horarios, disponibilidad). Armé un sistema para responder y filtrar consultas 24/7 sin que tengan que estar encima. Si les interesa ver cómo funciona avísenme y se los muestro, cero compromiso!',
  },
  {
    id: 'custom',
    label: 'Personalizado / Libre',
    description: 'Plantilla abierta para escribir libremente con variables dinamicas {name}, {city}, {category}, {demo}.',
    template:
      'Hola {name}! ¿Cómo andan? Les escribo porque vi su negocio en {city}. Me dedico al desarrollo y les preparé esta propuesta interactiva para su rubro: {demo} Si les interesa avísenme y la vemos sin compromiso!',
  },
];

export function LeadsPage() {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'prospecting' | 'followups' | 'speeches'>('prospecting');

  // Speech Presets State
  const [speechPresets, setSpeechPresets] = useState<SpeechPreset[]>(INITIAL_SPEECH_PRESETS);
  const [selectedSpeechPreset, setSelectedSpeechPreset] = useState<string>('web_local');
  const [leadPresetOverrides, setLeadPresetOverrides] = useState<Record<string, string>>({});
  const [previewLeadId, setPreviewLeadId] = useState<string>('');

  // Instagram Verification State
  const [verifyingIgId, setVerifyingIgId] = useState<string | null>(null);
  const [verifyingAllIg, setVerifyingAllIg] = useState<boolean>(false);
  const [filterIgVerifiedOnly, setFilterIgVerifiedOnly] = useState<boolean>(false);

  // Selection state for bulk operations
  const {
    selected: selectedIds,
    toggle: toggleSelectRow,
    toggleAll: selectProspectingAll,
    clear: clearSelectedLeads,
    setSelected: setSelectedIds,
  } = useTableSelection<string>();
  const [batchActionRunning, setBatchActionRunning] = useState(false);

  // Outreach Assistant State
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachIndex, setOutreachIndex] = useState(0);
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
  const [filterFollowupStatus, setFilterFollowupStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraftText, setNoteDraftText] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await api.leads();
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
      await api.leadScrape({ category: finalCategory, city: finalCity, limit });
      await loadLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setScraping(false);
    }
  };

  const handleEnrich = async (id: string) => {
    setEnrichingId(id);
    try {
      const data = await api.leadEnrich(id);
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    } catch (err) {
      console.error(err);
    } finally {
      setEnrichingId(null);
    }
  };

  const handleVerifyInstagram = async (leadId: string) => {
    setVerifyingIgId(leadId);
    try {
      const data = await api.leadVerifyInstagram(leadId);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
      setCopiedToast(data.verification.valid ? 'Instagram verificado (200 OK)' : 'Perfil no disponible (404)');
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingIgId(null);
    }
  };

  const handleVerifyAllInstagram = async () => {
    setVerifyingAllIg(true);
    try {
      const data = await api.leadVerifyAllInstagram();
      await loadLeads();
      setCopiedToast(`Verificacion completa: ${data.verifiedCount} perfiles validos (200 OK).`);
      setTimeout(() => setCopiedToast(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingAllIg(false);
    }
  };

  const updateStatus = async (id: string, newStatus: LeadStatus) => {
    try {
      await api.leadUpdate(id, { status: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    } catch (err) {
      console.error(err);
    }
  };

  const updateSelectedStatus = async (newStatus: LeadStatus) => {
    if (selectedIds.size === 0) return;
    setBatchActionRunning(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.leadUpdate(id, { status: newStatus }))
      );
      setLeads((prev) => prev.map((l) => (selectedIds.has(l.id) ? { ...l, status: newStatus } : l)));
      clearSelectedLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Eliminar lead de la base de datos?')) return;
    try {
      await api.leadDelete(id);
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
    if (!confirm(`Eliminar ${selectedIds.size} leads seleccionados?`)) return;
    setBatchActionRunning(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.leadDelete(id))
      );
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      clearSelectedLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setBatchActionRunning(false);
    }
  };

  const clearAllLeads = async () => {
    if (leads.length === 0) return;
    if (!confirm('Eliminar TODOS los leads de la base de datos?')) return;
    try {
      await Promise.all(
        leads.map((l) => api.leadDelete(l.id))
      );
      setLeads([]);
      clearSelectedLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const getFollowUpInfo = (lead: LeadView) => {
    const followUpCount = ((lead.metadata as any)?.followUpCount as number) || 0;
    if (lead.status !== 'contacted' || !lead.contactedAt) {
      return { isEligible: false, days: 0, count: followUpCount, label: '' };
    }
    const diffMs = Date.now() - new Date(lead.contactedAt).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return {
      isEligible: days >= 3,
      days,
      count: followUpCount,
      label: days === 0 ? 'Hoy' : `Hace ${days}d`,
    };
  };

  const handleSendFollowUp = async (lead: LeadView) => {
    try {
      setGeneratingPitchId(lead.id);
      const data = await api.leadGeneratePitch(lead.id, { isFollowUp: true });
      const pitch =
        data.pitch ||
        `Hola ${lead.name}! ¿Pudieron ver la propuesta y la demo interactiva que les armé el otro día (${lead.suggestedDemo ?? ''})? Cualquier duda me avisan!`;

      await navigator.clipboard.writeText(pitch);
      setCopiedToast(`Follow-up copiado. Pegalo en el chat de ${lead.name}`);
      setTimeout(() => setCopiedToast(null), 5000);

      const username = getInstagramUsername(lead.instagram);
      const targetUrl = username
        ? `https://www.instagram.com/${username}/`
        : lead.instagram || 'https://www.instagram.com/';
      window.open(targetUrl, '_blank');

      const currentCount = ((lead.metadata as any)?.followUpCount as number) || 0;
      const nextCount = currentCount + 1;
      const nowIso = new Date().toISOString();

      await api.leadUpdate(lead.id, {
        status: 'contacted',
        contactedAt: nowIso,
        metadata: {
          ...lead.metadata,
          followUpCount: nextCount,
          lastFollowUpSentAt: nowIso,
        },
      });

      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                contactedAt: nowIso,
                metadata: { ...l.metadata, followUpCount: nextCount },
              }
            : l
        )
      );
    } catch (err: any) {
      console.error('Follow-up error:', err);
    } finally {
      setGeneratingPitchId(null);
    }
  };

  const handleSaveNote = async (leadId: string, noteText: string) => {
    try {
      await api.leadUpdate(leadId, { notes: noteText });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes: noteText } : l)));
      setEditingNoteId(null);
      setCopiedToast('Nota guardada');
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCsv = () => {
    window.open(api.leadExportCsvUrl(), '_blank');
  };

  // --- Dynamic Pitch Resolution ---
  const getPitchForLead = (lead: LeadView | undefined, presetIdOverride?: string): string => {
    if (!lead) return '';
    const effPresetId = presetIdOverride || leadPresetOverrides[lead.id] || selectedSpeechPreset;
    const preset = speechPresets.find((p) => p.id === effPresetId) || speechPresets[0]!;
    return preset.template
      .replace(/{name}/g, lead.name)
      .replace(/{city}/g, lead.city.split(',')[0] ?? lead.city)
      .replace(/{rating}/g, lead.rating ? String(lead.rating) : '5.0')
      .replace(/{reviews}/g, String(lead.reviewsCount || 'varias'))
      .replace(/{category}/g, lead.category)
      .replace(/{demo}/g, lead.suggestedDemo ?? 'https://templates.nicoguzmandev.com/')
      .replace(/{website}/g, lead.website ?? lead.name);
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

  const handleOpenInstagramDM = (lead: LeadView, customPitchText?: string, presetIdOverride?: string) => {
    const pitch = customPitchText || aiPitchOverride || getPitchForLead(lead, presetIdOverride);
    const username = getInstagramUsername(lead.instagram);

    navigator.clipboard.writeText(pitch).then(() => {
      setCopiedToast(`Mensaje copiado. Pegalo en el chat de ${lead.name}`);
      setTimeout(() => setCopiedToast(null), 4000);
    }).catch(() => {});

    const targetUrl = username
      ? `https://www.instagram.com/${username}/`
      : (lead.instagram || 'https://www.instagram.com/');

    window.open(targetUrl, '_blank');

    // Auto mark as contacted (moves lead from Prospecting to Follow-ups)
    void updateStatus(lead.id, 'contacted');

    if (outreachOpen && outreachIndex + 1 < outreachQueue.length) {
      setOutreachIndex((i) => i + 1);
      setAiPitchOverride(null);
    }
  };

  // --- Segmentation for Tabs ---
  const prospectingLeads = leads.filter((l) => l.status === 'discovered' || l.status === 'enriched');
  const contactedLeads = leads.filter((l) => l.status === 'contacted' || l.status === 'replied' || l.status === 'converted');
  const needsFollowUpCount = contactedLeads.filter((l) => getFollowUpInfo(l).isEligible).length;

  // Filtered lists per tab
  const filteredProspecting = prospectingLeads.filter((l) => {
    if (filterWithoutWeb && l.hasWebsite) return false;
    if (filterIgVerifiedOnly && !(l.metadata as any)?.instagramVerified) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        (l.category?.toLowerCase().includes(q) ?? false) ||
        (l.phone?.includes(q) ?? false)
      );
    }
    return true;
  });

  const filteredFollowups = contactedLeads.filter((l) => {
    if (filterFollowupStatus === 'needs_follow_up' && !getFollowUpInfo(l).isEligible) return false;
    if (filterFollowupStatus === 'waiting' && getFollowUpInfo(l).isEligible) return false;
    if (filterFollowupStatus === 'replied' && l.status !== 'replied') return false;
    if (filterFollowupStatus === 'converted' && l.status !== 'converted') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        (l.phone?.includes(q) ?? false) ||
        (l.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const outreachQueue = leads.filter(
    (l) => Boolean(l.phoneFormatted) && (l.status === 'discovered' || l.status === 'enriched')
  );
  const currentOutreachLead = outreachQueue[outreachIndex];

  const toggleSelectAllProspecting = () => {
    selectProspectingAll(filteredProspecting.map((l) => l.id));
  };

  const loadWhatsAppStatus = async () => {
    try {
      const data = await api.whatsappStatus();
      setWaStatus(data.status);
    } catch {
      // ignore
    }
  };

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const data = await api.whatsappConnect();
      setWaStatus(data.status);
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaLoading(true);
    try {
      const data = await api.whatsappDisconnect();
      setWaStatus(data.status);
    } catch (err) {
      console.error(err);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    void loadWhatsAppStatus();
    const interval = setInterval(loadWhatsAppStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadQueueStatus = async () => {
    try {
      const data = await api.outreachStatus();
      setQueueStatus(data.status);
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
      const data = await api.leadGeneratePitch(lead.id, { isFollowUp: lead.status === 'contacted' });
      if (data.pitch) setAiPitchOverride(data.pitch);
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
      const res = await api.outreachQueue({ leadIds });
      if (res.ok) {
        await loadQueueStatus();
        await loadLeads();
        alert(`Campana iniciada: se encolaron ${leadIds.length} mensajes con despacho espaciado en segundo plano.`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setQueuingCampaign(false);
    }
  };

  // Preview lead for Tab 3
  const activePreviewLead = previewLeadId
    ? leads.find((l) => l.id === previewLeadId)
    : leads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Toast */}
      {copiedToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: '#047857',
            color: '#ecfdf5',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 9999,
          }}
        >
          {copiedToast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            B2B Sales & Outreach Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Live Google Maps business extraction, verified Instagram detection, and segmented outreach pipeline.
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
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
              Campana activa: {queueStatus.waiting} en cola ({queueStatus.active} enviando)
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
              gap: '0.5rem',
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

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.65rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('prospecting')}
          style={{
            background: activeTab === 'prospecting' ? '#1e293b' : 'transparent',
            border: `1px solid ${activeTab === 'prospecting' ? '#3b82f6' : 'transparent'}`,
            color: activeTab === 'prospecting' ? '#f8fafc' : '#94a3b8',
            borderRadius: '8px',
            padding: '0.55rem 1.1rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          Prospeccion en Frio
          <span style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            color: '#38bdf8',
          }}>
            {prospectingLeads.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('followups')}
          style={{
            background: activeTab === 'followups' ? '#1e293b' : 'transparent',
            border: `1px solid ${activeTab === 'followups' ? '#f59e0b' : 'transparent'}`,
            color: activeTab === 'followups' ? '#f8fafc' : '#94a3b8',
            borderRadius: '8px',
            padding: '0.55rem 1.1rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          Seguimientos & CRM
          <span style={{
            background: needsFollowUpCount > 0 ? '#451a03' : '#0f172a',
            border: `1px solid ${needsFollowUpCount > 0 ? '#b45309' : '#334155'}`,
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            color: needsFollowUpCount > 0 ? '#f59e0b' : '#94a3b8',
            fontWeight: 700,
          }}>
            {contactedLeads.length} {needsFollowUpCount > 0 ? `(${needsFollowUpCount} pendientes)` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('speeches')}
          style={{
            background: activeTab === 'speeches' ? '#1e293b' : 'transparent',
            border: `1px solid ${activeTab === 'speeches' ? '#10b981' : 'transparent'}`,
            color: activeTab === 'speeches' ? '#f8fafc' : '#94a3b8',
            borderRadius: '8px',
            padding: '0.55rem 1.1rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          Biblioteca de Speeches
          <span style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            color: '#34d399',
          }}>
            {speechPresets.length} presets
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROSPECCION EN FRIO (NUEVOS LEADS)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'prospecting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Prospecting Metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Nuevos Leads</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{prospectingLeads.length}</div>
            </div>

            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>Sin Sitio Web</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f87171', marginTop: '0.2rem' }}>
                {prospectingLeads.filter((l) => !l.hasWebsite).length}
              </div>
            </div>

            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>Instagram 200 OK</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {prospectingLeads.filter((l) => (l.metadata as any)?.instagramVerified === true).length}
              </div>
            </div>

            <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Con Contacto Directo</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                {prospectingLeads.filter((l) => l.instagram || l.phone).length}
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
                  {PRESET_AREAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="custom">+ Custom City...</option>
                </select>
                {city === 'custom' && (
                  <input
                    type="text"
                    placeholder="e.g. Villa Carlos Paz, Cordoba"
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

              {/* Limit input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '90px' }}>
                <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Max Leads</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value, 10) || 15))}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    borderRadius: '8px',
                    padding: '0.5rem 0.6rem',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={scraping}
                style={{
                  background: scraping ? '#1e293b' : '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: scraping ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {scraping ? 'Scraping Google Maps...' : 'Start Scraping'}
              </button>
            </form>
          </div>

          {/* Prospecting Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {/* Active Speech Preset Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Speech Activo:</span>
                <select
                  value={selectedSpeechPreset}
                  onChange={(e) => setSelectedSpeechPreset(e.target.value)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #3b82f6',
                    color: '#38bdf8',
                    borderRadius: '8px',
                    padding: '0.42rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                  title="Selecciona la plantilla de mensaje que se copiara al portapapeles al abrir Instagram"
                >
                  {speechPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter without website */}
              <button
                type="button"
                onClick={() => setFilterWithoutWeb(!filterWithoutWeb)}
                style={{
                  background: filterWithoutWeb ? '#450a0a' : '#1e293b',
                  border: `1px solid ${filterWithoutWeb ? '#7f1d1d' : '#334155'}`,
                  color: filterWithoutWeb ? '#f87171' : '#94a3b8',
                  borderRadius: '8px',
                  padding: '0.42rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {filterWithoutWeb ? 'Solo SIN website' : 'Todas las webs'}
              </button>

              {/* Filter Instagram 200 OK */}
              <button
                type="button"
                onClick={() => setFilterIgVerifiedOnly(!filterIgVerifiedOnly)}
                style={{
                  background: filterIgVerifiedOnly ? '#064e3b' : '#1e293b',
                  border: `1px solid ${filterIgVerifiedOnly ? '#059669' : '#334155'}`,
                  color: filterIgVerifiedOnly ? '#34d399' : '#94a3b8',
                  borderRadius: '8px',
                  padding: '0.42rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {filterIgVerifiedOnly ? 'Solo Instagram 200 OK' : 'Todos los Instagrams'}
              </button>

              {/* Verify all instagrams button */}
              <button
                type="button"
                onClick={() => void handleVerifyAllInstagram()}
                disabled={verifyingAllIg}
                style={{
                  background: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.42rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: verifyingAllIg ? 'not-allowed' : 'pointer',
                }}
                title="Chequea que todos los links de Instagram devuelvan HTTP 200 y no 404"
              >
                {verifyingAllIg ? 'Verificando...' : 'Verificar Instagrams (HTTP 200)'}
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.42rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Exportar CSV
              </button>

              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Mostrando: <strong style={{ color: '#f8fafc' }}>{filteredProspecting.length}</strong> / {prospectingLeads.length}
              </span>
            </div>

            <input
              type="text"
              placeholder="Buscar por nombre, rubro, ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.45rem 0.8rem',
                fontSize: '0.84rem',
                minWidth: '220px',
              }}
            />
          </div>

          {/* Sticky Bulk Action Bar */}
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
                  {selectedIds.size} leads seleccionados
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
                  Deseleccionar todos
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
                  Marcar Contactados ({selectedIds.size})
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
                  Descartar
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
                  Eliminar ({selectedIds.size})
                </button>
              </div>
            </div>
          )}

          {/* Prospecting Desktop Table */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.75rem', width: '36px' }}>
                      <input
                        type="checkbox"
                        checked={filteredProspecting.length > 0 && selectedIds.size === filteredProspecting.length}
                        onChange={toggleSelectAllProspecting}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '0.65rem 1rem' }}>Negocio</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Rubro / Ciudad</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Sitio Web</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Instagram (HTTP Check)</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Demo / Oferta</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Acciones Directas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProspecting.map((lead) => {
                    const isSelected = selectedIds.has(lead.id);
                    const igVerified = (lead.metadata as any)?.instagramVerified as boolean | undefined;
                    const igUsername = getInstagramUsername(lead.instagram);
                    const leadPresetId = leadPresetOverrides[lead.id] || selectedSpeechPreset;
                    const waNumber = lead.phoneFormatted ? lead.phoneFormatted.replace('+', '') : null;
                    const metaSource = (lead.metadata as { sourceUrl?: string })?.sourceUrl;
                    const mapsUrl = metaSource || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address}`)}`;

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
                          <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#f8fafc', textDecoration: 'none' }}
                              title="Ver en Google Maps"
                            >
                              {lead.name}
                            </a>
                          </div>
                          {lead.rating && (
                            <div style={{ fontSize: '0.75rem', color: '#facc15', marginTop: '2px' }}>
                              ★ {lead.rating} <span style={{ color: '#64748b' }}>({lead.reviewsCount} reviews)</span>
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            {lead.address}
                          </div>
                        </td>

                        {/* Category & City */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <div style={{ color: '#cbd5e1' }}>{lead.category}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{lead.city}</div>
                        </td>

                        {/* Website Status */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          {lead.hasWebsite && lead.website ? (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#38bdf8',
                                textDecoration: 'underline',
                                fontSize: '0.78rem',
                                wordBreak: 'break-all',
                              }}
                            >
                              {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          ) : (
                            <span
                              style={{
                                background: '#450a0a',
                                color: '#f87171',
                                border: '1px solid #7f1d1d',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              Sin Sitio Web
                            </span>
                          )}
                        </td>

                        {/* Instagram with HTTP Check */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          {lead.instagram ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <a
                                  href={lead.instagram}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: '#f43f5e', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                                >
                                  @{igUsername || 'perfil'}
                                </a>

                                {/* Verification Status Badge */}
                                {igVerified === true ? (
                                  <span
                                    style={{
                                      background: '#052e16',
                                      color: '#4ade80',
                                      border: '1px solid #166534',
                                      borderRadius: '4px',
                                      padding: '1px 5px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                    }}
                                    title="Respuesta HTTP 200 OK: el perfil existe"
                                  >
                                    200 OK
                                  </span>
                                ) : igVerified === false ? (
                                  <span
                                    style={{
                                      background: '#450a0a',
                                      color: '#f87171',
                                      border: '1px solid #7f1d1d',
                                      borderRadius: '4px',
                                      padding: '1px 5px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                    }}
                                    title="Respuesta HTTP 404: perfil inexistente o borrado"
                                  >
                                    404 Roto
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleVerifyInstagram(lead.id)}
                                    disabled={verifyingIgId === lead.id}
                                    style={{
                                      background: '#1e293b',
                                      border: '1px solid #334155',
                                      color: '#94a3b8',
                                      borderRadius: '4px',
                                      padding: '1px 5px',
                                      fontSize: '0.68rem',
                                      cursor: 'pointer',
                                    }}
                                    title="Verificar enlace HTTP 200"
                                  >
                                    {verifyingIgId === lead.id ? '...' : 'Test'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleEnrich(lead.id)}
                              disabled={enrichingId === lead.id}
                              style={{
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#93c5fd',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              {enrichingId === lead.id ? 'Buscando...' : 'Buscar Socials'}
                            </button>
                          )}
                        </td>

                        {/* Demo Assigned */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          {lead.suggestedDemo ? (
                            <a
                              href={lead.suggestedDemo}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#38bdf8', fontSize: '0.75rem', textDecoration: 'none' }}
                            >
                              Demo Demo ↗
                            </a>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Generica</span>
                          )}
                        </td>

                        {/* Direct Actions */}
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            {/* Preset Selector Dropdown per row */}
                            <select
                              value={leadPresetId}
                              onChange={(e) =>
                                setLeadPresetOverrides((prev) => ({ ...prev, [lead.id]: e.target.value }))
                              }
                              style={{
                                background: '#0f172a',
                                border: '1px solid #334155',
                                color: '#cbd5e1',
                                borderRadius: '6px',
                                padding: '0.25rem 0.4rem',
                                fontSize: '0.72rem',
                              }}
                              title="Seleccionar speech para este lead"
                            >
                              {speechPresets.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label.split('(')[0]?.trim()}
                                </option>
                              ))}
                            </select>

                            {/* Instagram DM Button */}
                            {lead.instagram && (
                              <button
                                type="button"
                                onClick={() => handleOpenInstagramDM(lead, undefined, leadPresetId)}
                                style={{
                                  background: '#e11d48',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '0.28rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Copia el speech seleccionado y abre el chat de Instagram"
                              >
                                Abrir DM
                              </button>
                            )}

                            {/* WhatsApp Button */}
                            {waNumber && (
                              <a
                                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(getPitchForLead(lead, leadPresetId))}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => void updateStatus(lead.id, 'contacted')}
                                style={{
                                  background: '#064e3b',
                                  border: '1px solid #059669',
                                  color: '#6ee7b7',
                                  padding: '0.28rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                              >
                                WhatsApp
                              </a>
                            )}

                            {/* Discard button */}
                            <button
                              type="button"
                              onClick={() => void updateStatus(lead.id, 'discarded')}
                              style={{
                                background: 'transparent',
                                border: '1px solid #334155',
                                color: '#94a3b8',
                                padding: '0.28rem 0.4rem',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                              title="Descartar"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredProspecting.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No hay leads nuevos con los filtros actuales. Ejecuta una busqueda en Google Maps arriba.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SEGUIMIENTOS & CRM (CONTACTADOS)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'followups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Follow-up Overview Strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div
              onClick={() => setFilterFollowupStatus('all')}
              style={{
                background: filterFollowupStatus === 'all' ? '#1e293b' : '#0b0f19',
                border: `1px solid ${filterFollowupStatus === 'all' ? '#3b82f6' : '#1e293b'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Contactados</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{contactedLeads.length}</div>
            </div>

            <div
              onClick={() => setFilterFollowupStatus('needs_follow_up')}
              style={{
                background: filterFollowupStatus === 'needs_follow_up' ? '#422006' : '#0b0f19',
                border: `1px solid ${filterFollowupStatus === 'needs_follow_up' ? '#f59e0b' : '#1e293b'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 600 }}>
                Requieren Follow-up (3+d)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
                {needsFollowUpCount}
              </div>
            </div>

            <div
              onClick={() => setFilterFollowupStatus('waiting')}
              style={{
                background: filterFollowupStatus === 'waiting' ? '#1e293b' : '#0b0f19',
                border: `1px solid ${filterFollowupStatus === 'waiting' ? '#64748b' : '#1e293b'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>En Espera (&lt;3d)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
                {contactedLeads.length - needsFollowUpCount}
              </div>
            </div>

            <div
              onClick={() => setFilterFollowupStatus('replied')}
              style={{
                background: filterFollowupStatus === 'replied' ? '#064e3b' : '#0b0f19',
                border: `1px solid ${filterFollowupStatus === 'replied' ? '#059669' : '#1e293b'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Respondieron</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                {leads.filter((l) => l.status === 'replied').length}
              </div>
            </div>

            <div
              onClick={() => setFilterFollowupStatus('converted')}
              style={{
                background: filterFollowupStatus === 'converted' ? '#052e16' : '#0b0f19',
                border: `1px solid ${filterFollowupStatus === 'converted' ? '#166534' : '#1e293b'}`,
                borderRadius: '10px',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#4ade80', textTransform: 'uppercase', fontWeight: 600 }}>Clientes Ganados</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80', marginTop: '0.2rem' }}>
                {leads.filter((l) => l.status === 'converted').length}
              </div>
            </div>
          </div>

          {/* Follow-up Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <select
                value={filterFollowupStatus}
                onChange={(e) => setFilterFollowupStatus(e.target.value)}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                }}
              >
                <option value="all">Todos los contactados</option>
                <option value="needs_follow_up">Requieren Follow-up (3+ dias)</option>
                <option value="waiting">En espera reciente (&lt; 3 dias)</option>
                <option value="replied">Respondieron / Negociacion</option>
                <option value="converted">Clientes Ganados</option>
              </select>

              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Exportar CSV
              </button>

              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Mostrando: <strong style={{ color: '#f8fafc' }}>{filteredFollowups.length}</strong> / {contactedLeads.length}
              </span>
            </div>

            <input
              type="text"
              placeholder="Buscar por negocio, ciudad o nota de venta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '0.45rem 0.8rem',
                fontSize: '0.84rem',
                minWidth: '260px',
              }}
            />
          </div>

          {/* Follow-ups Desktop Table */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Negocio & Instagram</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Estado Actual</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Ultimo Contacto</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Historial Follow-ups</th>
                    <th style={{ padding: '0.65rem 1rem', width: '280px' }}>Notas de Venta (Click para editar)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFollowups.map((lead) => {
                    const followUpInfo = getFollowUpInfo(lead);
                    const igUsername = getInstagramUsername(lead.instagram);
                    const waNumber = lead.phoneFormatted ? lead.phoneFormatted.replace('+', '') : null;

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderTop: '1px solid #1e293b',
                          color: '#e2e8f0',
                          background: followUpInfo.isEligible ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                        }}
                      >
                        {/* Business & Instagram */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>{lead.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.city} • {lead.category}</div>
                          {lead.instagram && (
                            <a
                              href={lead.instagram}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#f43f5e', fontSize: '0.75rem', textDecoration: 'none' }}
                            >
                              @{igUsername || 'instagram'}
                            </a>
                          )}
                        </td>

                        {/* Status Change Dropdown */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <select
                            value={lead.status}
                            onChange={(e) => void updateStatus(lead.id, e.target.value as LeadStatus)}
                            style={{
                              background: STATUS_BADGES[lead.status]?.bg || '#1e293b',
                              color: STATUS_BADGES[lead.status]?.color || '#f8fafc',
                              border: `1px solid ${STATUS_BADGES[lead.status]?.border || '#334155'}`,
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="contacted">Contacted</option>
                            <option value="replied">Replied (En conversacion)</option>
                            <option value="converted">Client Won! (Convertido)</option>
                            <option value="discarded">Discarded</option>
                          </select>
                        </td>

                        {/* Last Contact */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          {followUpInfo.isEligible ? (
                            <span
                              style={{
                                background: '#451a03',
                                color: '#f59e0b',
                                border: '1px solid #b45309',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              {followUpInfo.label} (3+d pendiente)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                              {followUpInfo.label || 'Reciente'}
                            </span>
                          )}
                        </td>

                        {/* Follow-up count */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '12px',
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              color: '#cbd5e1',
                            }}
                          >
                            {followUpInfo.count === 0 ? 'Sin follow-ups aun' : `${followUpInfo.count} enviado${followUpInfo.count > 1 ? 's' : ''}`}
                          </span>
                        </td>

                        {/* Inline Sales Notes */}
                        <td style={{ padding: '0.65rem 1rem' }}>
                          {editingNoteId === lead.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <textarea
                                autoFocus
                                rows={2}
                                value={noteDraftText}
                                onChange={(e) => setNoteDraftText(e.target.value)}
                                style={{
                                  background: '#0f172a',
                                  border: '1px solid #38bdf8',
                                  color: '#f8fafc',
                                  borderRadius: '4px',
                                  padding: '0.3rem',
                                  fontSize: '0.75rem',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveNote(lead.id, noteDraftText)}
                                  style={{
                                    background: '#0284c7',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '3px',
                                    padding: '2px 6px',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  style={{
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    border: '1px solid #334155',
                                    borderRadius: '3px',
                                    padding: '2px 6px',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNoteId(lead.id);
                                setNoteDraftText(lead.notes || '');
                              }}
                              style={{
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: lead.notes ? '#cbd5e1' : '#64748b',
                                background: lead.notes ? 'rgba(255,255,255,0.03)' : 'transparent',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px dashed #334155',
                                lineHeight: '1.3',
                                maxHeight: '60px',
                                overflowY: 'auto',
                                wordBreak: 'break-word',
                              }}
                              title="Hacé clic para escribir o editar notas"
                            >
                              {lead.notes || '+ Agregar nota de venta...'}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            {lead.instagram && (
                              <button
                                type="button"
                                disabled={generatingPitchId === lead.id}
                                onClick={() => void handleSendFollowUp(lead)}
                                style={{
                                  background: followUpInfo.isEligible ? '#d97706' : '#1e293b',
                                  border: `1px solid ${followUpInfo.isEligible ? '#f59e0b' : '#334155'}`,
                                  color: followUpInfo.isEligible ? '#ffffff' : '#f59e0b',
                                  padding: '0.28rem 0.65rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Genera/copia mensaje de seguimiento amigable, abre Instagram y suma el contador"
                              >
                                Follow-up
                              </button>
                            )}

                            {waNumber && (
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: '#064e3b',
                                  border: '1px solid #059669',
                                  color: '#6ee7b7',
                                  padding: '0.28rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredFollowups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No hay leads contactados en esta seccion. Al hacer el primer contacto en Prospeccion, apareceran aca automaticamente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BIBLIOTECA DE SPEECHES & OFERTAS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'speeches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: '#f8fafc' }}>
              Biblioteca de Speeches & Ofertas
            </h2>
            <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
              Elegi y edita los discursos de prospeccion. Al hacer clic en Abrir DM en la tabla, el sistema completara automaticamente las variables dinamicas ({'{name}'}, {'{city}'}, {'{category}'}, {'{demo}'}).
            </p>
          </div>

          {/* Preset Cards Grid */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {speechPresets.map((preset) => {
              const isActive = selectedSpeechPreset === preset.id;

              return (
                <div
                  key={preset.id}
                  style={{
                    background: '#0b0f19',
                    border: `1px solid ${isActive ? '#10b981' : '#1e293b'}`,
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>
                        {preset.label}
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {preset.description}
                      </p>
                    </div>
                    {isActive && (
                      <span
                        style={{
                          background: '#064e3b',
                          color: '#34d399',
                          border: '1px solid #059669',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        Predeterminado
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={6}
                    value={preset.template}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setSpeechPresets((prev) =>
                        prev.map((p) => (p.id === preset.id ? { ...p, template: newText } : p))
                      );
                    }}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      padding: '0.6rem',
                      fontSize: '0.8rem',
                      lineHeight: '1.4',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSpeechPreset(preset.id);
                      setCopiedToast(`Preset "${preset.label}" seleccionado como predeterminado`);
                      setTimeout(() => setCopiedToast(null), 3000);
                    }}
                    style={{
                      background: isActive ? '#059669' : '#1e293b',
                      border: `1px solid ${isActive ? '#10b981' : '#334155'}`,
                      color: isActive ? '#ffffff' : '#94a3b8',
                      padding: '0.45rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isActive ? 'Preset Activo' : 'Usar como Predeterminado'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Live Preview Section */}
          <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>
                  Vista Previa en Vivo (Como llega al portapapeles)
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Simulacion con datos reales del lead seleccionado.
                </p>
              </div>

              {leads.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Lead de prueba:</span>
                  <select
                    value={activePreviewLead?.id || ''}
                    onChange={(e) => setPreviewLeadId(e.target.value)}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    {leads.slice(0, 20).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {activePreviewLead ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {getPitchForLead(activePreviewLead, selectedSpeechPreset)}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const text = getPitchForLead(activePreviewLead, selectedSpeechPreset);
                      navigator.clipboard.writeText(text);
                      setCopiedToast('Mensaje de prueba copiado al portapapeles');
                      setTimeout(() => setCopiedToast(null), 3000);
                    }}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Copiar Mensaje de Prueba
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                No hay leads cargados para simular la vista previa. Ejecuta una busqueda primero.
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {waModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                Conexion WhatsApp Web
              </h3>
              <button
                type="button"
                onClick={() => setWaModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
              Estado actual: <strong style={{ color: waStatus.state === 'connected' ? '#34d399' : '#facc15' }}>{waStatus.state}</strong>
            </div>

            {waStatus.qrDataUrl && waStatus.state === 'waiting_qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                <img src={waStatus.qrDataUrl} alt="WhatsApp QR" style={{ width: '220px', height: '220px', borderRadius: '8px' }} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Escanea el codigo desde WhatsApp en tu telefono (Dispositivos vinculados).
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
              {waStatus.state !== 'connected' ? (
                <button
                  type="button"
                  onClick={() => void handleConnectWhatsApp()}
                  disabled={waLoading}
                  style={{
                    flex: 1,
                    background: '#059669',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: waLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {waLoading ? 'Iniciando...' : 'Generar Codigo QR'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleDisconnectWhatsApp()}
                  disabled={waLoading}
                  style={{
                    flex: 1,
                    background: '#dc2626',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: waLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {waLoading ? 'Desconectando...' : 'Desconectar WhatsApp'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
