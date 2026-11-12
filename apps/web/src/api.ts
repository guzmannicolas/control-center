import type {
  CloudflareOverview,
  CloudflareDnsItem,
  DeploymentOverview,
  DeploymentRecord,
  DatabaseView,
  DirectoryListing,
  DomainView,
  FileContent,
  ImprovementInput,
  ImprovementView,
  IncidentView,
  LearningProgressView,
  Overview,
  ResultPoint,
  User,
  VaultItem,
  VaultOverview,
  VaultProjectConfig,
  VaultAuditSummary,
  VaultDiffResult,
  DiscoveredEnvFile,
  KnowledgeDocMeta,
  KnowledgeDocDetail,
  RepoAnalysisResult,
  MarketingOverview,
  SocialDraftView,
  SocialDraftStatus,
  SocialPlatform,
  AdCampaignView,
  BrandView,
  GenerateDraftInput,
  DispatchApprovalInput,
  UpdateAdCampaignInput,
  CreateAdCampaignInput,
  UpdateDraftInput,
  UpdateBrandIntegrationsInput,
  TestChatMessageInput,
  BrandConversationView,
  BatchGenerateDraftsInput,
  ContentIdeaSuggestion,
  MarketingSchedulerStatus,
  PromotionsOverview,
  ArgentinePromo,
  PriceGlitchOverview,
  PriceGlitchItem,
  LeadView,
  VpsSecurityAudit,
} from '@cc/shared';

export interface VpsStatusView {
  hostname: string;
  uptimeHuman: string;
  loadAvg: [number, number, number];
  cpuCores: number;
  memory: {
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
    swapTotalGb: number;
    swapUsedGb: number;
  };
  disk: {
    filesystem: string;
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
  };
  dockerStorage: Array<{
    type: string;
    totalCount: string;
    active: string;
    size: string;
    reclaimable: string;
  }>;
  topDirectories: Array<{
    path: string;
    sizeHuman: string;
  }>;
  containers: Array<{
    name: string;
    image: string;
    status: string;
    state: string;
  }>;
}

export interface CleanupResult {
  ok: boolean;
  target: string;
  beforeUsedGb: number;
  afterUsedGb: number;
  freedGb: number;
  log: string;
}

export interface VercelProjectSummary {
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

export interface VercelResponse {
  configured: boolean;
  projects: VercelProjectSummary[];
  fetchedAt: string;
}

export interface BackupFileEntry {
  name: string;
  sizeBytes: number;
  sizeHuman: string;
  modifiedAt: string;
  ageHours: number;
  kind: 'full-tar' | 'postgres-sql' | 'meta-json' | 'other';
}

export interface CloudBackupInfo {
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

export interface BackupTargetConfig {
  cms_postgres: boolean;
  control_center_postgres: boolean;
  cms_uploads: boolean;
  secrets: boolean;
}

export interface BackupConfig {
  version: number;
  updatedAt: string;
  targets: BackupTargetConfig;
  cloudSync: boolean;
  retention: {
    keepLocalDays: number;
    keepRemoteDays: number;
  };
}

export interface DiscoveredDatabaseTarget {
  id: string;
  name: string;
  engine: string;
  purpose: string;
  project: string | null;
  key: string;
  isIncluded: boolean;
  status: 'healthy' | 'unknown';
}

export interface BackupsOverview {
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

export interface ArchiveFileEntry {
  path: string;
  sizeBytes: number;
  sizeHuman: string;
  modified: string;
  permissions: string;
}

export interface InspectResult {
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

export interface VerifyResult {
  ok: boolean;
  filename: string;
  passed: boolean;
  message: string;
  details: string[];
}

export interface WhatsAppStatus {
  state: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | string;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  userName: string | null;
  error?: string | null;
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

export const getApiBaseUrl = () => BASE;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // credentials: 'include' sends the session cookie to the API (a different subdomain).
    res = await fetch(BASE + path, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      // A request that never answers must not leave the screen on "Loading…" forever.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new ApiError(0, timedOut ? 'The API took too long to answer' : 'The API cannot be reached');
  }
  const body = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;
export const isNetworkError = (err: unknown) => err instanceof ApiError && err.status === 0;

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  overview: () => request<Overview>('/api/overview'),
  incidents: () => request<IncidentView[]>('/api/incidents?limit=20'),
  domains: () => request<DomainView[]>('/api/domains'),
  databases: () => request<DatabaseView[]>('/api/databases'),
  improvements: () => request<ImprovementView[]>('/api/improvements'),
  addImprovement: (input: ImprovementInput) => request<ImprovementView>('/api/improvements', { method: 'POST', body: JSON.stringify(input) }),
  updateImprovement: (id: string, change: Partial<ImprovementInput>) =>
    request<ImprovementView>(`/api/improvements/${id}`, { method: 'PATCH', body: JSON.stringify(change) }),
  deleteImprovement: (id: string) => request<void>(`/api/improvements/${id}`, { method: 'DELETE' }),
  learningProgress: () => request<LearningProgressView[]>('/api/learning/progress'),
  completeModule: (moduleId: string, score: number) =>
    request<LearningProgressView>(`/api/learning/progress/${moduleId}`, { method: 'PUT', body: JSON.stringify({ score }) }),
  resetModule: (moduleId: string) => request<void>(`/api/learning/progress/${moduleId}`, { method: 'DELETE' }),
  results: (monitorId: string, hours: number) => request<ResultPoint[]>(`/api/monitors/${monitorId}/results?hours=${hours}`),

