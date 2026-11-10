import { useEffect, useState } from 'react';
import {
  api,
  isNetworkError,
  isUnauthorized,
} from '../api.ts';
import { useSearch, navigate } from '../router.tsx';
import type {
  MarketingOverview,
  SocialDraftView,
  SocialDraftStatus,
  SocialPlatform,
  SocialPostType,
  AdCampaignView,
  BrandView,
  BrandIntegrations,
  BrandConversationView,
  ContentIdeaSuggestion,
  MarketingSchedulerStatus,
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
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const tabFromUrl = searchParams.get('tab') as 'creative' | 'ads' | 'chat' | 'integrations' | 'client_portal' | 'brand' | null;

  const activeTab: 'creative' | 'ads' | 'chat' | 'integrations' | 'client_portal' | 'brand' =
    tabFromUrl && ['creative', 'ads', 'chat', 'integrations', 'client_portal', 'brand'].includes(tabFromUrl)
      ? tabFromUrl
      : 'creative';

  const setActiveTab = (tab: 'creative' | 'ads' | 'chat' | 'integrations' | 'client_portal' | 'brand') => {
    navigate(`/marketing?tab=${tab}`);
  };

  // Integrations state
  const [integrationsForm, setIntegrationsForm] = useState<BrandIntegrations>({});
  const [autoPublishActive, setAutoPublishActive] = useState(false);
  const [autoReplyChatActive, setAutoReplyChatActive] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; ok: boolean; message: string } | null>(null);

  // Instagram Quick Connect State
  const [showConnectIgModal, setShowConnectIgModal] = useState(false);
  const [igHandleInput, setIgHandleInput] = useState('');
  const [igTokenInput, setIgTokenInput] = useState('');
  const [igMode, setIgMode] = useState<'sandbox' | 'live'>('sandbox');
  const [savingIgConnection, setSavingIgConnection] = useState(false);

  // Community Manager & Chat Assistant state
  const [conversations, setConversations] = useState<BrandConversationView[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatInputMessage, setChatInputMessage] = useState('');
  const [simulatedCustomerName, setSimulatedCustomerName] = useState('Lucia Martinez');
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [publishingDraftId, setPublishingDraftId] = useState<string | null>(null);

  // Creative Studio State
  const [creativeViewMode, setCreativeViewMode] = useState<'grid' | 'calendar'>('grid');
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

  // Auto-Publisher Daemon & Scheduler Status
  const [schedulerStatus, setSchedulerStatus] = useState<MarketingSchedulerStatus | null>(null);
  const [runningScheduler, setRunningScheduler] = useState(false);

  // Batch Weekly Strategy Planner State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTheme, setBatchTheme] = useState('Colección Floral de Verano & Consultas');
  const [batchCount, setBatchCount] = useState(5);
  const [batchPlatforms, setBatchPlatforms] = useState<SocialPlatform[]>(['INSTAGRAM', 'TIKTOK']);
  const [batchStartDate, setBatchStartDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [batchObjective, setBatchObjective] = useState('Consultas y reservas de citas');
  const [batchAutoApprove, setBatchAutoApprove] = useState(true);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Content Ideas Bank State
  const [showIdeasModal, setShowIdeasModal] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdeaSuggestion[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

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

  // Social Style Playbook (.md) State
  const [showStylePlaybookModal, setShowStylePlaybookModal] = useState(false);
  const [stylePlaybookContent, setStylePlaybookContent] = useState('');
  const [loadingStylePlaybook, setLoadingStylePlaybook] = useState(false);
  const [savingStylePlaybook, setSavingStylePlaybook] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [analyzerHandleInput, setAnalyzerHandleInput] = useState('nikipepperstattoo');
  const [analyzerUrlsInput, setAnalyzerUrlsInput] = useState('');
  const [analyzerCaptionsInput, setAnalyzerCaptionsInput] = useState('');
  const [showAnalyzerPanel, setShowAnalyzerPanel] = useState(true);

  // Brand Dossier (.md) state
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierContent, setDossierContent] = useState('');
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [savingDossier, setSavingDossier] = useState(false);

  // Draft editing & deletion
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftCaption, setEditingDraftCaption] = useState<string>('');

  // Collapsible overview cards
  const [overviewCardsOpen, setOverviewCardsOpen] = useState(false);

  // Add Brand Account state
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandWebsite, setNewBrandWebsite] = useState('');
  const [newBrandTone, setNewBrandTone] = useState('Professional, approachable, and authentic');
  const [newBrandInstagram, setNewBrandInstagram] = useState('');
  const [newBrandWhatsapp, setNewBrandWhatsapp] = useState('');
  const [newBrandAudience, setNewBrandAudience] = useState('');
  const [newBrandDossier, setNewBrandDossier] = useState('');
  const [creatingBrand, setCreatingBrand] = useState(false);

  // Ad Campaign creation
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [newCampName, setNewCampName] = useState('');
  const [newCampPlatform, setNewCampPlatform] = useState<'META' | 'GOOGLE'>('META');
  const [newCampObjective, setNewCampObjective] = useState('Consultation Bookings');
  const [newCampBudget, setNewCampBudget] = useState(20);
  const [newCampGuardrail, setNewCampGuardrail] = useState(35);
  const [creatingCamp, setCreatingCamp] = useState(false);

  // Instagram Scraping & Style Intelligence
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [instagramHandleInput, setInstagramHandleInput] = useState('nikipepperstattoo');
  const [isSyncingInstagram, setIsSyncingInstagram] = useState(false);
  const [postUrlInput, setPostUrlInput] = useState('');
  const [postCaptionInput, setPostCaptionInput] = useState('');
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadConversations = async (slug = selectedBrandSlug) => {
    setLoadingConversations(true);
    try {
      const res = await api.marketingConversations(slug);
      setConversations(res.conversations);
      if (res.conversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(res.conversations[0]?.id ?? null);
      }
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleSaveIntegrations = async () => {
    setSavingIntegrations(true);
    try {
      const res = await api.marketingUpdateBrandIntegrations(selectedBrandSlug, {
        integrations: integrationsForm,
        autoPublish: autoPublishActive,
        autoReplyChat: autoReplyChatActive,
      });
      setOverview((prev) => (prev ? { ...prev, brand: res.brand } : prev));
      showToast('Integrations and autonomy parameters updated successfully');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save integrations');
    } finally {
      setSavingIntegrations(false);
    }
  };

  const handleSaveInstagram = async () => {
    const cleanHandle = igHandleInput.trim().replace(/^@/, '');
    if (!cleanHandle) {
      showToast('Please enter an Instagram handle');
      return;
    }
    setSavingIgConnection(true);
    try {
      const updatedIntegrations: BrandIntegrations = {
        ...integrationsForm,
        metaPageAccessToken: igMode === 'live' ? igTokenInput.trim() : '',
      };
      const res = await api.marketingUpdateBrandIntegrations(selectedBrandSlug, {
        integrations: updatedIntegrations,
        instagramHandle: cleanHandle,
        autoPublish: true,
      });
      setIntegrationsForm(updatedIntegrations);
      setAutoPublishActive(true);
      setOverview((prev) => (prev ? { ...prev, brand: res.brand } : prev));
      setShowConnectIgModal(false);
      showToast(`Instagram @${cleanHandle} connected (${igMode === 'sandbox' ? 'Sandbox / Test Mode' : 'Live'})`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to connect Instagram');
    } finally {
      setSavingIgConnection(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    try {
      const updatedIntegrations: BrandIntegrations = {
        ...integrationsForm,
        metaPageAccessToken: '',
      };
      const res = await api.marketingUpdateBrandIntegrations(selectedBrandSlug, {
        integrations: updatedIntegrations,
        instagramHandle: '',
      });
      setIntegrationsForm(updatedIntegrations);
      setOverview((prev) => (prev ? { ...prev, brand: res.brand } : prev));
      showToast('Instagram disconnected');
    } catch (err: any) {
      showToast(err?.message || 'Failed to disconnect Instagram');
    }
  };

  const handleToggleAutoPublish = async () => {
    const nextVal = !autoPublishActive;
    setAutoPublishActive(nextVal);
    try {
      await api.marketingUpdateBrandIntegrations(selectedBrandSlug, {
        autoPublish: nextVal,
      });
      showToast(`Autonomous Auto-Publish on Approval ${nextVal ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      setAutoPublishActive(!nextVal);
      showToast('Failed to toggle auto-publish');
    }
  };

  const handleToggleAutoReplyChat = async () => {
    const nextVal = !autoReplyChatActive;
    setAutoReplyChatActive(nextVal);
    try {
      await api.marketingUpdateBrandIntegrations(selectedBrandSlug, {
        autoReplyChat: nextVal,
      });
      showToast(`Autonomous Chat & DM Auto-Reply ${nextVal ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      setAutoReplyChatActive(!nextVal);
      showToast('Failed to toggle chat auto-reply');
    }
  };

  const handleTestIntegration = async (channel: 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'META_ADS') => {
    setTestingChannel(channel);
    setTestResult(null);
    try {
      const res = await api.marketingTestIntegration(selectedBrandSlug, channel);
      setTestResult(res);
      showToast(res.message);
    } catch (err: any) {
      setTestResult({ channel, ok: false, message: err?.message || 'Connection test failed' });
    } finally {
      setTestingChannel(null);
    }
  };

  const handleDirectPublish = async (draftId: string) => {
    setPublishingDraftId(draftId);
    try {
      const res = await api.marketingPublishDraft(draftId);
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? res.draft : d)));
      showToast(res.publishResult?.message || 'Post published successfully');
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish post');
    } finally {
      setPublishingDraftId(null);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInputMessage.trim()) return;
    setSendingChatMessage(true);
    try {
      const res = await api.marketingSendChatMessage(selectedBrandSlug, {
        message: chatInputMessage.trim(),
        customerName: simulatedCustomerName.trim() || 'Potential Client',
        conversationId: selectedConversationId || undefined,
      });
      setChatInputMessage('');
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === res.conversation.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = res.conversation;
          return updated;
        }
        return [res.conversation, ...prev];
      });
      setSelectedConversationId(res.conversation.id);
      showToast(`Assistant replied [Intent: ${res.reply.intent}]`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate assistant response');
    } finally {
      setSendingChatMessage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      void loadConversations(selectedBrandSlug);
    }
  }, [activeTab, selectedBrandSlug]);

  const loadData = async (slug = selectedBrandSlug) => {
    setLoading(true);
    setError(null);
    try {
      const [ovData, draftsData, adsData, brandsData, schedData] = await Promise.all([
        api.marketingOverview(slug),
        api.marketingDrafts({ brandSlug: slug }),
        api.marketingAds({ brandSlug: slug }),
        api.marketingBrands(),
        api.marketingGetSchedulerStatus(slug).catch(() => null),
      ]);

      setOverview(ovData);
      setDrafts(draftsData.drafts);
      setCampaigns(adsData.campaigns);
      setAuditInfo(adsData.audit);
      setBrands(brandsData.brands);
      if (schedData) {
        setSchedulerStatus(schedData);
      }

      if (ovData.brand) {
        setBrandTone(ovData.brand.toneOfVoice);
        setBrandWhatsapp(ovData.brand.whatsappNumber || '');
        setBrandAudience(ovData.brand.targetAudience || '');
        const currentIgHandle = ovData.brand.instagramHandle || '';
        if (currentIgHandle) {
          setInstagramHandleInput(currentIgHandle);
          setIgHandleInput(currentIgHandle);
        }
        const tokenVal = ovData.brand.integrations?.metaPageAccessToken || (ovData.brand.integrations as any)?.metaAccessToken || '';
        if (tokenVal) {
          setIgTokenInput(String(tokenVal));
          setIgMode('live');
        } else {
          setIgMode('sandbox');
        }
        setIntegrationsForm(ovData.brand.integrations || {});
        setAutoPublishActive(Boolean(ovData.brand.autoPublish));
        setAutoReplyChatActive(Boolean(ovData.brand.autoReplyChat));
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

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    try {
      const res = await api.marketingPublishPendingDrafts();
      showToast(`Auto-Publisher: ${res.publishedCount} post(s) procesados.`);
      await loadData(selectedBrandSlug);
    } catch (err: any) {
      showToast(err?.message || 'Error al ejecutar publicador');
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleFetchIdeas = async () => {
    setLoadingIdeas(true);
    setShowIdeasModal(true);
    try {
      const res = await api.marketingGetContentIdeas(selectedBrandSlug);
      setIdeas(res.ideas);
    } catch (err: any) {
      showToast(err?.message || 'Error al obtener ideas');
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleApplyIdea = (idea: ContentIdeaSuggestion) => {
    setNewTopic(idea.topic);
    setNewPlatform(idea.platform);
    setNewPostType(idea.postType);
    setNewObjective(idea.objective);
    setShowIdeasModal(false);
    setShowGenerateModal(true);
    showToast(`Idea seleccionada: "${idea.topic}"`);
  };

  const handleBatchGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingBatch(true);
    try {
      const res = await api.marketingBatchGenerateDrafts({
        brandSlug: selectedBrandSlug,
        theme: batchTheme,
        postCount: Number(batchCount),
        platforms: batchPlatforms,
        startDate: batchStartDate,
        objective: batchObjective,
        autoApprove: batchAutoApprove,
      });
      showToast(`¡Plan editorial generado! Se crearon ${res.count} publicaciones programadas.`);
      setShowBatchModal(false);
      setCreativeViewMode('calendar');
      await loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err?.message || 'Error al generar plan semanal');
    } finally {
      setIsGeneratingBatch(false);
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

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !newBrandWebsite.trim()) {
      showToast('Brand name and website are required');
      return;
    }
    const slug = (newBrandSlug.trim() || newBrandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();
    if (!slug) {
      showToast('A valid slug is required');
      return;
    }
    setCreatingBrand(true);
    try {
      const res = await api.marketingUpsertBrand({
        name: newBrandName.trim(),
        slug,
        website: newBrandWebsite.trim(),
        toneOfVoice: newBrandTone.trim() || 'Authentic and professional',
        instagramHandle: newBrandInstagram.trim().replace(/^@/, '') || undefined,
        whatsappNumber: newBrandWhatsapp.trim() || undefined,
        targetAudience: newBrandAudience.trim() || undefined,
        dossierMd: newBrandDossier.trim() || undefined,
      });
      showToast(`Brand ${res.brand.name} created successfully`);
      setShowAddBrandModal(false);
      setNewBrandName('');
      setNewBrandSlug('');
      setNewBrandWebsite('');
      setNewBrandInstagram('');
      setNewBrandWhatsapp('');
      setNewBrandAudience('');
      setNewBrandDossier('');
      const brandsData = await api.marketingBrands();
      setBrands(brandsData.brands);
      setSelectedBrandSlug(res.brand.slug);
      await loadData(res.brand.slug);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create brand');
    } finally {
      setCreatingBrand(false);
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

  const openStylePlaybookModal = async () => {
    setShowStylePlaybookModal(true);
    setLoadingStylePlaybook(true);
    try {
      const res = await api.marketingBrandSocialStyle(selectedBrandSlug);
      setStylePlaybookContent(res.socialStyleMd || overview?.brand?.socialStyleMd || '');
      if (overview?.brand?.instagramHandle) {
        setAnalyzerHandleInput(overview.brand.instagramHandle);
      }
    } catch {
      setStylePlaybookContent(overview?.brand?.socialStyleMd || '');
    } finally {
      setLoadingStylePlaybook(false);
    }
  };

  const handleSaveStylePlaybook = async () => {
    setSavingStylePlaybook(true);
    try {
      await api.marketingSaveBrandSocialStyle(selectedBrandSlug, stylePlaybookContent);
      showToast('Social Media Style Playbook (.md) saved successfully. Creative Agent will strictly follow this guide.');
      setShowStylePlaybookModal(false);
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to save style playbook');
    } finally {
      setSavingStylePlaybook(false);
    }
  };

  const handleRunAIStyleAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAnalyzingStyle(true);
    try {
      const rawUrls = analyzerUrlsInput
        .split(/[\n,]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 5);

      const res = await api.marketingAnalyzeSocialStyle(selectedBrandSlug, {
        handle: analyzerHandleInput.trim() || undefined,
        postUrls: rawUrls.length > 0 ? rawUrls : undefined,
        sampleCaptions: analyzerCaptionsInput.trim() || undefined,
      });

      setStylePlaybookContent(res.socialStyleMd);
      showToast('AI Style Playbook generated successfully from analyzed content.');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to analyze social style');
    } finally {
      setAnalyzingStyle(false);
    }
  };

  const handleUploadStylePlaybookFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setStylePlaybookContent(text);
        showToast(`Loaded ${file.name} into editor. Click 'Save Style Playbook' to persist.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadStylePlaybook = () => {
    const blob = new Blob([stylePlaybookContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBrandSlug}-social-style-playbook.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDossierModal = async () => {
    setShowDossierModal(true);
    setLoadingDossier(true);
    try {
      const res = await api.marketingBrandDossier(selectedBrandSlug);
      setDossierContent(res.brand.dossierMd || '');
    } catch (err: any) {
      showToast(err instanceof Error ? err.message : 'Failed to load brand dossier');
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleSaveDossier = async () => {
    setSavingDossier(true);
    try {
      await api.marketingSaveBrandDossier(selectedBrandSlug, dossierContent);
      showToast('Brand dossier (.md) saved successfully. Creative Agent will use this specification.');
      setShowDossierModal(false);
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to save brand dossier');
    } finally {
      setSavingDossier(false);
    }
  };

  const handleUploadDossierFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setDossierContent(text);
        showToast(`Loaded ${file.name} into editor. Click 'Save Dossier' to persist.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadDossier = () => {
    const blob = new Blob([dossierContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBrandSlug}-brand-dossier.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return;
    try {
      await api.marketingDeleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      showToast('Draft deleted successfully');
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  };

  const handleSaveDraftCaption = async (id: string) => {
    try {
      const res = await api.marketingUpdateDraft(id, { caption: editingDraftCaption });
      setDrafts((prev) => prev.map((d) => (d.id === id ? res.draft : d)));
      setEditingDraftId(null);
      showToast('Draft caption updated successfully');
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to update draft');
    }
  };

  const handleTogglePlatform = async (platform: SocialPlatform) => {
    const current = (overview?.brand?.activePlatforms || ['INSTAGRAM', 'FACEBOOK']) as SocialPlatform[];
    let next: SocialPlatform[];
    if (current.includes(platform)) {
      if (current.length === 1) {
        alert('At least one social platform must remain active.');
        return;
      }
      next = current.filter((p) => p !== platform);
    } else {
      next = [...current, platform];
    }
    try {
      await api.marketingUpdateBrandPlatforms(selectedBrandSlug, next);
      showToast(`Active channels updated: ${next.join(', ')}`);
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to update platforms');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim()) return;
    if (newCampBudget > newCampGuardrail) {
      alert(`SAFETY GUARDRAIL VIOLATION: Daily budget ($${newCampBudget}) cannot exceed safety limit ($${newCampGuardrail}).`);
      return;
    }

    setCreatingCamp(true);
    try {
      const res = await api.marketingCreateAdCampaign({
        brandSlug: selectedBrandSlug,
        platform: newCampPlatform,
        campaignName: newCampName.trim(),
        objective: newCampObjective.trim(),
        dailyBudget: newCampBudget,
        safetyGuardrail: newCampGuardrail,
      });
      setCampaigns((prev) => [res.campaign, ...prev]);
      setShowCreateCampaignModal(false);
      setNewCampName('');
      showToast('Ad campaign created successfully with safety guardrail');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setCreatingCamp(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this ad campaign?')) return;
    try {
      await api.marketingDeleteAdCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      showToast('Campaign deleted successfully');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to delete campaign');
    }
  };

  const handleSyncInstagram = async () => {
    setIsSyncingInstagram(true);
    try {
      const res = await api.marketingSyncInstagram(selectedBrandSlug, instagramHandleInput.trim());
      if (res.statusMessage) {
        showToast(res.statusMessage);
      } else {
        const count = res.scraped?.posts?.length ?? 0;
        showToast(`Synced ${count} publications for @${res.scraped?.handle || instagramHandleInput}. Creative Agent now mirrors this style.`);
      }
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to sync Instagram profile');
    } finally {
      setIsSyncingInstagram(false);
    }
  };

  const handleAddPostByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrlInput.trim()) return;
    setIsAddingPost(true);
    try {
      const res = await api.marketingAddInstagramPost(selectedBrandSlug, postUrlInput.trim(), postCaptionInput.trim() || undefined);
      showToast(`Imported post: ${res.post.permalink || res.post.id}`);
      setPostUrlInput('');
      setPostCaptionInput('');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to import post from Instagram link');
    } finally {
      setIsAddingPost(false);
    }
  };

  const handleDeleteInstagramPost = async (postId: string) => {
    if (!confirm('Are you sure you want to remove this publication reference?')) return;
    setDeletingPostId(postId);
    try {
      await api.marketingDeleteInstagramPost(selectedBrandSlug, postId);
      showToast('Instagram publication reference removed');
      void loadData(selectedBrandSlug);
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to delete publication reference');
    } finally {
      setDeletingPostId(null);
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
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Social Media Automation
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '4px',
                background: autoPublishActive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                color: autoPublishActive ? '#16a34a' : 'var(--muted)',
                border: `1px solid ${autoPublishActive ? 'rgba(22, 163, 74, 0.3)' : 'var(--border)'}`,
                letterSpacing: '0.05em',
              }}
            >
              {autoPublishActive ? 'Auto-Pilot Active' : 'Manual Review'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Create, schedule, and automate your Instagram publications with AI.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
              {brands.length === 0 && <option value="nikipeppers">Niki Peppers</option>}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
            }}
            title="Plan and schedule a full weekly editorial campaign in 1 click"
          >
            <span>Plan Week (AI)</span>
          </button>

          <button
            type="button"
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
            + New Post
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs (Mobile view, desktop uses left submenu) */}
      <div
        className="flex md:hidden overflow-x-auto border-b border-line gap-2 mb-6"
        style={{
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
          <span>Social Media</span>
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
          onClick={() => setActiveTab('chat')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'chat' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'chat' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'chat' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Inbox & Assistant</span>
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
          Ads & Traffic
        </button>

        <button
          onClick={() => setActiveTab('integrations')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'integrations' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'integrations' ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeTab === 'integrations' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Settings & Accounts
        </button>
      </div>

      {/* TAB 1: SOCIAL CREATIVE STUDIO */}
      {activeTab === 'creative' && (
        <div>
          {/* Instagram Quick Connection Card */}
          {(() => {
            const connectedHandle = overview?.brand?.instagramHandle || '';
            const isConnected = Boolean(connectedHandle);
            const isLiveMode = Boolean(integrationsForm.metaPageAccessToken);

            return (
              <div
                style={{
                  background: isConnected ? 'var(--surface)' : 'rgba(37, 99, 235, 0.04)',
                  border: isConnected ? '1px solid var(--border)' : '1px dashed #2563eb',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '260px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isConnected
                        ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
                        : 'var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}
                  >
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>
                        {isConnected ? `@${connectedHandle}` : 'Instagram Account'}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: isConnected ? 'rgba(22, 163, 74, 0.1)' : 'rgba(234, 88, 12, 0.1)',
                          color: isConnected ? '#16a34a' : '#ea580c',
                          border: `1px solid ${isConnected ? 'rgba(22, 163, 74, 0.3)' : 'rgba(234, 88, 12, 0.3)'}`,
                        }}
                      >
                        {isConnected ? (isLiveMode ? 'Connected (Live API)' : 'Connected (Sandbox Mode)') : 'Not Connected'}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                      {isConnected
                        ? (isLiveMode
                            ? 'Posts will publish live to your official Instagram page when scheduled.'
                            : 'Sandbox / Test Mode ready. Generate, schedule, and test publications with no Meta credentials required.')
                        : 'Link your Instagram account to start auto-scheduling and publishing posts.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleTestIntegration('INSTAGRAM')}
                        disabled={testingChannel === 'INSTAGRAM'}
                        style={{
                          padding: '7px 14px',
                          background: 'var(--page)',
                          color: 'var(--ink)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {testingChannel === 'INSTAGRAM' ? 'Testing...' : 'Test Connection'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIgHandleInput(connectedHandle);
                          setShowConnectIgModal(true);
                        }}
                        style={{
                          padding: '7px 14px',
                          background: 'var(--page)',
                          color: 'var(--ink)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Configure
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDisconnectInstagram()}
                        style={{
                          padding: '7px 12px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConnectIgModal(true)}
                      style={{
                        padding: '8px 18px',
                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(220, 39, 67, 0.3)',
                      }}
                    >
                      Connect Instagram
                    </button>
                  )}

                  {/* Auto-Pilot Switch */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingLeft: '10px',
                      borderLeft: '1px solid var(--border)',
                    }}
                  >
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={autoPublishActive}
                        onChange={handleToggleAutoPublish}
                        style={{ cursor: 'pointer', accentColor: '#16a34a' }}
                      />
                      <span>Auto-Pilot</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })()}
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
              {(['all', ...(overview?.brand?.activePlatforms || ['INSTAGRAM', 'FACEBOOK'])]).map((plat) => (
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

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Channels:</span>
                {(['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const).map((p) => {
                  const isEnabled = (overview?.brand?.activePlatforms || ['INSTAGRAM', 'FACEBOOK']).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void handleTogglePlatform(p)}
                      title={`Click to ${isEnabled ? 'remove' : 'add'} ${p} for this brand`}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: isEnabled ? '1px solid rgba(22, 163, 74, 0.4)' : '1px dashed var(--border)',
                        background: isEnabled ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                        color: isEnabled ? '#16a34a' : 'var(--muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isEnabled ? `${p} [Enabled]` : `+ ${p}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--surface)',
                  padding: '3px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCreativeViewMode('grid')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: creativeViewMode === 'grid' ? 'var(--ink)' : 'transparent',
                    color: creativeViewMode === 'grid' ? 'var(--page)' : 'var(--muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Grid View
                </button>
                <button
                  type="button"
                  onClick={() => setCreativeViewMode('calendar')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    background: creativeViewMode === 'calendar' ? 'var(--ink)' : 'transparent',
                    color: creativeViewMode === 'calendar' ? 'var(--page)' : 'var(--muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Editorial Timeline
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                <strong>{filteredDrafts.length}</strong> publications
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => void handleFetchIdeas()}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Content Ideas Bank"
                >
                  AI Ideas
                </button>
                <button
                  type="button"
                  onClick={() => void openStylePlaybookModal()}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Instagram Style Voice & Aesthetics (.md)"
                >
                  Style Voice (.md)
                </button>
              </div>
            </div>
          </div>

          {creativeViewMode === 'calendar' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {filteredDrafts.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px dashed var(--border)',
                    borderRadius: '8px',
                    padding: '40px 20px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--ink)' }}>
                    No publications match this filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Weekly AI Planner
                  </button>
                </div>
              ) : (
                (() => {
                  const sorted = [...filteredDrafts].sort((a, b) => {
                    if (!a.scheduledFor) return 1;
                    if (!b.scheduledFor) return -1;
                    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
                  });

                  const groups: Record<string, SocialDraftView[]> = {};
                  for (const d of sorted) {
                    const key = d.scheduledFor
                      ? new Date(d.scheduledFor).toISOString().slice(0, 10)
                      : 'unscheduled';
                    if (!groups[key]) groups[key] = [];
                    groups[key]!.push(d);
                  }

                  return Object.entries(groups).map(([dateKey, groupDrafts]) => {
                    const isUnscheduled = dateKey === 'unscheduled';
                    const dateLabel = isUnscheduled
                      ? 'Drafts Without Scheduled Date'
                      : new Intl.DateTimeFormat('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(`${dateKey}T12:00:00`));

                    return (
                      <div
                        key={dateKey}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '12px 18px',
                            background: isUnscheduled ? 'rgba(0,0,0,0.02)' : 'rgba(37, 99, 235, 0.06)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: isUnscheduled ? 'var(--muted)' : '#2563eb',
                                display: 'inline-block',
                              }}
                            />
                            <strong style={{ fontSize: '14px', textTransform: 'capitalize', color: 'var(--ink)' }}>
                              {dateLabel}
                            </strong>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {groupDrafts.length} {groupDrafts.length === 1 ? 'publication' : 'publications'}
                          </span>
                        </div>

                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {groupDrafts.map((draft) => {
                            const isPending = draft.status === 'PENDING_APPROVAL';
                            const isApproved = draft.status === 'APPROVED';
                            const isPublished = draft.status === 'PUBLISHED';

                            const timeStr = draft.scheduledFor
                              ? new Date(draft.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'No time';

                            return (
                              <div
                                key={draft.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '80px 140px 1fr 140px auto',
                                  alignItems: 'center',
                                  gap: '14px',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  background: isPending
                                    ? 'rgba(245, 158, 11, 0.03)'
                                    : isApproved
                                    ? 'rgba(22, 163, 74, 0.03)'
                                    : 'var(--page)',
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{timeStr}</strong>
                                </div>

                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: 'var(--surface)',
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    {draft.platform}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: 'var(--surface)',
                                      color: 'var(--muted)',
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    {draft.postType}
                                  </span>
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: '12.5px',
                                      color: 'var(--ink)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                    title={draft.caption}
                                  >
                                    {draft.caption}
                                  </p>
                                </div>

                                <div>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      background: isPublished
                                        ? 'rgba(147, 51, 234, 0.1)'
                                        : isApproved
                                        ? 'rgba(22, 163, 74, 0.1)'
                                        : isPending
                                        ? 'rgba(245, 158, 11, 0.1)'
                                        : 'rgba(0, 0, 0, 0.05)',
                                      color: isPublished
                                        ? '#9333ea'
                                        : isApproved
                                        ? '#16a34a'
                                        : isPending
                                        ? '#d97706'
                                        : 'var(--muted)',
                                      border: isPublished
                                        ? '1px solid rgba(147, 51, 234, 0.3)'
                                        : isApproved
                                        ? '1px solid rgba(22, 163, 74, 0.3)'
                                        : isPending
                                        ? '1px solid rgba(245, 158, 11, 0.3)'
                                        : '1px solid var(--border)',
                                    }}
                                  >
                                    {isPublished
                                      ? 'PUBLISHED'
                                      : isApproved
                                      ? 'READY (AUTO)'
                                      : isPending
                                      ? 'PENDING'
                                      : draft.status}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isPending && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStatus(draft.id, 'APPROVED')}
                                      disabled={statusUpdatingId === draft.id}
                                      style={{
                                        padding: '5px 10px',
                                        background: '#16a34a',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Approve
                                    </button>
                                  )}

                                  {isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => handleDirectPublish(draft.id)}
                                      disabled={publishingDraftId === draft.id}
                                      style={{
                                        padding: '5px 10px',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {publishingDraftId === draft.id ? 'Publishing...' : 'Publish Now'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDraftId(draft.id);
                                      setEditingDraftCaption(draft.caption);
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      background: 'transparent',
                                      border: '1px solid var(--border)',
                                      color: 'var(--muted)',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                    }}
                                    title="Edit caption"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          ) : (
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
                    {editingDraftId === draft.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          rows={6}
                          value={editingDraftCaption}
                          onChange={(e) => setEditingDraftCaption(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            background: 'var(--page)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            color: 'var(--ink)',
                            fontSize: '13px',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setEditingDraftId(null)}
                            style={{
                              padding: '5px 10px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--muted)',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveDraftCaption(draft.id)}
                            style={{
                              padding: '5px 12px',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Save Caption
                          </button>
                        </div>
                      </div>
                    ) : (
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
                    )}

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
                      <>
                        <button
                          disabled={publishingDraftId === draft.id || statusUpdatingId === draft.id}
                          onClick={() => handleDirectPublish(draft.id)}
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
                          {publishingDraftId === draft.id ? 'Publishing...' : 'Publish to Social Media'}
                        </button>
                        <button
                          disabled={statusUpdatingId === draft.id}
                          onClick={() => handleUpdateStatus(draft.id, 'PUBLISHED')}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: 'var(--muted)',
                            border: '1px solid var(--border)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Mark as Published
                        </button>
                      </>
                    )}
                    {draft.status === 'PUBLISHED' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: draft.metrics?.live ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: draft.metrics?.live ? '#22c55e' : '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {draft.metrics?.live ? 'PUBLISHED LIVE' : 'PUBLISHED (SANDBOX SIMULATED)'}
                        </span>
                        {Boolean(draft.metrics?.permalink) && (
                          <a
                            href={String(draft.metrics.permalink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              marginLeft: 'auto',
                              fontSize: '12px',
                              color: '#3b82f6',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            Open Publication ↗
                          </a>
                        )}
                      </div>
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
                        setEditingDraftId(draft.id);
                        setEditingDraftCaption(draft.caption);
                      }}
                      title="Edit draft caption"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: 'var(--ink)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => void handleDeleteDraft(draft.id)}
                      title="Delete this draft permanently"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Delete
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
                        placeholder="e.g. Adjust botanical placement to upper arm instead of forearm"
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
          )}
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCreateCampaignModal(true)}
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
                + Create Campaign
              </button>

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

                      <button
                        onClick={() => void handleDeleteCampaign(camp.id)}
                        title="Delete this ad campaign"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          background: 'transparent',
                          color: '#ef4444',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Delete
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
                placeholder="e.g. Sensitive, warm, authentic, empowering, artistic, professional..."
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
                placeholder="e.g. Women and art lovers (20-45) seeking custom fine-line botanical tattoos, ceramics, and bespoke pieces..."
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

            {/* Active Social Media Channels Management */}
            <div
              style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
            >
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                Active Social Channels
              </strong>
              <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--muted)' }}>
                Enable or remove social platforms for this brand. Unused channels (like TikTok) are excluded from AI drafting and filters.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const).map((plat) => {
                  const isEnabled = (overview?.brand?.activePlatforms || ['INSTAGRAM', 'FACEBOOK']).includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => void handleTogglePlatform(plat)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: isEnabled ? '1.5px solid #16a34a' : '1px dashed var(--border)',
                        background: isEnabled ? 'rgba(22, 163, 74, 0.1)' : 'var(--surface)',
                        color: isEnabled ? '#16a34a' : 'var(--muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {isEnabled ? `${plat} [Active]` : `+ Add ${plat}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instagram Style Intelligence Sync */}
            <div
              style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', display: 'block' }}>
                  Public Instagram Intelligence (@{overview?.brand?.instagramHandle || 'nikipepperstattoo'})
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  {overview?.brand?.scrapedPosts?.length || 0} live publications scraped. The AI Agent learns directly from her actual post history.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isSyncingInstagram}
                  onClick={() => void handleSyncInstagram()}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isSyncingInstagram ? 'Syncing...' : 'Sync Instagram Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInstagramModal(true)}
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View Synced Posts
                </button>
              </div>
            </div>

            <div
              style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', display: 'block' }}>Full Brand Dossier (.md)</strong>
                <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  Complete brand story, style guide, advertising rules, and artist philosophy injected into the AI agent.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void openDossierModal()}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  border: '1px solid var(--border)',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Open Brand Dossier (.md)
              </button>
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

      {/* TAB 5: INBOX & AUTONOMOUS CHAT ASSISTANT */}
      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Left: Threads list */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              height: '750px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Direct Inquiries</h3>
              <button
                onClick={() => {
                  setSelectedConversationId(null);
                  setChatInputMessage('');
                  showToast('New simulated inquiry thread ready');
                }}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--ink)',
                  fontSize: '11px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + New Thread
              </button>
            </div>

            {/* Auto reply switch */}
            <div
              style={{
                padding: '12px',
                background: 'var(--page)',
                borderRadius: '6px',
                marginBottom: '14px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Autonomous AI Reply</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    Replies to customer DMs automatically
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoReplyChat}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: autoReplyChatActive ? '#16a34a' : 'var(--border)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {autoReplyChatActive ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingConversations ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: '13px' }}>
                  Loading inquiries...
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--muted)', fontSize: '12.5px' }}>
                  No customer inquiries yet. Type an inquiry in the simulator on the right to test autonomous responses.
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = selectedConversationId === conv.id;
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--page)',
                        border: isSelected ? '1px solid #2563eb' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{conv.customerName || conv.customerHandle}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--muted)',
                          }}
                        >
                          {conv.platform}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {lastMsg ? `${lastMsg.role === 'customer' ? 'Client: ' : 'AI: '}${lastMsg.content}` : 'No messages'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '4px', textAlign: 'right' }}>
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Chat & Simulator */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              height: '750px',
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    {selectedConversationId
                      ? conversations.find((c) => c.id === selectedConversationId)?.customerName || 'Client Conversation'
                      : 'Community Manager DM Simulator'}
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      fontWeight: 600,
                    }}
                  >
                    AI Grounded in Dossier & Style Playbook
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Policy: Warm consultation routing to ${overview?.brand?.website || 'brand website'}, no arbitrary quotes, zero emojis strictly enforced.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={simulatedCustomerName}
                  onChange={(e) => setSimulatedCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '12px',
                    width: '140px',
                  }}
                />
              </div>
            </div>

            {/* Messages Stream */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                paddingRight: '6px',
                marginBottom: '16px',
              }}
            >
              {(() => {
                const activeConv = conversations.find((c) => c.id === selectedConversationId);
                const msgs = activeConv ? activeConv.messages : [];

                if (msgs.length === 0) {
                  return (
                    <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '420px', color: 'var(--muted)' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                        Interactive Community Manager Simulator
                      </p>
                      <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
                        Simulate how the autonomous AI assistant responds to potential clients, product inquiries, or booking questions for <strong>${overview?.brand?.name || 'this brand'}</strong>.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '14px' }}>
                        {[
                          'Cuanto cuesta un servicio / producto?',
                          'Tenes turnos o disponibilidad para la semana que viene?',
                          'Haces envios a todo el pais?',
                          'Hola, me gustaria consultar sobre un pedido personalizado.',
                        ].map((promptText) => (
                          <button
                            key={promptText}
                            type="button"
                            onClick={() => setChatInputMessage(promptText)}
                            style={{
                              background: 'var(--page)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              color: 'var(--ink)',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {promptText}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return msgs.map((m, idx) => {
                  const isClient = m.role === 'customer';
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isClient ? 'flex-start' : 'flex-end',
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isClient ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted)',
                          marginBottom: '3px',
                          display: 'flex',
                          gap: '6px',
                        }}
                      >
                        <span>{isClient ? activeConv?.customerName || 'Client' : 'Studio Assistant (AI)'}</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          background: isClient ? 'var(--page)' : '#1e3a8a',
                          color: isClient ? 'var(--ink)' : '#ffffff',
                          border: isClient ? '1px solid var(--border)' : '1px solid #2563eb',
                          fontSize: '13.5px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={chatInputMessage}
                disabled={sendingChatMessage}
                onChange={(e) => setChatInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendChatMessage();
                  }
                }}
                placeholder="Type customer message or inquiry..."
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--page)',
                  color: 'var(--ink)',
                  fontSize: '13.5px',
                }}
              />
              <button
                type="button"
                disabled={sendingChatMessage || !chatInputMessage.trim()}
                onClick={handleSendChatMessage}
                style={{
                  padding: '12px 20px',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: sendingChatMessage || !chatInputMessage.trim() ? 'not-allowed' : 'pointer',
                  opacity: sendingChatMessage || !chatInputMessage.trim() ? 0.6 : 1,
                }}
              >
                {sendingChatMessage ? 'Generating...' : 'Send Inquiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INTEGRATIONS & CREDENTIALS CONFIGURATION */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px' }}>
          {/* Top Autonomy Switches */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>Autonomous Social Publishing</div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                  Automatically publishes post to Instagram/Facebook upon owner approval or schedule.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoPublish}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: autoPublishActive ? '#16a34a' : 'var(--border)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {autoPublishActive ? 'ACTIVE' : 'INACTIVE'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>Autonomous AI DM Auto-Reply</div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                  Replies directly to incoming DMs using Brand Dossier and Style Playbook rules.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoReplyChat}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: autoReplyChatActive ? '#16a34a' : 'var(--border)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {autoReplyChatActive ? 'ACTIVE' : 'INACTIVE'}
              </button>
            </div>
          </div>

          {/* Section 1: Meta Graph API (Instagram & Facebook) */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Meta Graph API (Instagram & Facebook)</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                  Used for autonomous publishing of posts, carousels, and reels, plus reading DM webhooks.
                </p>
              </div>
              <button
                type="button"
                disabled={testingChannel === 'INSTAGRAM'}
                onClick={() => handleTestIntegration('INSTAGRAM')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {testingChannel === 'INSTAGRAM' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Meta Page Access Token (Permanent / Long-lived)
                </label>
                <input
                  type="password"
                  value={String(integrationsForm.metaAccessToken || integrationsForm.metaPageAccessToken || '')}
                  onChange={(e) =>
                    setIntegrationsForm((prev) => ({
                      ...prev,
                      metaAccessToken: e.target.value,
                      metaPageAccessToken: e.target.value,
                    }))
                  }
                  placeholder="EAAGm..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Instagram Business Account ID
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.instagramAccountId || integrationsForm.metaInstagramAccountId || '')}
                  onChange={(e) =>
                    setIntegrationsForm((prev) => ({
                      ...prev,
                      instagramAccountId: e.target.value,
                      metaInstagramAccountId: e.target.value,
                    }))
                  }
                  placeholder="17841400000000000"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Facebook Page ID
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.facebookPageId || integrationsForm.metaPageId || '')}
                  onChange={(e) =>
                    setIntegrationsForm((prev) => ({
                      ...prev,
                      facebookPageId: e.target.value,
                      metaPageId: e.target.value,
                    }))
                  }
                  placeholder="109283746501928"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Meta Ads Account ID (act_xxxxxxxxxx)
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.metaAdsAccountId || '')}
                  onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, metaAdsAccountId: e.target.value }))}
                  placeholder="act_1234567890"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Telegram Bot (Mobile Owner Notifications & 1-Click Approvals) */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Telegram Bot (1-Click Mobile Approvals)</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                  Sends rich post previews with inline keyboard action buttons [Approve] and [Reject] directly to the brand owner.
                </p>
              </div>
              <button
                type="button"
                disabled={testingChannel === 'TELEGRAM'}
                onClick={() => handleTestIntegration('TELEGRAM')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {testingChannel === 'TELEGRAM' ? 'Sending ping...' : 'Send Test Ping'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Telegram Bot Token (from @BotFather)
                </label>
                <input
                  type="password"
                  value={String(integrationsForm.telegramBotToken || '')}
                  onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, telegramBotToken: e.target.value }))}
                  placeholder="7123456789:AAH..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Owner Chat ID (from @userinfobot)
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.telegramOwnerChatId || overview?.brand?.telegramChatId || '')}
                  onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, telegramOwnerChatId: e.target.value }))}
                  placeholder="123456789"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: WhatsApp Cloud API */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>WhatsApp Cloud API</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                  Sends interactive WhatsApp messages with quick links for one-click mobile approval and client chats.
                </p>
              </div>
              <button
                type="button"
                disabled={testingChannel === 'WHATSAPP'}
                onClick={() => handleTestIntegration('WHATSAPP')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {testingChannel === 'WHATSAPP' ? 'Testing...' : 'Check Status'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  WhatsApp Phone Number ID
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.whatsappPhoneNumberId || '')}
                  onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, whatsappPhoneNumberId: e.target.value }))}
                  placeholder="10582910482918"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  Owner Destination WhatsApp Number
                </label>
                <input
                  type="text"
                  value={String(integrationsForm.whatsappOwnerNumber || overview?.brand?.whatsappNumber || '')}
                  onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, whatsappOwnerNumber: e.target.value }))}
                  placeholder="+54911..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Webhooks & Verification */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>Webhook Endpoints</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--muted)' }}>
              Configure these webhook URLs in your Meta Developer App and Telegram Bot settings:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Meta Webhook Callback URL</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value="https://control.nicoguzmandev.com/api/marketing/webhooks/whatsapp"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://control.nicoguzmandev.com/api/marketing/webhooks/whatsapp');
                      showToast('Meta Webhook URL copied');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--ink)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Telegram Webhook Callback URL</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value="https://control.nicoguzmandev.com/api/marketing/webhooks/telegram"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://control.nicoguzmandev.com/api/marketing/webhooks/telegram');
                      showToast('Telegram Webhook URL copied');
                    }}
                    style={{
                      padding: '8px 14px',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--ink)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              disabled={savingIntegrations}
              onClick={handleSaveIntegrations}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: savingIntegrations ? 'not-allowed' : 'pointer',
              }}
            >
              {savingIntegrations ? 'Saving Integrations...' : 'Save Integrations & Autonomy Settings'}
            </button>
          </div>
        </div>
      )}

      {/* CONNECT INSTAGRAM MODAL */}
      {showConnectIgModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Connect Instagram
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectIgModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--muted)' }}>
              Enter your Instagram handle to schedule and automate publications. You can test everything immediately in Sandbox Mode.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveInstagram();
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Instagram Handle / Username:
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--muted)', fontWeight: 600 }}>@</span>
                  <input
                    type="text"
                    value={igHandleInput}
                    onChange={(e) => setIgHandleInput(e.target.value)}
                    placeholder="nikipepperstattoo"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 28px',
                      borderRadius: '6px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      color: 'var(--ink)',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '8px' }}>
                  Connection Mode:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: igMode === 'sandbox' ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: igMode === 'sandbox' ? 'rgba(37, 99, 235, 0.05)' : 'var(--page)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="igMode"
                      value="sandbox"
                      checked={igMode === 'sandbox'}
                      onChange={() => setIgMode('sandbox')}
                      style={{ marginTop: '3px', accentColor: '#2563eb' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                        Sandbox / Test Mode (Instant, No API Setup Needed)
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Recommended for testing right away. Generates posts, schedules them, and simulates automated publishing without needing a Meta Developer App.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: igMode === 'live' ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: igMode === 'live' ? 'rgba(37, 99, 235, 0.05)' : 'var(--page)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="igMode"
                      value="live"
                      checked={igMode === 'live'}
                      onChange={() => setIgMode('live')}
                      style={{ marginTop: '3px', accentColor: '#2563eb' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                        Live Publishing (Meta Graph API)
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Publishes live to your official Instagram Business account using a Meta Long-Lived Page Access Token.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {igMode === 'live' && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    Meta Page Access Token:
                  </label>
                  <input
                    type="password"
                    value={igTokenInput}
                    onChange={(e) => setIgTokenInput(e.target.value)}
                    placeholder="EAAB..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowConnectIgModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIgConnection}
                  style={{
                    padding: '8px 20px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: savingIgConnection ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingIgConnection ? 'Saving...' : 'Connect Instagram'}
                </button>
              </div>
            </form>
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
                    {(overview?.brand?.activePlatforms || ['INSTAGRAM', 'FACEBOOK']).map((p) => (
                      <option key={p} value={p}>
                        {p === 'INSTAGRAM' ? 'Instagram' : p === 'FACEBOOK' ? 'Facebook' : p === 'TIKTOK' ? 'TikTok' : p}
                      </option>
                    ))}
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
                  placeholder="e.g. Botanical fern fine line tattoo following forearm curves"
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
                  placeholder="e.g. Consultation bookings at nikipeppers.com for next month guest spot"
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Presets:</span>
                  {[
                    { label: 'Fine Line Botanical', url: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=800&q=80' },
                    { label: 'Studio Process', url: 'https://images.unsplash.com/photo-1562962230-16e4623d36e6?w=800&q=80' },
                    { label: 'Organic Ceramics', url: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=800&q=80' },
                    { label: 'Sketchbook Studies', url: 'https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800&q=80' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setNewMediaUrl(p.url)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
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

      {/* BATCH WEEKLY STRATEGY PLANNER MODAL */}
      {showBatchModal && (
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
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                  Weekly AI Strategy Planner
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                  Generate a cohesive multi-post editorial campaign distributed across consecutive days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleBatchGenerate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Campaign Theme or Angle:
                </label>
                <input
                  type="text"
                  required
                  value={batchTheme}
                  onChange={(e) => setBatchTheme(e.target.value)}
                  placeholder="e.g. Summer Botanical Collection & Consultation Bookings"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--ink)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Commercial Objective:
                </label>
                <input
                  type="text"
                  value={batchObjective}
                  onChange={(e) => setBatchObjective(e.target.value)}
                  placeholder="e.g. Consultation bookings and studio appointments"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--ink)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Publication Volume:
                  </label>
                  <select
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--ink)',
                    }}
                  >
                    <option value={3}>3 publications (Mon, Wed, Fri)</option>
                    <option value={5}>5 publications (Weekdays)</option>
                    <option value={7}>7 publications (Full Week 24/7)</option>
                    <option value={10}>10 publications (High Frequency)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Start Date:
                  </label>
                  <input
                    type="date"
                    required
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--ink)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Distribution Channels:
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {(['INSTAGRAM', 'TIKTOK', 'FACEBOOK'] as const).map((plat) => {
                    const isChecked = batchPlatforms.includes(plat);
                    return (
                      <label
                        key={plat}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #2563eb' : '1px solid var(--border)',
                          background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'var(--page)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBatchPlatforms([...batchPlatforms, plat]);
                            } else if (batchPlatforms.length > 1) {
                              setBatchPlatforms(batchPlatforms.filter((p) => p !== plat));
                            }
                          }}
                        />
                        {plat}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(22, 163, 74, 0.05)',
                  border: '1px solid rgba(22, 163, 74, 0.2)',
                  marginBottom: '20px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                  <input
                    type="checkbox"
                    checked={batchAutoApprove}
                    onChange={(e) => setBatchAutoApprove(e.target.checked)}
                  />
                  <span>
                    <strong>Auto-approve publications</strong> (Ready for autonomous worker publishing at scheduled times)
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingBatch}
                  style={{
                    padding: '9px 22px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
                  }}
                >
                  {isGeneratingBatch ? 'Generating Plan with AI...' : 'Generate Weekly Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI CONTENT IDEAS MODAL */}
      {showIdeasModal && (
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
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                  AI Content Idea Bank & Hooks
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                  Strategic concepts synthesized by Gemini based on brand dossier and audience for {selectedBrandSlug}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIdeasModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>

            {loadingIdeas ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                <p style={{ fontSize: '14px' }}>Synthesizing brand identity and generating suggestions...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ideas.map((idea) => (
                  <div
                    key={idea.id}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{idea.topic}</strong>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {idea.platform}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                            color: 'var(--muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {idea.postType}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--ink)', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '8px 10px', borderRadius: '4px', borderLeft: '3px solid #2563eb' }}>
                      "{idea.hook}"
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <strong>Objective:</strong> {idea.objective}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      <strong>Strategy:</strong> {idea.rationale}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyIdea(idea)}
                        style={{
                          padding: '6px 14px',
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Create Post with This Idea
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Social Style Playbook Modal */}
      {showStylePlaybookModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '960px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Social Style & Personalization Playbook (.md) — {overview?.brand?.name || selectedBrandSlug}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  The AI Creative Agent reads this Markdown playbook whenever generating or scheduling posts to ensure 100% voice, hook, and narrative alignment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStylePlaybookModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            {/* AI Style Analysis & Synthesis Collapsible */}
            <div
              style={{
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: showAnalyzerPanel ? '12px' : 0,
                }}
                onClick={() => setShowAnalyzerPanel(!showAnalyzerPanel)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>
                    AI Style Analyzer & Scraper
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    (Analyze Instagram account, post URLs, or sample captions to synthesize this .md)
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                  {showAnalyzerPanel ? 'Collapse' : 'Expand'}
                </span>
              </div>

              {showAnalyzerPanel && (
                <form onSubmit={handleRunAIStyleAnalysis} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                        Instagram Handle
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>@</span>
                        <input
                          type="text"
                          value={analyzerHandleInput}
                          onChange={(e) => setAnalyzerHandleInput(e.target.value)}
                          placeholder="nikipepperstattoo"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            color: 'var(--ink)',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                        Direct Post URLs (Optional, comma-separated)
                      </label>
                      <input
                        type="text"
                        value={analyzerUrlsInput}
                        onChange={(e) => setAnalyzerUrlsInput(e.target.value)}
                        placeholder="https://www.instagram.com/p/DQGti8QEhOB/ (extracts real copy without login)"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--ink)',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                      Sample Captions, Bio or Tone Notes (Optional — bypasses Instagram login blocks immediately)
                    </label>
                    <textarea
                      value={analyzerCaptionsInput}
                      onChange={(e) => setAnalyzerCaptionsInput(e.target.value)}
                      placeholder="Paste 1-3 recent post captions, bio text, or personal style notes here..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--ink)',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      The AI reads all available posts, URLs, and notes to synthesize the full Markdown playbook.
                    </span>
                    <button
                      type="submit"
                      disabled={analyzingStyle}
                      style={{
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: analyzingStyle ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {analyzingStyle ? 'Analyzing & Synthesizing...' : 'Analyze & Generate Style Playbook (.md)'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Markdown Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Upload .md
                  <input
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={handleUploadStylePlaybookFile}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleDownloadStylePlaybook}
                  disabled={!stylePlaybookContent}
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: stylePlaybookContent ? 'pointer' : 'not-allowed',
                  }}
                >
                  Download .md
                </button>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {stylePlaybookContent.length} chars | {stylePlaybookContent.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            {/* Markdown Editor */}
            {loadingStylePlaybook ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', flex: 1 }}>
                Loading style playbook...
              </div>
            ) : (
              <textarea
                value={stylePlaybookContent}
                onChange={(e) => setStylePlaybookContent(e.target.value)}
                placeholder="# Brand Social Media Style Playbook&#10;&#10;## 1. Tone of Voice...&#10;&#10;## 2. Caption Formulas..."
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '280px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '12px',
                  color: 'var(--ink)',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: '1.5',
                  resize: 'none',
                }}
              />
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Saved playbooks are loaded automatically when drafting or scheduling publications.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowStylePlaybookModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink)',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveStylePlaybook()}
                  disabled={savingStylePlaybook || loadingStylePlaybook}
                  style={{
                    padding: '8px 20px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: savingStylePlaybook ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingStylePlaybook ? 'Saving...' : 'Save Style Playbook (.md)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand Dossier Modal */}
      {showDossierModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '860px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Brand Dossier (.md) - {overview?.brand?.name || selectedBrandSlug}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  This Markdown document is injected directly into the AI Creative Agent as ground truth for tone, style directives, history, and advertising rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--page)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Upload .md File
                  <input
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={handleUploadDossierFile}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleDownloadDossier}
                  style={{
                    background: 'transparent',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Download .md
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {dossierContent.length} chars | {dossierContent.trim().split(/\s+/).filter(Boolean).length} words
              </div>
            </div>

            {/* Textarea Editor */}
            {loadingDossier ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
                Loading brand dossier...
              </div>
            ) : (
              <textarea
                value={dossierContent}
                onChange={(e) => setDossierContent(e.target.value)}
                placeholder="Paste or write full brand markdown documentation (history, tone of voice, visual identity, advertising angles, artist statement, etc.)..."
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '380px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  padding: '14px',
                  background: 'var(--page)',
                  color: 'var(--ink)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDossier()}
                disabled={savingDossier || loadingDossier}
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
                {savingDossier ? 'Saving...' : 'Save Dossier (.md)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE AD CAMPAIGN MODAL */}
      {showCreateCampaignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Create New Ad Campaign
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateCampaignModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateCampaign}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Advertising Network:
                </label>
                <select
                  value={newCampPlatform}
                  onChange={(e) => setNewCampPlatform(e.target.value as 'META' | 'GOOGLE')}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--ink)',
                  }}
                >
                  <option value="META">Meta Ads (Instagram & Facebook)</option>
                  <option value="GOOGLE">Google Ads (Search & Discovery)</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Campaign Name:
                </label>
                <input
                  type="text"
                  required
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  placeholder="e.g. Meta Ads - Botanical Flora Consultation Bookings"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--ink)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Commercial Objective:
                </label>
                <input
                  type="text"
                  required
                  value={newCampObjective}
                  onChange={(e) => setNewCampObjective(e.target.value)}
                  placeholder="e.g. LEAD_GENERATION / Consultation Bookings"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'var(--page)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--ink)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Daily Budget ($/day):
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={newCampBudget}
                    onChange={(e) => setNewCampBudget(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--ink)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Safety Guardrail ($/day max):
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={newCampGuardrail}
                    onChange={(e) => setNewCampGuardrail(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--ink)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateCampaignModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCamp}
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
                  {creatingCamp ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSTAGRAM STYLE INTELLIGENCE MODAL */}
      {showInstagramModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Instagram Style Intelligence
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                  Indexes authentic Instagram publications with real links, copy, and media so the AI agent precisely mirrors the brand's voice and aesthetic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstagramModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

            {/* Actions Bar: Add Post by Link & Profile Sync */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {/* Form 1: Add Post by Link */}
              <form
                onSubmit={handleAddPostByUrl}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '12px 14px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={postUrlInput}
                      onChange={(e) => setPostUrlInput(e.target.value)}
                      placeholder="Paste post link (e.g. https://www.instagram.com/p/DQGti8QEhOB/ or /reel/...)"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--ink)',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isAddingPost || !postUrlInput.trim()}
                      style={{
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isAddingPost || !postUrlInput.trim() ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isAddingPost ? 'Importing...' : 'Add Post by Link'}
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Paste any Instagram post URL. Antigravity extracts the genuine caption, real CDN media, and permalink via Instagram embed.
                  </span>
                </div>
              </form>

              {/* Form 2: Handle Sync */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Profile Handle: @</span>
                <input
                  type="text"
                  value={instagramHandleInput}
                  onChange={(e) => setInstagramHandleInput(e.target.value)}
                  placeholder="nikipepperstattoo"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--ink)',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="button"
                  disabled={isSyncingInstagram}
                  onClick={() => void handleSyncInstagram()}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isSyncingInstagram ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isSyncingInstagram ? 'Syncing...' : 'Scrape Profile'}
                </button>
              </div>
            </div>

            {/* Synced Posts List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {overview?.brand?.scrapedPosts && overview.brand.scrapedPosts.length > 0 ? (
                overview.brand.scrapedPosts.map((post, idx) => (
                  <div
                    key={post.id || idx}
                    style={{
                      display: 'flex',
                      gap: '14px',
                      background: 'var(--page)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    {post.mediaUrl && (
                      <div style={{ width: '90px', height: '90px', borderRadius: '6px', overflow: 'hidden', background: '#111', flexShrink: 0 }}>
                        <img src={post.mediaUrl} alt="Post asset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            {post.postType || 'POST'}
                          </span>
                          {post.publishedAt && (
                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {new Date(post.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                                fontSize: '11px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(37,99,235,0.08)',
                              }}
                            >
                              Open on Instagram ↗
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={deletingPostId === post.id}
                          onClick={() => void handleDeleteInstagramPost(post.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ef4444',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: deletingPostId === post.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deletingPostId === post.id ? 'Removing...' : 'Delete'}
                        </button>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {post.caption}
                      </p>
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {post.hashtags.map((h) => (
                            <span key={h} style={{ fontSize: '11px', color: '#2563eb' }}>
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', background: 'var(--page)', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600 }}>No Instagram publications saved yet.</p>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Paste any Instagram post URL above (e.g. <code>https://www.instagram.com/p/DQGti8QEhOB/</code>) to import authentic posts, or click <strong>Scrape Profile</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowInstagramModal(false)}
                style={{
                  padding: '8px 20px',
                  background: 'var(--page)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  borderRadius: '4px',
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
    
      {/* ADD BRAND ACCOUNT MODAL */}
      {showAddBrandModal && (
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
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Add New Brand / Client Account</h3>
              <button
                type="button"
                onClick={() => setShowAddBrandModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBrand} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Brand / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => {
                    setNewBrandName(e.target.value);
                    if (!newBrandSlug) {
                      setNewBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                    }
                  }}
                  placeholder="e.g. Acme Studio, Black Lotus Tattoo, Studio 88"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Slug (Unique Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBrandSlug}
                    onChange={(e) => setNewBrandSlug(e.target.value)}
                    placeholder="e.g. acmestudio"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Website URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={newBrandWebsite}
                    onChange={(e) => setNewBrandWebsite(e.target.value)}
                    placeholder="https://acmestudio.com"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={newBrandInstagram}
                    onChange={(e) => setNewBrandInstagram(e.target.value)}
                    placeholder="@acmestudio"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Owner WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={newBrandWhatsapp}
                    onChange={(e) => setNewBrandWhatsapp(e.target.value)}
                    placeholder="+54911..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--page)',
                      color: 'var(--ink)',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Tone of Voice
                </label>
                <input
                  type="text"
                  value={newBrandTone}
                  onChange={(e) => setNewBrandTone(e.target.value)}
                  placeholder="e.g. Modern, minimalist, warm, artistic, sophisticated"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Target Audience
                </label>
                <input
                  type="text"
                  value={newBrandAudience}
                  onChange={(e) => setNewBrandAudience(e.target.value)}
                  placeholder="e.g. Creative professionals and design enthusiasts aged 25-45"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Initial Brand Dossier (.md)
                </label>
                <textarea
                  rows={4}
                  value={newBrandDossier}
                  onChange={(e) => setNewBrandDossier(e.target.value)}
                  placeholder="# Brand Story & Values&#10;&#10;Describe your company history, philosophy, pricing methodology, and guidelines..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddBrandModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--page)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBrand}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    cursor: creatingBrand ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {creatingBrand ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}