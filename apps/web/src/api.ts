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
  PromotionsOverview,
} from '@cc/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

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
    request<{ brand: BrandView; scraped: any }>(`/api/marketing/brands/${encodeURIComponent(slug)}/sync-instagram`, {
      method: 'POST',
      body: JSON.stringify({ handle }),
    }),

  // Promociones de Argentina
  promotions: (refresh?: boolean) =>
    request<PromotionsOverview>(`/api/promociones${refresh ? '?refresh=true' : ''}`),
  scrapePromotions: () =>
    request<PromotionsOverview>('/api/promociones/scrape', { method: 'POST' }),
};