  // Deployments (CI/CD)
  deployments: () => request<DeploymentOverview>('/api/deployments'),
  deployment: (id: string) => request<DeploymentRecord>(`/api/deployments/${id}`),
  triggerDeployment: (repo: string, branch = 'main') =>
    request<{ ok: true; deployment: DeploymentRecord }>('/api/deployments/trigger', {
      method: 'POST',
      body: JSON.stringify({ repo, branch }),
    }),

  // Cloudflare
  cloudflareOverview: (zoneId?: string) =>
    request<CloudflareOverview>(`/api/cloudflare/overview${zoneId ? `?zoneId=${zoneId}` : ''}`),
  purgeCloudflareCache: (zoneId: string, purgeEverything = true, files?: string[]) =>
    request<{ ok: true }>('/api/cloudflare/purge-cache', {
      method: 'POST',
      body: JSON.stringify({ zoneId, purgeEverything, files }),
    }),
  createCloudflareDns: (record: { zoneId: string; type: string; name: string; content: string; proxied: boolean; ttl?: number; comment?: string }) =>
    request<{ ok: true; record: CloudflareDnsItem }>('/api/cloudflare/dns', {
      method: 'POST',
      body: JSON.stringify(record),
    }),
  deleteCloudflareDns: (zoneId: string, recordId: string) =>
    request<{ ok: true }>(`/api/cloudflare/dns/${recordId}?zoneId=${zoneId}`, {
      method: 'DELETE',
    }),
  setCloudflareSecurityLevel: (zoneId: string, level: string) =>
    request<{ ok: true }>('/api/cloudflare/security-level', {
      method: 'PATCH',
      body: JSON.stringify({ zoneId, level }),
    }),

