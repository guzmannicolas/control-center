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
  const [newObjective, setNewObjective] = useState('Website conversion sales');
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

      if (draftsData.drafts.length > 0 && draftsData.drafts[0]) {
        setClientTestToken(draftsData.drafts[0].approvalToken);
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        setError('Your session has expired. Please log in again.');
      } else if (isNetworkError(err)) {
        setError('Unable to reach the server.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load marketing engine data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(selectedBrandSlug);
  }, [selectedBrandSlug]);

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
      showToast(`Draft generated successfully via Creative Agent (${res.creativeInfo?.source === 'ai' ? 'Gemini AI' : 'Creative Engine'})`);
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err.message || 'Error generating draft');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: SocialDraftStatus, feedback?: string) => {
    setStatusUpdatingId(id);
    try {
      const res = await api.marketingUpdateDraftStatus(id, status, feedback);
      setDrafts((prev) => prev.map((d) => (d.id === id ? res.draft : d)));
      setRejectFeedbackDraftId(null);
      setRejectFeedbackText('');
      showToast(status === 'APPROVED' ? 'Post approved for publishing' : `Status updated to ${status}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDispatchApproval = async (id: string) => {
    setDispatchingId(id);
    try {
      const res = await api.marketingDispatchApproval(id);
      if (res.ok) {
        showToast(`Preview and approval link dispatched via ${res.channel.toUpperCase()} to ${res.recipient}`);
      } else {
        alert(res.error || 'Failed to dispatch approval');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch approval');
    } finally {
      setDispatchingId(null);
    }
  };

  const handleSaveBudget = async (campaign: AdCampaignView) => {
    if (editBudgetVal > campaign.safetyGuardrail) {
      alert(`SAFETY GUARDRAIL VIOLATION: Requested budget ($${editBudgetVal}) exceeds maximum hardcoded limit of $${campaign.safetyGuardrail}. Automated engines are blocked from exceeding this threshold.`);
      return;
    }

    try {
      const res = await api.marketingUpdateAdCampaign(campaign.id, { dailyBudget: editBudgetVal });
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? res.campaign : c)));
      setEditingCampaignId(null);
      showToast(`Daily budget updated to $${editBudgetVal.toFixed(2)}/day within safety guardrail`);
    } catch (err: any) {
      alert(err.message || 'Failed to update budget');
    }
  };

  const handleToggleAdStatus = async (campaign: AdCampaignView) => {
    const nextStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await api.marketingUpdateAdCampaign(campaign.id, { status: nextStatus });
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? res.campaign : c)));
      showToast(`Campaign ${campaign.campaignName} marked as ${nextStatus}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update campaign status');
    }
  };

  const handleRunAudit = async () => {
    setAuditingAds(true);
    try {
      const res = await api.marketingAuditAds();
      setAuditInfo(res.audit);
      showToast('Ad audit complete. Guardrails and performance verified.');
    } catch (err: any) {
      alert(err.message || 'Failed to audit campaigns');
    } finally {
      setAuditingAds(false);
    }
  };

  const handleSaveBrand = async () => {
    setSavingBrand(true);
    try {
      await api.marketingUpsertBrand({
        slug: selectedBrandSlug,
        name: overview?.brand?.name || 'Niki Peppers',
        website: overview?.brand?.website || 'https://nikipeppers.com',
        toneOfVoice: brandTone,
        whatsappNumber: brandWhatsapp,
        targetAudience: brandAudience,
      });
      showToast('Brand directives and tone of voice updated successfully');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err.message || 'Failed to update brand directives');
    } finally {
      setSavingBrand(false);
    }
  };

  const filteredDrafts = drafts.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterPlatform !== 'all' && d.platform !== filterPlatform) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
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
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {toastMessage}
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
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                letterSpacing: '0.05em',
              }}
            >
              Autonomous Pilot
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Supervised ad spend management (Meta & Google Ads) and AI creative production with human-in-the-loop approval
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>Brand:</span>
            <select
              value={selectedBrandSlug}
              onChange={(e) => setSelectedBrandSlug(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                padding: '8px 12px',
                borderRadius: '6px',
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
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generate Draft with AI
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
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Daily Budget / Guardrail
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: overview.ads.guardrailBreachedCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: overview.ads.guardrailBreachedCount > 0 ? '#ef4444' : '#10b981',
                  border: `1px solid ${overview.ads.guardrailBreachedCount > 0 ? '#ef4444' : '#10b981'}`,
                }}
              >
                {overview.ads.guardrailBreachedCount > 0 ? 'Guardrail Exceeded' : 'Protected Limit'}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
              ${overview.ads.totalDailyBudget.toFixed(2)}
              <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
                {' '}
                / max ${overview.ads.safetyGuardrailTotal.toFixed(2)} day
              </span>
            </div>
            <div style={{ marginTop: '10px', height: '6px', background: 'var(--grid)', borderRadius: '3px', overflow: 'hidden' }}>
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

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Blended ROAS
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>{overview.ads.avgRoas.toFixed(2)}x</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Avg CPA: ${overview.ads.avgCpa.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              Total spend to date: <strong>${overview.ads.totalSpendToDate.toFixed(2)}</strong> ({overview.ads.activeCampaignsCount} active campaigns)
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: overview.social.pendingApprovalsCount > 0 ? '1px solid #f59e0b' : '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Human-in-the-Loop
              </span>
              {overview.social.pendingApprovalsCount > 0 && (
                <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid #f59e0b' }}>
                  Action Required
                </span>
              )}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: overview.social.pendingApprovalsCount > 0 ? '#f59e0b' : 'inherit' }}>
              {overview.social.pendingApprovalsCount}{' '}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>pending approval</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              {overview.social.approvedScheduledCount} approved/scheduled · {overview.social.publishedCount} published
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Autonomous Agents
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  Traffic Guardian
                </span>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }} />
                  Social Creative
                </span>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>GEMINI 2.5/3.8</span>
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
            borderBottom: activeTab === 'creative' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'creative' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'creative' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Social Creative Studio (Drafts & Approvals)</span>
          {overview && overview.social.pendingApprovalsCount > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
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
            borderBottom: activeTab === 'ads' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'ads' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'ads' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Ads & Traffic Engine (Meta & Google)
        </button>

        <button
          onClick={() => setActiveTab('client_portal')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'client_portal' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'client_portal' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'client_portal' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Client Portal Simulator (Approval Token)
        </button>

        <button
          onClick={() => setActiveTab('brand')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'brand' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'brand' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'brand' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Brand Directives & Voice Tone
        </button>
      </div>

      {/* TAB 1: SOCIAL CREATIVE STUDIO */}
      {activeTab === 'creative' && (
        <div>
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
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Status:</span>
              {(['all', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'PUBLISHED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: filterStatus === st ? '1px solid var(--ink)' : '1px solid var(--border)',
                    background: filterStatus === st ? 'var(--ink)' : 'var(--surface)',
                    color: filterStatus === st ? 'var(--page)' : 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {st === 'all'
                    ? 'All'
                    : st === 'PENDING_APPROVAL'
                    ? 'Pending'
                    : st === 'APPROVED'
                    ? 'Approved'
                    : st === 'DRAFT'
                    ? 'Draft'
                    : 'Published'}
                </button>
              ))}

              <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '12px' }}>Platform:</span>
              {(['all', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK'] as const).map((plat) => (
                <button
                  key={plat}
                  onClick={() => setFilterPlatform(plat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: filterPlatform === plat ? '1px solid #2563eb' : '1px solid var(--border)',
                    background: filterPlatform === plat ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface)',
                    color: filterPlatform === plat ? '#2563eb' : 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {plat === 'all' ? 'All' : plat}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Showing <strong>{filteredDrafts.length}</strong> content drafts
            </div>
          </div>

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
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
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
                          borderRadius: '4px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--ink)',
                        }}
                      >
                        {draft.platform} / {draft.postType}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {draft.brandName || selectedBrandSlug}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: isPending
                          ? 'rgba(245, 158, 11, 0.1)'
                          : isApproved
                          ? 'rgba(16, 185, 129, 0.1)'
                          : isPublished
                          ? 'rgba(37, 99, 235, 0.1)'
                          : isRejected
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'var(--grid)',
                        color: isPending
                          ? '#f59e0b'
                          : isApproved
                          ? '#10b981'
                          : isPublished
                          ? '#2563eb'
                          : isRejected
                          ? '#ef4444'
                          : 'var(--muted)',
                        border: `1px solid ${
                          isPending
                            ? '#f59e0b'
                            : isApproved
                            ? '#10b981'
                            : isPublished
                            ? '#2563eb'
                            : isRejected
                            ? '#ef4444'
                            : 'var(--border)'
                        }`,
                      }}
                    >
                      {draft.status}
                    </span>
                  </div>

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
                          1/{draft.mediaUrls.length} Carousel
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontSize: '13.5px',
                        lineHeight: '1.55',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--ink)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {draft.caption}
                    </div>

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
                        <strong>Client Feedback:</strong> {draft.feedback}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '12px', fontSize: '11.5px', color: 'var(--muted)' }}>
                      Scheduled: {draft.scheduledFor ? new Date(draft.scheduledFor).toLocaleString() : 'Immediate upon approval'}
                    </div>
                  </div>

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
                            borderRadius: '4px',
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>

                        <button
                          disabled={statusUpdatingId === draft.id}
                          onClick={() => {
                            setRejectFeedbackDraftId(draft.id);
                            setRejectFeedbackText('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reject
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
                          borderRadius: '4px',
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Mark as Published
                      </button>
                    )}

                    <button
                      disabled={dispatchingId === draft.id}
                      onClick={() => handleDispatchApproval(draft.id)}
                      title="Send interactive review message to client WhatsApp"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: 'var(--ink)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {dispatchingId === draft.id ? 'Dispatching...' : 'Dispatch WhatsApp'}
                    </button>

                    <button
                      onClick={() => {
                        setClientTestToken(draft.approvalToken);
                        setActiveTab('client_portal');
                      }}
                      title="Preview client approval page"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Client Portal
                    </button>
                  </div>

                  {rejectFeedbackDraftId === draft.id && (
                    <div style={{ padding: '12px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                      <label style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                        Reason / requested adjustments:
                      </label>
                      <input
                        type="text"
                        value={rejectFeedbackText}
                        onChange={(e) => setRejectFeedbackText(e.target.value)}
                        placeholder="e.g. Replace photo with Scorpion Habanero jar"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: 'var(--page)',
                          border: '1px solid var(--border)',
                          color: 'var(--ink)',
                          borderRadius: '4px',
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
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => setRejectFeedbackDraftId(null)}
                          style={{
                            padding: '6px 10px',
                            background: 'transparent',
                            color: 'var(--muted)',
                            border: 'none',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ADS & TRAFFIC ENGINE */}
      {activeTab === 'ads' && (
        <div>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981' }}>
                Active Safety Guardrails (Strict Budget Capping)
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink-2)', maxWidth: '800px', lineHeight: 1.4 }}>
                The automated optimization algorithms are strictly prohibited from raising daily campaign budgets past the configured{' '}
                <strong>safetyGuardrail</strong> (${overview?.ads.safetyGuardrailTotal.toFixed(2)}/day aggregate). Any attempted bypass is blocked at database level.
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
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {auditingAds ? 'Auditing...' : 'Audit Campaigns with AI'}
            </button>
          </div>

          {auditInfo && (auditInfo.safetyAlerts?.length > 0 || auditInfo.recommendations?.length > 0) && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>
                Traffic Guardian Agent Diagnostics
              </h4>
              {auditInfo.safetyAlerts?.map((alert: string, idx: number) => (
                <div key={idx} style={{ fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                  {alert}
                </div>
              ))}
              {auditInfo.recommendations?.map((rec: string, idx: number) => (
                <div key={idx} style={{ fontSize: '13px', color: '#2563eb', marginBottom: '6px' }}>
                  {rec}
                </div>
              ))}
            </div>
          )}

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
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
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
                          borderRadius: '4px',
                          background: camp.platform === 'META' ? '#1877f2' : '#ea4335',
                          color: '#fff',
                        }}
                      >
                        {camp.platform === 'META' ? 'Meta Ads' : 'Google Ads'}
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{camp.campaignName}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          ID: {camp.externalCampaignId} · Objective: {camp.objective}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: camp.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'var(--grid)',
                          color: camp.status === 'ACTIVE' ? '#10b981' : 'var(--muted)',
                          border: `1px solid ${camp.status === 'ACTIVE' ? '#10b981' : 'var(--border)'}`,
                        }}
                      >
                        {camp.status}
                      </span>
                      <button
                        onClick={() => handleToggleAdStatus(camp)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--ink)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {camp.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '12px',
                      background: 'rgba(0,0,0,0.02)',
                      padding: '12px',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Daily Budget</span>
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
                            Save
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
                            Cancel
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
                            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Guardrail Ceiling</span>
                      <strong style={{ fontSize: '15px', color: isOverBudget ? '#ef4444' : isNearLimit ? '#f59e0b' : '#10b981' }}>
                        max ${camp.safetyGuardrail.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Spend to Date</span>
                      <strong style={{ fontSize: '15px' }}>${camp.spendToDate.toFixed(2)}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>ROAS</span>
                      <strong style={{ fontSize: '15px', color: camp.roas >= 4.0 ? '#10b981' : camp.roas >= 2.0 ? '#2563eb' : '#ef4444' }}>
                        {camp.roas.toFixed(2)}x
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>CPA</span>
                      <strong style={{ fontSize: '15px' }}>${camp.cpa.toFixed(2)}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>CTR</span>
                      <strong style={{ fontSize: '15px' }}>{camp.ctr.toFixed(2)}%</strong>
                    </div>
                  </div>

                  {camp.insights && Object.keys(camp.insights).length > 0 && (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--ink-2)',
                        background: 'rgba(37, 99, 235, 0.05)',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                        borderRadius: '4px',
                        padding: '10px 14px',
                      }}
                    >
                      <strong>Optimization Directive:</strong> {String(camp.insights.recommendation || camp.insights.audience || 'Operating normally')}
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
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid #2563eb',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--ink-2)',
            }}
          >
            <strong>Client Approval Link Simulation:</strong> This represents the external view presented to the client when accessing their unique <strong>approvalToken</strong>. No dashboard authentication is required for rapid one-click review.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Draft token:</span>
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

          {publicDraftData ? (
            <div
              style={{
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>{publicDraftData.brand.name}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Publishing Proposal ({publicDraftData.draft.platform})</span>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: publicDraftData.draft.status === 'PENDING_APPROVAL' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: publicDraftData.draft.status === 'PENDING_APPROVAL' ? '#f59e0b' : '#10b981',
                  }}
                >
                  {publicDraftData.draft.status}
                </span>
              </div>

              {publicDraftData.draft.mediaUrls?.length > 0 && (
                <img
                  src={publicDraftData.draft.mediaUrls[0]}
                  alt="Asset"
                  style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
                />
              )}

              <div
                style={{
                  background: 'var(--page)',
                  padding: '14px',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '20px',
                  border: '1px solid var(--border)',
                }}
              >
                {publicDraftData.draft.caption}
              </div>

              {publicDraftData.draft.status === 'PENDING_APPROVAL' ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    disabled={publicActionLoading}
                    onClick={async () => {
                      setPublicActionLoading(true);
                      try {
                        await api.marketingPublicAction(clientTestToken, 'APPROVED');
                        showToast('Post approved via token');
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
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {publicActionLoading ? 'Processing...' : 'Approve Post'}
                  </button>

                  <button
                    disabled={publicActionLoading}
                    onClick={async () => {
                      const reason = prompt('Specify requested revision details:');
                      if (reason === null) return;
                      setPublicActionLoading(true);
                      try {
                        await api.marketingPublicAction(clientTestToken, 'REJECTED', reason || 'Adjustments requested');
                        showToast('Draft marked as rejected with feedback');
                        const res = await api.marketingPublicDraft(clientTestToken);
                        setPublicDraftData(res);
                        void loadData(selectedBrandSlug);
                      } finally {
                        setPublicActionLoading(false);
                      }
                    }}
                    style={{
                      padding: '12px 18px',
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Request Changes
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '12px',
                    background: 'var(--page)',
                    borderRadius: '6px',
                    color: 'var(--muted)',
                    fontSize: '13px',
                  }}
                >
                  This post has already been processed ({publicDraftData.draft.status}).
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
              Loading token preview...
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
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>
              Brand Directives & Voice Tone ({overview?.brand?.name || 'Niki Peppers'})
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Tone of Voice:
              </label>
              <textarea
                rows={3}
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                placeholder="e.g. Artisanal, bold, gourmet, focused on culinary excellence..."
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Target Audience:
              </label>
              <input
                type="text"
                value={brandAudience}
                onChange={(e) => setBrandAudience(e.target.value)}
                placeholder="e.g. Foodies, home chefs, craft culinary enthusiasts..."
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                WhatsApp Dispatch Phone:
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
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                Destination number for automatic interactive post review dispatches.
              </span>
            </div>

            <button
              disabled={savingBrand}
              onClick={handleSaveBrand}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {savingBrand ? 'Saving...' : 'Save Brand Directives'}
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
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '540px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Generate Content with Creative Agent
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleGenerate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Platform:</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as SocialPlatform)}
                    style={{ width: '100%', padding: '8px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="FACEBOOK">Facebook</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Post Format:</label>
                  <select
                    value={newPostType}
                    onChange={(e) => setNewPostType(e.target.value as SocialPostType)}
                    style={{ width: '100%', padding: '8px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
                  >
                    <option value="REEL">Reel / Video</option>
                    <option value="CAROUSEL">Carousel</option>
                    <option value="POST">Feed Post</option>
                    <option value="STORY">Story</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Topic or Post Concept:
                </label>
                <input
                  type="text"
                  required
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Glazed chicken wings recipe with artisanal Chipotle"
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Commercial Objective:
                </label>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="e.g. Traffic to nikipeppers.com with 15% promo"
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Asset Media URL (Optional):
                </label>
                <input
                  type="url"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Scheduled Date & Time (Optional):
                </label>
                <input
                  type="datetime-local"
                  value={newScheduledDate}
                  onChange={(e) => setNewScheduledDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--page)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  style={{
                    padding: '8px 20px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isGenerating ? 'Generating...' : 'Generate Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
