import { useEffect, useState } from 'react';
import {
  api,
  isNetworkError,
  isUnauthorized,
} from '../api.ts';
import type {
  MarketingOverview,
  SocialDraftView,
  SocialDraftStatus,
  SocialPlatform,
  SocialPostType,
  AdCampaignView,
  BrandView,
} from '@cc/shared';

export function MarketingPage() {
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [drafts, setDrafts] = useState<SocialDraftView[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignView[]>([]);
  const [auditInfo, setAuditInfo] = useState<any>(null);
  const [brands, setBrands] = useState<BrandView[]>([]);
  const [selectedBrandSlug, setSelectedBrandSlug] = useState('nikipeppers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'creative' | 'ads' | 'client_portal' | 'brand'>('creative');

  // Creative Studio State
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newPlatform, setNewPlatform] = useState<SocialPlatform>('INSTAGRAM');
  const [newPostType, setNewPostType] = useState<SocialPostType>('REEL');
  const [newObjective, setNewObjective] = useState('Conversiones a venta en web');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newScheduledDate, setNewScheduledDate] = useState('');

  // Dispatch / Approval state
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectFeedbackDraftId, setRejectFeedbackDraftId] = useState<string | null>(null);
  const [rejectFeedbackText, setRejectFeedbackText] = useState('');

  // Ads state
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editBudgetVal, setEditBudgetVal] = useState<number>(0);
  const [auditingAds, setAuditingAds] = useState(false);

  // Client Portal test token
  const [clientTestToken, setClientTestToken] = useState<string>('');
  const [publicDraftData, setPublicDraftData] = useState<{ draft: SocialDraftView; brand: BrandView } | null>(null);
  const [publicActionLoading, setPublicActionLoading] = useState(false);

  // Brand edit state
  const [brandTone, setBrandTone] = useState('');
  const [brandWhatsapp, setBrandWhatsapp] = useState('');
  const [brandAudience, setBrandAudience] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadData = async (slug = selectedBrandSlug) => {
    setLoading(true);
    setError(null);
    try {
      const [ovData, draftsData, adsData, brandsData] = await Promise.all([
        api.marketingOverview(slug),
        api.marketingDrafts({ brandSlug: slug }),
        api.marketingAds({ brandSlug: slug }),
        api.marketingBrands(),
      ]);

      setOverview(ovData);
      setDrafts(draftsData.drafts);
      setCampaigns(adsData.campaigns);
      setAuditInfo(adsData.audit);
      setBrands(brandsData.brands);

      if (ovData.brand) {
        setBrandTone(ovData.brand.toneOfVoice);
        setBrandWhatsapp(ovData.brand.whatsappNumber || '');
        setBrandAudience(ovData.brand.targetAudience || '');
      }

      // Pick first draft token for client portal simulation if available
      if (draftsData.drafts.length > 0 && draftsData.drafts[0]) {
        setClientTestToken(draftsData.drafts[0].approvalToken);
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        setError('Tu sesión ha expirado. Por favor iniciá sesión nuevamente.');
      } else if (isNetworkError(err)) {
        setError('No se pudo conectar con el servidor.');
      } else {
        setError(err instanceof Error ? err.message : 'Error al cargar datos de marketing');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(selectedBrandSlug);
  }, [selectedBrandSlug]);

  // Load public preview for client portal tab
  useEffect(() => {
    if (clientTestToken && activeTab === 'client_portal') {
      void (async () => {
        try {
          const res = await api.marketingPublicDraft(clientTestToken);
          setPublicDraftData(res);
        } catch {
          setPublicDraftData(null);
        }
      })();
    }
  }, [clientTestToken, activeTab]);

  // Handle draft generation with AI
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setIsGenerating(true);
    try {
      const res = await api.marketingGenerateDraft({
        brandSlug: selectedBrandSlug,
        platform: newPlatform,
        postType: newPostType,
        topic: newTopic.trim(),
        objective: newObjective.trim(),
        mediaUrls: newMediaUrl.trim() ? [newMediaUrl.trim()] : undefined,
        scheduledFor: newScheduledDate ? new Date(newScheduledDate).toISOString() : undefined,
      });

      setDrafts((prev) => [res.draft, ...prev]);
      setShowGenerateModal(false);
      setNewTopic('');
      setNewMediaUrl('');
      showToast(`✨ Borrador generado exitosamente por el Creative Agent (${res.creativeInfo?.source === 'ai' ? 'Gemini AI' : 'Motor Creativo'})`);
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err.message || 'Error al generar borrador');
    } finally {
      setIsGenerating(false);
    }
  };

  // Status change (Approve, Reject, Draft, Published)
  const handleUpdateStatus = async (id: string, status: SocialDraftStatus, feedback?: string) => {
    setStatusUpdatingId(id);
    try {
      const res = await api.marketingUpdateDraftStatus(id, status, feedback);
      setDrafts((prev) => prev.map((d) => (d.id === id ? res.draft : d)));
      setRejectFeedbackDraftId(null);
      setRejectFeedbackText('');
      showToast(status === 'APPROVED' ? '✓ Post aprobado para publicación' : `Estado actualizado a ${status}`);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Dispatch approval via WhatsApp
  const handleDispatchApproval = async (id: string) => {
    setDispatchingId(id);
    try {
      const res = await api.marketingDispatchApproval(id);
      if (res.ok) {
        showToast(`📲 Previsualización y enlace de aprobación despachados vía ${res.channel.toUpperCase()} a ${res.recipient}`);
      } else {
        alert(res.error || 'Error al despachar aprobación');
      }
    } catch (err: any) {
      alert(err.message || 'Error al despachar aprobación');
    } finally {
      setDispatchingId(null);
    }
  };

  // Ad Campaign Update (Budget / Status with Safety Guardrail)
  const handleSaveBudget = async (campaign: AdCampaignView) => {
    if (editBudgetVal > campaign.safetyGuardrail) {
      alert(`🛑 ERROR DE SEGURIDAD (GUARDRAIL): El presupuesto solicitado ($${editBudgetVal}) supera el límite máximo de $${campaign.safetyGuardrail}. La IA y el sistema tienen prohibido sobrepasarlo.`);
      return;
    }

    try {
      const res = await api.marketingUpdateAdCampaign(campaign.id, { dailyBudget: editBudgetVal });
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? res.campaign : c)));
      setEditingCampaignId(null);
      showToast(`Presupuesto diario actualizado a $${editBudgetVal.toFixed(2)}/día dentro del guardrail de seguridad`);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar presupuesto');
    }
  };

  const handleToggleAdStatus = async (campaign: AdCampaignView) => {
    const nextStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await api.marketingUpdateAdCampaign(campaign.id, { status: nextStatus });
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? res.campaign : c)));
      showToast(`Campaña ${campaign.campaignName} marcada como ${nextStatus}`);
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado de campaña');
    }
  };

  // Run Ad Audit
  const handleRunAudit = async () => {
    setAuditingAds(true);
    try {
      const res = await api.marketingAuditAds();
      setAuditInfo(res.audit);
      showToast('🛡️ Auditoría de Pauta completada. Guardrails y rendimientos verificados.');
    } catch (err: any) {
      alert(err.message || 'Error al auditar pauta');
    } finally {
      setAuditingAds(false);
    }
  };

  // Save Brand settings
  const handleSaveBrand = async () => {
    setSavingBrand(true);
    try {
      const res = await api.marketingUpsertBrand({
        slug: selectedBrandSlug,
        name: overview?.brand?.name || 'Niki Peppers',
        website: overview?.brand?.website || 'https://nikipeppers.com',
        toneOfVoice: brandTone,
        whatsappNumber: brandWhatsapp,
        targetAudience: brandAudience,
      });
      showToast('✓ Directivas de marca y tono de voz actualizados con éxito');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err.message || 'Error al guardar configuración de marca');
    } finally {
      setSavingBrand(false);
    }
  };

  // Filtered drafts
  const filteredDrafts = drafts.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterPlatform !== 'all' && d.platform !== filterPlatform) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: '#09090b',
            color: '#fafafa',
            border: '1px solid #27272a',
            padding: '14px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Brand Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Growth & Marketing Engine
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#450a0a',
                color: '#f87171',
                border: '1px solid #7f1d1d',
                letterSpacing: '0.05em',
              }}
            >
              Piloto Autónomo
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Supervisión algorítmica de pauta publicitaria (Meta & Google Ads) y agente de contenido con aprobación humana
          </p>
        </div>

        {/* Brand Selector & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>Marca:</span>
            <select
              value={selectedBrandSlug}
              onChange={(e) => setSelectedBrandSlug(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name} ({b.website})
                </option>
              ))}
              {brands.length === 0 && <option value="nikipeppers">Niki Peppers (nikipeppers.com)</option>}
            </select>
          </div>

          <button
            onClick={() => setShowGenerateModal(true)}
            style={{
              background: '#e11d48',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)',
            }}
          >
            <span>✨</span>
            <span>Generar Borrador con IA</span>
          </button>
        </div>
      </div>

      {/* Overview Cards & Safety Guardrails Strip */}
      {overview && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* Daily Budget vs Guardrail */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '18px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Pauta Diaria / Guardrail
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: overview.ads.guardrailBreachedCount > 0 ? '#450a0a' : '#052e16',
                  color: overview.ads.guardrailBreachedCount > 0 ? '#f87171' : '#4ade80',
                  border: `1px solid ${overview.ads.guardrailBreachedCount > 0 ? '#991b1b' : '#166534'}`,
                }}
              >
                {overview.ads.guardrailBreachedCount > 0 ? '⚠️ Guardrail Breached' : '🛡️ Límite Seguro'}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
              ${overview.ads.totalDailyBudget.toFixed(2)}
              <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
                {' '}
                / max ${overview.ads.safetyGuardrailTotal.toFixed(2)} día
              </span>
            </div>
            <div style={{ marginTop: '10px', height: '6px', background: '#27272a', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (overview.ads.totalDailyBudget / (overview.ads.safetyGuardrailTotal || 1)) * 100)}%`,
                  background: overview.ads.totalDailyBudget > overview.ads.safetyGuardrailTotal ? '#ef4444' : '#10b981',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>

          {/* Performance: Blended ROAS & CPA */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '18px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Retorno Pauta (Blended ROAS)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>{overview.ads.avgRoas.toFixed(2)}x</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>CPA Prom: ${overview.ads.avgCpa.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              Gasto total acumulado: <strong>${overview.ads.totalSpendToDate.toFixed(2)}</strong> ({overview.ads.activeCampaignsCount} campañas activas)
            </div>
          </div>

          {/* Pending Approvals */}
          <div
            style={{
              background: 'var(--surface)',
              border: overview.social.pendingApprovalsCount > 0 ? '1px solid #f59e0b' : '1px solid var(--border)',
              borderRadius: '12px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Human-in-the-Loop
              </span>
              {overview.social.pendingApprovalsCount > 0 && (
                <span style={{ background: '#78350f', color: '#fcd34d', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                  Requiere Aprobación
                </span>
              )}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: overview.social.pendingApprovalsCount > 0 ? '#f59e0b' : 'inherit' }}>
              {overview.social.pendingApprovalsCount}{' '}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>posts pendientes</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              {overview.social.approvedScheduledCount} aprobados/programados · {overview.social.publishedCount} publicados
            </div>
          </div>

          {/* Autonomous Agents Status */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '18px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estado Agentes Autónomos
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  Traffic Guardian
                </span>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>ACTIVO</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                  Social Creative
                </span>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>GEMINI 3.8 / 2.5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        <button
          onClick={() => setActiveTab('creative')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'creative' ? '2px solid #e11d48' : '2px solid transparent',
            color: activeTab === 'creative' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'creative' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📸</span>
          <span>Social Creative Agent (Borradores & Aprobación)</span>
          {overview && overview.social.pendingApprovalsCount > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: '#f59e0b',
                color: '#000',
                fontWeight: 700,
              }}
            >
              {overview.social.pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ads')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ads' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'ads' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'ads' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📊</span>
          <span>Ads & Traffic Engine (Meta & Google)</span>
        </button>

        <button
          onClick={() => setActiveTab('client_portal')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'client_portal' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'client_portal' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'client_portal' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📲</span>
          <span>Simulador Portal Cliente (Token Aprobación)</span>
        </button>

        <button
          onClick={() => setActiveTab('brand')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'brand' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: activeTab === 'brand' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'brand' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🌶️</span>
          <span>Directivas de Marca & Tono</span>
        </button>
      </div>

      {/* TAB 1: SOCIAL CREATIVE STUDIO */}
      {activeTab === 'creative' && (
        <div>
          {/* Filter Bar & Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Estado:</span>
              {(['all', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'PUBLISHED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: filterStatus === st ? '1px solid var(--ink)' : '1px solid var(--border)',
                    background: filterStatus === st ? 'var(--ink)' : 'var(--surface)',
                    color: filterStatus === st ? 'var(--page)' : 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {st === 'all'
                    ? 'Todos'
                    : st === 'PENDING_APPROVAL'
                    ? '⏳ Pendientes'
                    : st === 'APPROVED'
                    ? '✅ Aprobados'
                    : st === 'DRAFT'
                    ? '📝 Borradores'
                    : '🚀 Publicados'}
                </button>
              ))}

              <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '12px' }}>Plataforma:</span>
              {(['all', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK'] as const).map((plat) => (
                <button
                  key={plat}
                  onClick={() => setFilterPlatform(plat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: filterPlatform === plat ? '1px solid #3b82f6' : '1px solid var(--border)',
                    background: filterPlatform === plat ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface)',
                    color: filterPlatform === plat ? '#3b82f6' : 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {plat === 'all' ? 'Todas' : plat}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Mostrando <strong>{filteredDrafts.length}</strong> borradores de contenido
            </div>
          </div>

          {/* Drafts Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredDrafts.map((draft) => {
              const isPending = draft.status === 'PENDING_APPROVAL';
              const isApproved = draft.status === 'APPROVED';
              const isPublished = draft.status === 'PUBLISHED';
              const isRejected = draft.status === 'REJECTED';

              return (
                <div
                  key={draft.id}
                  style={{
                    background: 'var(--surface)',
                    border: isPending ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: isPending ? '0 4px 20px rgba(245, 158, 11, 0.08)' : 'none',
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background:
                            draft.platform === 'INSTAGRAM'
                              ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'
                              : draft.platform === 'TIKTOK'
                              ? '#000000'
                              : '#1877f2',
                          color: '#fff',
                        }}
                      >
                        {draft.platform} · {draft.postType}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {draft.brandName || selectedBrandSlug}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: isPending
                          ? '#78350f'
                          : isApproved
                          ? '#052e16'
                          : isPublished
                          ? '#1e3a8a'
                          : isRejected
                          ? '#450a0a'
                          : '#27272a',
                        color: isPending
                          ? '#fde68a'
                          : isApproved
                          ? '#86efac'
                          : isPublished
                          ? '#bfdbfe'
                          : isRejected
                          ? '#fca5a5'
                          : '#a1a1aa',
                        border: `1px solid ${
                          isPending
                            ? '#b45309'
                            : isApproved
                            ? '#166534'
                            : isPublished
                            ? '#1d4ed8'
                            : isRejected
                            ? '#991b1b'
                            : '#3f3f46'
                        }`,
                      }}
                    >
                      {draft.status}
                    </span>
                  </div>

                  {/* Media Visual Preview */}
                  {draft.mediaUrls && draft.mediaUrls.length > 0 && (
                    <div style={{ width: '100%', height: '200px', background: '#111', overflow: 'hidden', position: 'relative' }}>
                      <img
                        src={draft.mediaUrls[0]}
                        alt="Creative Asset"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {draft.mediaUrls.length > 1 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          1/{draft.mediaUrls.length} Carrusel
                        </span>
                      )}
                    </div>
                  )}

                  {/* Caption & Body */}
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontSize: '13.5px',
                        lineHeight: '1.55',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--ink)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                      }}
                    >
                      {draft.caption}
                    </div>

                    {/* Feedback box if any */}
                    {draft.feedback && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderLeft: '3px solid #ef4444',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#ef4444',
                        }}
                      >
                        <strong>Feedback cliente:</strong> {draft.feedback}
                      </div>
                    )}

                    {/* Scheduled Info */}
                    <div style={{ marginTop: 'auto', paddingTop: '12px', fontSize: '11.5px', color: 'var(--muted)' }}>
                      🗓️ {draft.scheduledFor ? `Programado: ${new Date(draft.scheduledFor).toLocaleString('es-AR')}` : 'Sin fecha fija (inmediato post-aprobación)'}
                    </div>
                  </div>

                  {/* Card Actions Toolbar */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.01)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    {isPending && (
                      <>
                        <button
                          disabled={statusUpdatingId === draft.id}
                          onClick={() => handleUpdateStatus(draft.id, 'APPROVED')}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>✓</span>
                          <span>Aprobar</span>
                        </button>

                        <button
                          disabled={statusUpdatingId === draft.id}
                          onClick={() => {
                            setRejectFeedbackDraftId(draft.id);
                            setRejectFeedbackText('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        disabled={statusUpdatingId === draft.id}
                        onClick={() => handleUpdateStatus(draft.id, 'PUBLISHED')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🚀 Marcar Publicado
                      </button>
                    )}

                    {/* Dispatch to WhatsApp */}
                    <button
                      disabled={dispatchingId === draft.id}
                      onClick={() => handleDispatchApproval(draft.id)}
                      title="Enviar vista previa a WhatsApp del cliente"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: '#065f46',
                        color: '#34d399',
                        border: '1px solid #059669',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>📲</span>
                      <span>{dispatchingId === draft.id ? 'Enviando...' : 'WhatsApp'}</span>
                    </button>

                    {/* Client Portal Link */}
                    <button
                      onClick={() => {
                        setClientTestToken(draft.approvalToken);
                        setActiveTab('client_portal');
                      }}
                      title="Simular cómo ve el cliente el post con su token único"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      🔗 Ver Portal
                    </button>
                  </div>

                  {/* Reject Feedback prompt inline */}
                  {rejectFeedbackDraftId === draft.id && (
                    <div style={{ padding: '12px 16px', background: '#1c1917', borderTop: '1px solid #44403c' }}>
                      <label style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                        Motivo o ajustes solicitados por el cliente:
                      </label>
                      <input
                        type="text"
                        value={rejectFeedbackText}
                        onChange={(e) => setRejectFeedbackText(e.target.value)}
                        placeholder="Ej: Cambiar foto por frasco Scorpion Habanero"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: '#0c0a09',
                          border: '1px solid #78350f',
                          color: '#fff',
                          borderRadius: '6px',
                          fontSize: '12px',
                          marginBottom: '8px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleUpdateStatus(draft.id, 'REJECTED', rejectFeedbackText)}
                          style={{
                            padding: '6px 12px',
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Confirmar Rechazo
                        </button>
                        <button
                          onClick={() => setRejectFeedbackDraftId(null)}
                          style={{
                            padding: '6px 10px',
                            background: 'transparent',
                            color: '#a8a29e',
                            border: 'none',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredDrafts.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>No hay borradores con estos filtros</h3>
              <p style={{ margin: '8px 0 16px', fontSize: '13px', color: 'var(--muted)' }}>
                Podés pedirle al Social Creative Agent que elabore un post nuevo adaptado al tono de Niki Peppers.
              </p>
              <button
                onClick={() => setShowGenerateModal(true)}
                style={{
                  background: '#e11d48',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Crear Primer Borrador
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADS & TRAFFIC ENGINE */}
      {activeTab === 'ads' && (
        <div>
          {/* Hardcoded Safety Guardrail Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 95, 70, 0.15))',
              border: '1px solid #059669',
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#34d399' }}>
                  Safety Guardrails Activos (Límites Estrictos de Presupuesto)
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink-2)', maxWidth: '800px', lineHeight: 1.4 }}>
                El algoritmo de optimización tiene estrictamente prohibido incrementar los presupuestos diarios por encima del{' '}
                <strong>safetyGuardrail</strong> configurado por el cliente (${overview?.ads.safetyGuardrailTotal.toFixed(2)}/día acumulado). Cualquier intento de sobrepasar este límite es bloqueado a nivel base de datos.
              </p>
            </div>

            <button
              disabled={auditingAds}
              onClick={handleRunAudit}
              style={{
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{auditingAds ? 'Auditando...' : '🔍 Auditar Campañas con IA'}</span>
            </button>
          </div>

          {/* Audit Recommendations Banner if available */}
          {auditInfo && (auditInfo.safetyAlerts?.length > 0 || auditInfo.recommendations?.length > 0) && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤖 Diagnóstico del Traffic Guardian Agent</span>
              </h4>
              {auditInfo.safetyAlerts?.map((alert: string, idx: number) => (
                <div key={idx} style={{ fontSize: '13px', color: '#f87171', marginBottom: '6px' }}>
                  {alert}
                </div>
              ))}
              {auditInfo.recommendations?.map((rec: string, idx: number) => (
                <div key={idx} style={{ fontSize: '13px', color: '#38bdf8', marginBottom: '6px' }}>
                  {rec}
                </div>
              ))}
            </div>
          )}

          {/* Active Campaigns Cards / Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {campaigns.map((camp) => {
              const isOverBudget = camp.dailyBudget > camp.safetyGuardrail;
              const isNearLimit = camp.dailyBudget >= camp.safetyGuardrail * 0.9;

              return (
                <div
                  key={camp.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Campaign Header */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: camp.platform === 'META' ? '#1877f2' : '#ea4335',
                          color: '#fff',
                        }}
                      >
                        {camp.platform === 'META' ? 'Meta Ads' : 'Google Ads'}
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{camp.campaignName}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          ID: {camp.externalCampaignId} · Objetivo: {camp.objective}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          background: camp.status === 'ACTIVE' ? '#052e16' : '#27272a',
                          color: camp.status === 'ACTIVE' ? '#4ade80' : '#a1a1aa',
                          border: `1px solid ${camp.status === 'ACTIVE' ? '#166534' : '#3f3f46'}`,
                        }}
                      >
                        {camp.status}
                      </span>
                      <button
                        onClick={() => handleToggleAdStatus(camp)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--ink)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {camp.status === 'ACTIVE' ? 'Pausar' : 'Reanudar'}
                      </button>
                    </div>
                  </div>

                  {/* Metrics Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '12px',
                      background: 'rgba(0,0,0,0.02)',
                      padding: '12px',
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Presupuesto Diario</span>
                      {editingCampaignId === camp.id ? (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <input
                            type="number"
                            value={editBudgetVal}
                            onChange={(e) => setEditBudgetVal(Number(e.target.value))}
                            style={{
                              width: '70px',
                              padding: '4px',
                              background: 'var(--page)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              color: 'var(--ink)',
                              fontSize: '13px',
                            }}
                          />
                          <button
                            onClick={() => handleSaveBudget(camp)}
                            style={{
                              padding: '4px 8px',
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingCampaignId(null)}
                            style={{
                              padding: '4px 6px',
                              background: 'transparent',
                              color: 'var(--muted)',
                              border: 'none',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <strong style={{ fontSize: '15px' }}>${camp.dailyBudget.toFixed(2)}</strong>
                          <button
                            onClick={() => {
                              setEditingCampaignId(camp.id);
                              setEditBudgetVal(camp.dailyBudget);
                            }}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Límite Guardrail</span>
                      <strong style={{ fontSize: '15px', color: isOverBudget ? '#ef4444' : isNearLimit ? '#f59e0b' : '#10b981' }}>
                        max ${camp.safetyGuardrail.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Gasto Acumulado</span>
                      <strong style={{ fontSize: '15px' }}>${camp.spendToDate.toFixed(2)}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>ROAS (Retorno)</span>
                      <strong style={{ fontSize: '15px', color: camp.roas >= 4.0 ? '#10b981' : camp.roas >= 2.0 ? '#38bdf8' : '#f87171' }}>
                        {camp.roas.toFixed(2)}x
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>CPA (Costo Adquisición)</span>
                      <strong style={{ fontSize: '15px' }}>${camp.cpa.toFixed(2)}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>CTR (Clics)</span>
                      <strong style={{ fontSize: '15px' }}>{camp.ctr.toFixed(2)}%</strong>
                    </div>
                  </div>

                  {/* AI Insights & Performance Strategy */}
                  {camp.insights && Object.keys(camp.insights).length > 0 && (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--ink-2)',
                        background: 'rgba(56, 189, 248, 0.05)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '6px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>💡</span>
                      <span>
                        <strong>Insight Agente:</strong> {String(camp.insights.recommendation || camp.insights.audience || 'Rendimiento saludable')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CLIENT PORTAL SIMULATOR */}
      {activeTab === 'client_portal' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid #3b82f6',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--ink-2)',
            }}
          >
            <strong>📱 Simulador de Enlace de WhatsApp:</strong> Esto es exactamente lo que ve el dueño o responsable de la marca (ej: Niki Peppers) cuando recibe el link con su <strong>approvalToken</strong> en su celular. Puede aprobar o rechazar con 1 clic sin necesidad de estar logueado al panel de Control Center.
          </div>

          {/* Token Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Token de borrador:</span>
            <select
              value={clientTestToken}
              onChange={(e) => setClientTestToken(e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--ink)',
                fontSize: '13px',
              }}
            >
              {drafts.map((d) => (
                <option key={d.approvalToken} value={d.approvalToken}>
                  [{d.platform}] {d.caption.slice(0, 45)}... ({d.status})
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Shell Mockup */}
          {publicDraftData ? (
            <div
              style={{
                background: '#09090b',
                color: '#fafafa',
                border: '2px solid #27272a',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#e11d48',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    NP
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{publicDraftData.brand.name}</h4>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Propuesta de Publicación ({publicDraftData.draft.platform})</span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: publicDraftData.draft.status === 'PENDING_APPROVAL' ? '#78350f' : '#052e16',
                    color: publicDraftData.draft.status === 'PENDING_APPROVAL' ? '#fcd34d' : '#4ade80',
                  }}
                >
                  {publicDraftData.draft.status}
                </span>
              </div>

              {publicDraftData.draft.mediaUrls?.length > 0 && (
                <img
                  src={publicDraftData.draft.mediaUrls[0]}
                  alt="Asset"
                  style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }}
                />
              )}

              <div
                style={{
                  background: '#18181b',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '20px',
                }}
              >
                {publicDraftData.draft.caption}
              </div>

              {/* Public Quick Action Buttons */}
              {publicDraftData.draft.status === 'PENDING_APPROVAL' ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    disabled={publicActionLoading}
                    onClick={async () => {
                      setPublicActionLoading(true);
                      try {
                        await api.marketingPublicAction(clientTestToken, 'APPROVED');
                        showToast('✓ Post aprobado vía token público');
                        const res = await api.marketingPublicDraft(clientTestToken);
                        setPublicDraftData(res);
                        void loadData(selectedBrandSlug);
                      } finally {
                        setPublicActionLoading(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {publicActionLoading ? 'Procesando...' : '✅ Aprobar Publicación'}
                  </button>

                  <button
                    disabled={publicActionLoading}
                    onClick={async () => {
                      const reason = prompt('Indicanos qué cambio o corrección te gustaría que hagamos:');
                      if (reason === null) return;
                      setPublicActionLoading(true);
                      try {
                        await api.marketingPublicAction(clientTestToken, 'REJECTED', reason || 'Ajustes solicitados');
                        showToast('Borrador rechazado con feedback');
                        const res = await api.marketingPublicDraft(clientTestToken);
                        setPublicDraftData(res);
                        void loadData(selectedBrandSlug);
                      } finally {
                        setPublicActionLoading(false);
                      }
                    }}
                    style={{
                      padding: '12px 18px',
                      background: '#27272a',
                      color: '#f87171',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Solicitar Ajuste
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '12px',
                    background: '#18181b',
                    borderRadius: '8px',
                    color: '#a1a1aa',
                    fontSize: '13px',
                  }}
                >
                  Este post ya fue {publicDraftData.draft.status === 'APPROVED' ? 'aprobado' : 'procesado'}.
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
              Cargando previsualización de token...
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BRAND DIRECTIVES & TONE */}
      {activeTab === 'brand' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>
              Directivas de Marca y Tono de Voz ({overview?.brand?.name || 'Niki Peppers'})
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Tono de Voz (Tone of Voice):
              </label>
              <textarea
                rows={3}
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                placeholder="Ej: Picante, gourmet, atrevido, enfocado en gastronomía artesanal..."
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Público Objetivo (Target Audience):
              </label>
              <input
                type="text"
                value={brandAudience}
                onChange={(e) => setBrandAudience(e.target.value)}
                placeholder="Ej: Foodies, parrilleros, jóvenes adultos que cocinan en casa..."
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Número de WhatsApp para Despacho de Aprobaciones:
              </label>
              <input
                type="text"
                value={brandWhatsapp}
                onChange={(e) => setBrandWhatsapp(e.target.value)}
                placeholder="+5493512345678"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                El Creative Agent enviará aquí los mensajes interactivos con previsualización del post y links de aprobación rápida.
              </span>
            </div>

            <button
              disabled={savingBrand}
              onClick={handleSaveBrand}
              style={{
                background: '#e11d48',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {savingBrand ? 'Guardando...' : 'Guardar Directivas de Marca'}
            </button>
          </div>
        </div>
      )}

      {/* GENERATE DRAFT MODAL */}
      {showGenerateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                ✨ Generar Contenido con Creative Agent
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Plataforma:</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as SocialPlatform)}
                    style={{ width: '100%', padding: '8px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)' }}
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="FACEBOOK">Facebook</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tipo de Post:</label>
                  <select
                    value={newPostType}
                    onChange={(e) => setNewPostType(e.target.value as SocialPostType)}
                    style={{ width: '100%', padding: '8px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)' }}
                  >
                    <option value="REEL">Reel / Video Corto</option>
                    <option value="CAROUSEL">Carrusel</option>
                    <option value="POST">Post Estático</option>
                    <option value="STORY">Historia / Story</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Tema o Concepto del Post:
                </label>
                <input
                  type="text"
                  required
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Ej: Receta de alitas glaseadas con Chipotle Dulce artesanal"
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Objetivo de la Publicación:
                </label>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Ej: Tráfico a nikipeppers.com con 15% OFF"
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  URL de Imagen o Video (Opcional):
                </label>
                <input
                  type="url"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Fecha y Hora Programada (Opcional):
                </label>
                <input
                  type="datetime-local"
                  value={newScheduledDate}
                  onChange={(e) => setNewScheduledDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  style={{
                    padding: '8px 20px',
                    background: '#e11d48',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isGenerating ? 'Generando con IA...' : 'Generar Borrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