  // VPS File Manager
  filesList: (path = '') =>
    request<DirectoryListing>(`/api/files/list${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  filesRead: (path: string) =>
    request<FileContent>(`/api/files/read?path=${encodeURIComponent(path)}`),
  filesWrite: (path: string, content: string) =>
    request<{ success: boolean; path: string }>('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),
  filesCreate: (payload: { path?: string; name: string; type: 'file' | 'directory' }) =>
    request<{ success: boolean; path: string }>('/api/files/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  filesDelete: (path: string) =>
    request<{ success: boolean; path: string }>('/api/files/delete', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    }),

  // Env Vault & Secrets
  vaultOverview: () => request<VaultOverview>('/api/vault'),
  vaultUpsert: (payload: {
    id?: string;
    key: string;
    value: string;
    project: string;
    description?: string;
    isSecret?: boolean;
  }) =>
    request<VaultItem>('/api/vault', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  vaultDelete: (id: string) => request<{ ok: true }>(`/api/vault/${id}`, { method: 'DELETE' }),
  vaultImport: (project: string, envText: string) =>
    request<{ importedCount: number; items: VaultItem[] }>('/api/vault/import', {
      method: 'POST',
      body: JSON.stringify({ project, envText }),
    }),
  vaultExport: (project: string) =>
    request<{ project: string; envText: string }>(`/api/vault/export?project=${encodeURIComponent(project)}`),
  vaultAudit: () => request<VaultAuditSummary>('/api/vault/audit', { method: 'POST' }),
  vaultUpdateProjectConfig: (config: VaultProjectConfig) =>
    request<VaultProjectConfig>('/api/vault/project-config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  vaultDiff: (project: string) =>
    request<VaultDiffResult>(`/api/vault/diff?project=${encodeURIComponent(project)}`),
  vaultDeploy: (project: string) =>
    request<{ success: boolean; filePath: string; backupPath: string | null }>('/api/vault/deploy', {
      method: 'POST',
      body: JSON.stringify({ project }),
    }),
  vaultDiscover: (path?: string) =>
    request<DiscoveredEnvFile[]>(`/api/vault/discover${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  vaultImportFile: (filePath: string, project?: string) =>
    request<{ importedCount: number; project: string }>('/api/vault/import-file', {
      method: 'POST',
      body: JSON.stringify({ filePath, project }),
    }),

// Knowledge Base & Agent Context
  knowledgeList: () => request<KnowledgeDocMeta[]>('/api/knowledge'),
  knowledgeGet: (slug: string) => request<KnowledgeDocDetail>(`/api/knowledge/${slug}`),
  knowledgeSave: (slug: string, content: string) =>
    request<{ ok: boolean; meta: KnowledgeDocMeta }>(`/api/knowledge/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  agentContext: (topics?: string) =>
    request<{ topic: string; context: string }>(topics ? `/api/agent/context?topic=${encodeURIComponent(topics)}&format=json` : '/api/agent/context?format=json'),
  knowledgeGraph: () => request<RepoAnalysisResult>('/api/knowledge/graph'),
  knowledgeGraphAnalyze: () => request<RepoAnalysisResult>('/api/knowledge/graph/analyze', { method: 'POST' }),

  // Growth & Marketing Engine
  marketingOverview: (brandSlug?: string) =>
    request<MarketingOverview>(`/api/marketing/overview${brandSlug ? `?brandSlug=${encodeURIComponent(brandSlug)}` : ''}`),
  marketingDrafts: (params?: { brandSlug?: string; status?: string; platform?: string }) => {
    const q = new URLSearchParams();
    if (params?.brandSlug) q.set('brandSlug', params.brandSlug);
    if (params?.status) q.set('status', params.status);
    if (params?.platform) q.set('platform', params.platform);
    const qs = q.toString();
    return request<{ drafts: SocialDraftView[] }>(`/api/marketing/drafts${qs ? `?${qs}` : ''}`);
  },
  marketingGenerateDraft: (payload: GenerateDraftInput) =>
    request<{ draft: SocialDraftView; creativeInfo?: any }>('/api/marketing/drafts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  marketingUpdateDraftStatus: (id: string, status: SocialDraftStatus, feedback?: string) =>
    request<{ draft: SocialDraftView }>(`/api/marketing/drafts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, feedback }),
    }),
  marketingDispatchApproval: (id: string, payload?: DispatchApprovalInput) =>
    request<{ ok: boolean; channel: string; recipient: string; approvalUrl: string; messagePreview: string; error?: string }>(
      `/api/marketing/drafts/${id}/dispatch-approval`,
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      }
    ),
  marketingAds: (params?: { brandSlug?: string; platform?: string }) => {
    const q = new URLSearchParams();
    if (params?.brandSlug) q.set('brandSlug', params.brandSlug);
    if (params?.platform) q.set('platform', params.platform);
    const qs = q.toString();
    return request<{ campaigns: AdCampaignView[]; audit: any }>(`/api/marketing/ads${qs ? `?${qs}` : ''}`);
  },
  marketingUpdateAdCampaign: (id: string, payload: UpdateAdCampaignInput) =>
    request<{ campaign: AdCampaignView }>(`/api/marketing/ads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  marketingAuditAds: () =>
    request<{ audit: any; timestamp: string }>('/api/marketing/ads/audit', { method: 'POST' }),
  marketingBrands: () => request<{ brands: BrandView[] }>('/api/marketing/brands'),
  marketingUpsertBrand: (brand: Partial<BrandView>) =>
    request<{ brand: BrandView }>('/api/marketing/brands', {
      method: 'POST',
      body: JSON.stringify(brand),
    }),
  marketingPublicDraft: (token: string) =>
    request<{ draft: SocialDraftView; brand: BrandView }>(`/api/marketing/drafts/public/${token}`),
  marketingPublicAction: (token: string, decision: 'APPROVED' | 'REJECTED', feedback?: string) =>
    request<any>(`/api/marketing/drafts/public/${token}/action`, {
      method: 'POST',
      body: JSON.stringify({ decision, feedback }),
    }),
  marketingBrandDossier: (slug: string) =>
    request<{ brand: { id: string; slug: string; name: string; dossierMd: string | null } }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/dossier`
    ),
  marketingSaveBrandDossier: (slug: string, dossierMd: string) =>
    request<{ brand: { id: string; slug: string; name: string; dossierMd: string | null } }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/dossier`,
      {
        method: 'PUT',
        body: JSON.stringify({ dossierMd }),
      }
    ),
  marketingDeleteDraft: (id: string) =>
    request<{ ok: boolean; id: string }>(`/api/marketing/drafts/${id}`, { method: 'DELETE' }),
  marketingUpdateDraft: (id: string, payload: UpdateDraftInput) =>
    request<{ draft: SocialDraftView }>(`/api/marketing/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  marketingCreateAdCampaign: (payload: CreateAdCampaignInput) =>
    request<{ campaign: AdCampaignView }>('/api/marketing/ads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  marketingDeleteAdCampaign: (id: string) =>
    request<{ ok: boolean; id: string }>(`/api/marketing/ads/${id}`, { method: 'DELETE' }),
  marketingUpdateBrandPlatforms: (slug: string, activePlatforms: SocialPlatform[]) =>
    request<{ brand: BrandView }>(`/api/marketing/brands/${encodeURIComponent(slug)}/platforms`, {
      method: 'PUT',
      body: JSON.stringify({ activePlatforms }),
    }),
  marketingSyncInstagram: (slug: string, handle?: string) =>
    request<{ brand: BrandView; scraped: any; statusMessage?: string }>(`/api/marketing/brands/${encodeURIComponent(slug)}/sync-instagram`, {
      method: 'POST',
      body: JSON.stringify({ handle }),
    }),
  marketingAddInstagramPost: (slug: string, url: string, caption?: string) =>
    request<{ brand: BrandView; post: any }>(`/api/marketing/brands/${encodeURIComponent(slug)}/instagram-posts`, {
      method: 'POST',
      body: JSON.stringify({ url, caption }),
    }),
  marketingDeleteInstagramPost: (slug: string, postId: string) =>
    request<{ brand: BrandView; deletedPostId: string }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/instagram-posts/${encodeURIComponent(postId)}`,
      {
        method: 'DELETE',
      }
    ),
  marketingBrandSocialStyle: (slug: string) =>
    request<{ brand: BrandView; socialStyleMd: string | null }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/social-style`
    ),
  marketingSaveBrandSocialStyle: (slug: string, socialStyleMd: string) =>
    request<{ brand: BrandView; socialStyleMd: string }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/social-style`,
      {
        method: 'PUT',
        body: JSON.stringify({ socialStyleMd }),
      }
    ),
  marketingAnalyzeSocialStyle: (
    slug: string,
    payload: { handle?: string; postUrls?: string[]; sampleCaptions?: string }
  ) =>
    request<{ brand: BrandView; socialStyleMd: string; message: string }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/analyze-style`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  marketingBatchGenerateDrafts: (payload: BatchGenerateDraftsInput) =>
    request<{ success: boolean; theme: string; source: string; count: number; drafts: SocialDraftView[] }>(
      '/api/marketing/drafts/batch-generate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  marketingGetContentIdeas: (brandSlug?: string) =>
    request<{ ideas: ContentIdeaSuggestion[] }>(
      `/api/marketing/ideas/suggestions${brandSlug ? `?brandSlug=${encodeURIComponent(brandSlug)}` : ''}`
    ),
  marketingGetSchedulerStatus: (brandSlug?: string) =>
    request<MarketingSchedulerStatus>(
      `/api/marketing/scheduler/status${brandSlug ? `?brandSlug=${encodeURIComponent(brandSlug)}` : ''}`
    ),
  marketingPublishDraft: (id: string) =>
    request<{ draft: SocialDraftView; publishResult: any }>(`/api/marketing/drafts/${id}/publish`, {
      method: 'POST',
    }),
  marketingPublishPendingDrafts: () =>
    request<{ publishedCount: number; results: any[] }>('/api/marketing/drafts/publish-pending', {
      method: 'POST',
    }),
  marketingUpdateBrandIntegrations: (slug: string, payload: UpdateBrandIntegrationsInput) =>
    request<{ brand: BrandView }>(`/api/marketing/brands/${encodeURIComponent(slug)}/integrations`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  marketingTestIntegration: (slug: string, channel: 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'META_ADS') =>
    request<{ ok: boolean; channel: string; message: string }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/test-integration`,
      {
        method: 'POST',
        body: JSON.stringify({ channel }),
      }
    ),
  marketingConversations: (slug: string) =>
    request<{ conversations: BrandConversationView[] }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/conversations`
    ),
  marketingSendChatMessage: (slug: string, payload: TestChatMessageInput) =>
    request<{ conversation: BrandConversationView; reply: any }>(
      `/api/marketing/brands/${encodeURIComponent(slug)}/conversations/chat`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // Promociones de Argentina
  promotions: (refresh?: boolean) =>
    request<PromotionsOverview>(`/api/promociones${refresh ? '?refresh=true' : ''}`),
  scrapePromotions: () =>
    request<PromotionsOverview>('/api/promociones/scrape', { method: 'POST' }),
  calculateSavings: (payload: { amount: number; category?: any; dayIndex?: number }) =>
    request<{ results: any[] }>('/api/promociones/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  priceGlitches: (refresh?: boolean) =>
    request<PriceGlitchOverview>(`/api/promociones/glitches${refresh ? '?refresh=true' : ''}`),
  refreshPriceGlitches: () =>
    request<PriceGlitchOverview>('/api/promociones/glitches/refresh', { method: 'POST' }),
  verifyPromotionUrl: (id: string) =>
    request<ArgentinePromo>(`/api/promociones/${id}/verify-url`, { method: 'POST' }),
  verifyPriceGlitch: (id: string) =>
    request<PriceGlitchItem>(`/api/promociones/glitches/${id}/verify`, { method: 'POST' }),

  // VPS Telemetry, Security & Cleanup
  vpsStatus: () => request<VpsStatusView>('/api/vps/status'),
  vpsCleanup: (target: 'docker' | 'vscode' | 'caches' | 'all') =>
    request<CleanupResult>('/api/vps/cleanup', {
      method: 'POST',
      body: JSON.stringify({ target }),
    }),
  vpsSecurity: () => request<VpsSecurityAudit>('/api/vps/security'),

  // Vercel Projects
  vercelProjects: (refresh = false) =>
    request<VercelResponse>(`/api/vercel/projects${refresh ? '?refresh=1' : ''}`),

  // Backups Engine
  backups: () => request<BackupsOverview>('/api/backups'),
  backupSaveConfig: (payload: Partial<BackupConfig>) =>
    request<{ ok: boolean; config: BackupConfig }>('/api/backups/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  backupRun: (payload: { targets: BackupTargetConfig; cloudSync: boolean }) =>
    request<{ ok: boolean; output: string }>('/api/backups/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  backupInspect: (filename: string) =>
    request<InspectResult>(`/api/backups/inspect/${encodeURIComponent(filename)}`),
  backupVerify: (filename: string) =>
    request<VerifyResult>(`/api/backups/verify/${encodeURIComponent(filename)}`, {
      method: 'POST',
    }),
  backupDelete: (names: string[]) =>
    request<{ ok: boolean }>('/api/backups/delete', {
      method: 'POST',
      body: JSON.stringify({ names }),
    }),
  backupDownloadUrl: (filename: string) =>
    `${BASE}/api/backups/download/${encodeURIComponent(filename)}`,

  // Leads, WhatsApp & Outreach CRM
  leads: () => request<{ leads: LeadView[] }>('/api/leads'),
  leadScrape: (payload: { category: string; city: string; limit?: number }) =>
    request<{ ok: boolean }>('/api/leads/scrape', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  leadEnrich: (id: string) =>
    request<{ lead: LeadView }>(`/api/leads/${id}/enrich`, { method: 'POST' }),
  leadVerifyInstagram: (id: string) =>
    request<{ lead: LeadView; verification: { valid: boolean; reason?: string } }>(
      `/api/leads/${id}/verify-instagram`,
      { method: 'POST' }
    ),
  leadVerifyAllInstagram: () =>
    request<{ ok: boolean; verifiedCount: number }>('/api/leads/verify-all-instagram', {
      method: 'POST',
    }),
  leadUpdate: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: boolean; lead?: LeadView }>(`/api/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  leadDelete: (id: string) =>
    request<{ ok: boolean }>(`/api/leads/${id}`, { method: 'DELETE' }),
  leadGeneratePitch: (id: string, payload?: { isFollowUp?: boolean }) =>
    request<{ pitch?: string }>(`/api/leads/${id}/generate-pitch`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
  leadExportCsvUrl: () => `${BASE}/api/leads/export/csv`,

  whatsappStatus: () => request<{ status: WhatsAppStatus }>('/api/whatsapp/status'),
  whatsappConnect: () => request<{ status: WhatsAppStatus }>('/api/whatsapp/connect', { method: 'POST' }),
  whatsappDisconnect: () => request<{ status: WhatsAppStatus }>('/api/whatsapp/disconnect', { method: 'POST' }),
  outreachStatus: () => request<{ status: any }>('/api/leads/outreach/status'),
  outreachQueue: (payload: { leadIds: string[] }) =>
    request<{ ok: boolean }>('/api/leads/outreach/queue', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
