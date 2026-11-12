import { z } from 'zod';

export const TARGET_TYPES = ['domain', 'website', 'vercel_project', 'github_repo', 'server', 'service', 'database'] as const;
export const TargetType = z.enum(TARGET_TYPES);
export type TargetType = z.infer<typeof TargetType>;

// What each target type stores in its `config` column.
export const DomainConfig = z.object({ domain: z.string().min(3) });
export const UrlConfig = z.object({ url: z.url() });

export interface TargetLike {
  type?: string;
  config: unknown;
}

export const urlOf = (target: TargetLike): URL => {
  return new URL(UrlConfig.parse(target.config).url);
};

export const hostOf = (target: TargetLike): string => {
  if (target.type === 'domain') {
    return DomainConfig.parse(target.config).domain;
  }
  return urlOf(target).hostname;
};

export const safeHostOf = (target: TargetLike | { url?: string } | unknown): string | null => {
  if (!target || typeof target !== 'object') return null;
  const t = target as Record<string, unknown>;
  if (t.type === 'domain') {
    const d = DomainConfig.safeParse(t.config);
    return d.success ? d.data.domain : null;
  }
  const cfg = t.config !== undefined ? t.config : t;
  const u = UrlConfig.safeParse(cfg);
  if (u.success) {
    try {
      return new URL(u.data.url).hostname;
    } catch {
      return null;
    }
  }
  return null;
};
// A database is reached through a URL kept in an environment variable (never in the database itself).
// The name must start with MONITOR_ so a checker can never be pointed at another secret, like DATABASE_URL.
export const DATABASE_ENGINES = ['postgres', 'redis'] as const;
export const DatabaseConfig = z.object({
  engine: z.enum(DATABASE_ENGINES),
  connectionEnv: z.string().regex(/^MONITOR_[A-Z0-9_]+$/),
  purpose: z.string().max(200).default(''),
  // The project this database belongs to (e.g. "CMS"); the dashboard groups databases by it.
  project: z.string().trim().min(1).max(60).optional(),
});

// ok: all good · warn: works but needs attention · fail: broken · error: the check itself could not run
export const CHECK_STATUSES = ['ok', 'warn', 'fail', 'error'] as const;
export const CheckStatus = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const CheckOutcome = z.object({
  status: CheckStatus,
  message: z.string().max(500),
  metrics: z.record(z.string(), z.number()).default({}),
  // Facts that are not numbers (a registrar, a list of name servers), shown as-is.
  details: z.record(z.string(), z.unknown()).default({}),
});
export type CheckOutcome = z.infer<typeof CheckOutcome>;
// What a checker may return: metrics and details are optional and default to empty.
export type CheckOutcomeInput = z.input<typeof CheckOutcome>;

// "error" ranks below "fail": not knowing is less bad than knowing it is broken.
const SEVERITY: Record<CheckStatus, number> = { ok: 0, warn: 1, error: 2, fail: 3 };

// Higher = more serious. A status of null (never checked yet) ranks lowest.
export const statusRank = (s: CheckStatus | null) => (s === null ? -1 : SEVERITY[s]);

export function worstStatus(statuses: readonly CheckStatus[]): CheckStatus {
  return statuses.reduce<CheckStatus>((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), 'ok');
}

// --- API contract: what the API returns and the dashboard reads -----------------------------------

export interface User {
  id: string;
  email: string;
}

export interface MonitorView {
  id: string;
  checker: string;
  intervalSeconds: number;
  status: CheckStatus | null;
  lastCheckedAt: string | null;
  message: string | null;
  metrics: Record<string, number>;
  openIncident: boolean;
}

export interface TargetView {
  id: string;
  name: string;
  type: TargetType;
  tags: string[];
  url: string | null;
  status: CheckStatus | null; // worst of its monitors; null until first checked
  monitors: MonitorView[];
}

export interface OverviewTelemetry {
  leads: {
    total: number;
    uncontacted: number;
    withoutWebsite: number;
    converted: number;
  };
  vault: {
    itemsCount: number;
    projectsCount: number;
  };
  knowledge: {
    docsCount: number;
    skillsCount: number;
    mcpOnline: boolean;
  };
  backups: {
    lastSnapshotTime: string | null;
    localBackupsCount: number;
    cloudSyncProvider: string;
  };
  vps: {
    hostname: string;
    uptimeHuman: string;
    ramUsedPercent: number;
    ramTotalGb: number;
    ramUsedGb: number;
    diskUsedPercent: number;
    diskTotalGb: number;
    diskUsedGb: number;
  };
}

export interface Overview {
  generatedAt: string;
  counts: Record<CheckStatus | 'unknown', number>;
  targets: TargetView[]; // most serious first
  telemetry?: OverviewTelemetry;
}

export interface IncidentView {
  id: string;
  monitorId: string;
  targetName: string;
  checker: string;
  severity: 'warn' | 'fail';
  openedAt: string;
  resolvedAt: string | null;
  lastMessage: string;
}

// A type alias (not an interface) so it fits where any object of facts is accepted.
export type DomainDetails = {
  registrar: string | null;
  registeredOn: string | null;
  expiresOn: string | null;
  nameservers: string[];
  dnsProvider: string | null;
  dnssec: boolean | null;
  transferLocked: boolean;
};

export interface DomainView {
  id: string;
  name: string;
  status: CheckStatus | null;
  message: string | null;
  checkedAt: string | null;
  daysLeft: number | null;
  details: DomainDetails | null;
  // Watched sites served from the domain itself (e.g. https://example.com).
  sites: { id: string; name: string; url: string; status: CheckStatus | null }[];
  // Watched hosts under the domain (e.g. blog.example.com), one entry per host.
  subdomains: SubdomainView[];
}

export interface SubdomainView {
  host: string;
  status: CheckStatus | null; // worst status among everything watched on this host
  dnsType?: string;
  proxied?: boolean;
  targets: { id: string; name: string; url: string; status: CheckStatus | null }[];
}

export interface CheckSnapshot {
  status: CheckStatus | null;
  message: string | null;
  checkedAt: string | null;
  metrics: Record<string, number>;
  details: Record<string, unknown>;
}

export interface DatabaseView {
  id: string;
  name: string;
  engine: (typeof DATABASE_ENGINES)[number];
  purpose: string;
  project: string | null; // null = not assigned to a project
  status: CheckStatus | null;
  health: CheckSnapshot | null;
  backup: CheckSnapshot | null; // null = no backup is being watched for this database
}

export interface ResultPoint {
  checkedAt: string;
  status: CheckStatus;
  durationMs: number;
  message: string;
  metrics: Record<string, number>;
}

// --- Improvements (backlog) -----------------------------------------------------------------------

export const IMPROVEMENT_AREAS = ['security', 'backups', 'monitoring', 'infrastructure', 'domains', 'dashboard', 'code quality', 'clients'] as const;
export const IMPROVEMENT_STATUSES = ['idea', 'planned', 'in_progress', 'done'] as const;
export const PRIORITIES = ['high', 'medium', 'low'] as const;

// One schema for the form in the browser and the request on the server.
export const ImprovementInput = z.object({
  title: z.string().trim().min(3, 'Write at least 3 characters').max(200),
  details: z.string().trim().max(2000).default(''),
  area: z.enum(IMPROVEMENT_AREAS),
  priority: z.enum(PRIORITIES).default('medium'),
  status: z.enum(IMPROVEMENT_STATUSES).default('idea'),
});
export type ImprovementInput = z.input<typeof ImprovementInput>;
export const ImprovementPatch = ImprovementInput.partial();

export interface ImprovementView {
  id: string;
  title: string;
  details: string;
  area: (typeof IMPROVEMENT_AREAS)[number];
  priority: (typeof PRIORITIES)[number];
  status: (typeof IMPROVEMENT_STATUSES)[number];
  createdAt: string;
  doneAt: string | null;
}

// --- Learning -------------------------------------------------------------------------------------

export const ModuleId = z.string().regex(/^[a-z0-9-]{2,60}$/);

export interface LearningProgressView {
  moduleId: string;
  score: number;
  completedAt: string;
}

// --- Leads & B2B Sales Prospecting ----------------------------------------------------------------

export const LEAD_STATUSES = ['discovered', 'enriched', 'contacted', 'replied', 'converted', 'discarded'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadView {
  id: string;
  name: string;
  query: string;
  category: string;
  city: string;
  address: string;
  rating: number | null;
  reviewsCount: number;
  phone: string | null;
  phoneFormatted: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  hasWebsite: boolean;
  status: LeadStatus;
  suggestedDemo: string | null;
  notes: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  contactedAt: string | null;
}

// --- Deployments & CI/CD --------------------------------------------------------------------------

export type DeploymentStatus = 'queued' | 'running' | 'success' | 'failed';

export interface DeploymentRecord {
  id: string;
  repo: string;
  branch: string;
  commitHash: string | null;
  commitMessage: string | null;
  author: string | null;
  status: DeploymentStatus;
  trigger: 'webhook' | 'manual';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  log: string;
}

export interface DeploymentOverview {
  webhookUrl: string;
  secretConfigured: boolean;
  availableRepos: string[];
  recentDeployments: DeploymentRecord[];
}

// --- Cloudflare Operations ------------------------------------------------------------------------

export interface CloudflareZoneSummary {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  nameServers: string[];
  securityLevel?: string;
}

export interface CloudflareDnsItem {
  id: string;
  type: string;
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  comment?: string;
}

export interface CloudflareOverview {
  configured: boolean;
  zones: CloudflareZoneSummary[];
  activeZoneId: string | null;
  dnsRecords: CloudflareDnsItem[];
  securityLevel: string;
}

// --- VPS File Manager ----------------------------------------------------------------------------

export interface FileItem {
  name: string;
  path: string; // Relative path from root
  isDirectory: boolean;
  size: number;
  sizeHuman: string;
  modifiedAt: string;
  extension: string;
  isEditable: boolean;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  baseDir: string;
  items: FileItem[];
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  size: number;
}

// --- Env Vault & Secrets Manager -----------------------------------------------------------------

export type VaultEnvironment = 'production' | 'staging' | 'development';
export type VaultCriticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type VaultSyncStatus = 'in_sync' | 'drift_detected' | 'untracked_on_disk' | 'missing_on_disk';

export interface VaultProjectConfig {
  projectName: string;
  filePath: string;
  dockerService?: string;
  environment: VaultEnvironment;
  criticality: VaultCriticality;
  lastSyncedAt: string | null;
}

export interface SecurityIssue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  recommendation?: string;
}

export interface VaultFileAudit {
  projectName: string;
  filePath: string;
  existsOnDisk: boolean;
  permissionsOctal: string;
  isPermissionsSecure: boolean;
  isGitTracked: boolean;
  isGitIgnored: boolean;
  syncStatus: VaultSyncStatus;
  diskItemCount: number;
  vaultItemCount: number;
  issues: SecurityIssue[];
}

export interface VaultAuditSummary {
  totalVariables: number;
  totalProjects: number;
  globalRiskLevel: 'SAFE' | 'WARNING' | 'CRITICAL';
  criticalExposureCount: number;
  driftCount: number;
  insecurePermissionsCount: number;
  audits: VaultFileAudit[];
}

export interface VaultDiffItem {
  key: string;
  vaultValue: string | null;
  diskValue: string | null;
  status: 'only_in_vault' | 'only_on_disk' | 'modified' | 'identical';
}

export interface VaultDiffResult {
  projectName: string;
  filePath: string;
  vaultContent: string;
  diskContent: string;
  differences: VaultDiffItem[];
}

export interface DiscoveredEnvFile {
  path: string;
  projectName: string;
  variableCount: number;
  alreadyConfigured: boolean;
}

export interface VaultItem {
  id: string;
  key: string;
  value: string;
  project: string;
  description: string;
  isSecret: boolean;
  updatedAt: string;
}

export interface VaultOverview {
  projects: string[];
  projectConfigs: Record<string, VaultProjectConfig>;
  items: VaultItem[];
  auditSummary: VaultAuditSummary;
}

export interface KnowledgeDocMeta {
  slug: string;
  category: string;
  title: string;
  relativePath: string;
  sizeBytes: number;
  lastModified: string;
}

export interface KnowledgeDocDetail {
  slug: string;
  content: string;
  meta: KnowledgeDocMeta;
}

// --- Growth & Marketing Engine ---------------------------------------------------------------------

export const SOCIAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_POST_TYPES = ['POST', 'REEL', 'CAROUSEL', 'STORY'] as const;
export type SocialPostType = (typeof SOCIAL_POST_TYPES)[number];

export const SOCIAL_DRAFT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED'] as const;
export type SocialDraftStatus = (typeof SOCIAL_DRAFT_STATUSES)[number];

export const AD_PLATFORMS = ['META', 'GOOGLE'] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const AD_CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'NEEDS_ATTENTION'] as const;
export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUSES)[number];

export interface InstagramPostReference {
  id: string;
  caption: string;
  hashtags: string[];
  mediaUrl?: string;
  permalink?: string;
  postType?: string;
  publishedAt?: string;
}

export interface BrandIntegrations {
  metaPageAccessToken?: string;
  metaPageId?: string;
  metaInstagramAccountId?: string;
  metaAdsAccountId?: string;
  googleAdsCustomerId?: string;
  tiktokAccessToken?: string;
  tiktokAdvertiserId?: string;
  customWebhookUrl?: string;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappOwnerNumber?: string;
  telegramBotToken?: string;
  telegramOwnerChatId?: string;
  webhookVerifyToken?: string;
  [key: string]: unknown;
}

export interface BrandChatMessage {
  role: 'customer' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source?: 'instagram' | 'whatsapp' | 'telegram' | 'web';
}

export interface BrandConversationView {
  id: string;
  brandId: string;
  platform: string;
  customerHandle: string;
  customerName: string;
  status: string;
  lastMessageAt: string;
  messages: BrandChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandView {
  id: string;
  slug: string;
  name: string;
  website: string;
  toneOfVoice: string;
  styleDirectives: Record<string, unknown>;
  targetAudience: string | null;
  whatsappNumber: string | null;
  telegramChatId: string | null;
  dossierMd: string | null;
  socialStyleMd: string | null;
  instagramHandle: string | null;
  activePlatforms: SocialPlatform[];
  scrapedPosts: InstagramPostReference[];
  integrations?: BrandIntegrations;
  autoPublish?: boolean;
  autoReplyChat?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialDraftView {
  id: string;
  brandId: string;
  brandName?: string;
  brandSlug?: string;
  platform: SocialPlatform;
  postType: SocialPostType;
  caption: string;
  mediaUrls: string[];
  status: SocialDraftStatus;
  scheduledFor: string | null;
  approvalToken: string;
  feedback: string | null;
  metrics: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdCampaignView {
  id: string;
  brandId: string;
  brandName?: string;
  brandSlug?: string;
  platform: AdPlatform;
  externalCampaignId: string;
  campaignName: string;
  objective: string;
  dailyBudget: number;
  spendToDate: number;
  cpa: number;
  ctr: number;
  roas: number;
  status: AdCampaignStatus;
  safetyGuardrail: number;
  insights: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingOverview {
  brand: BrandView | null;
  allBrands: { id: string; slug: string; name: string }[];
  ads: {
    totalDailyBudget: number;
    totalSpendToDate: number;
    avgCpa: number;
    avgCtr: number;
    avgRoas: number;
    activeCampaignsCount: number;
    safetyGuardrailTotal: number;
    guardrailBreachedCount: number;
  };
  social: {
    pendingApprovalsCount: number;
    approvedScheduledCount: number;
    publishedCount: number;
    draftsCount: number;
    recentPendingDrafts: SocialDraftView[];
  };
  agents: {
    trafficAgent: {
      name: string;
      status: 'ACTIVE' | 'IDLE' | 'WARNING';
      lastAuditAt: string;
      optimizationsToday: number;
      guardrailEnforced: boolean;
      activeRules: string[];
    };
    creativeAgent: {
      name: string;
      status: 'READY' | 'GENERATING' | 'PAUSED';
      models: string[];
      lastGeneratedAt: string | null;
      brandGuidelinesLoaded: boolean;
    };
  };
}

export const GenerateDraftInput = z.object({
  brandSlug: z.string().optional(),
  brandId: z.string().optional(),
  platform: z.enum(SOCIAL_PLATFORMS).default('INSTAGRAM'),
  postType: z.enum(SOCIAL_POST_TYPES).default('POST'),
  topic: z.string().min(3, 'Topic must be at least 3 characters'),
  objective: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  scheduledFor: z.string().optional(),
});
export type GenerateDraftInput = z.infer<typeof GenerateDraftInput>;

export const BatchGenerateDraftsInput = z.object({
  brandSlug: z.string().optional(),
  brandId: z.string().optional(),
  theme: z.string().min(3, 'Theme must be at least 3 characters'),
  postCount: z.number().int().min(1).max(14).default(5),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).default(['INSTAGRAM']),
  startDate: z.string().optional(),
  objective: z.string().optional(),
  autoApprove: z.boolean().optional().default(false),
});
export type BatchGenerateDraftsInput = z.infer<typeof BatchGenerateDraftsInput>;

export interface ContentIdeaSuggestion {
  id: string;
  topic: string;
  platform: SocialPlatform;
  postType: SocialPostType;
  hook: string;
  objective: string;
  rationale: string;
}

export interface MarketingSchedulerStatus {
  enabled: boolean;
  intervalSeconds: number;
  lastCheckedAt: string | null;
  scheduledQueueCount: number;
  publishedCount: number;
  upcomingDrafts: Array<{
    id: string;
    brandName: string;
    platform: SocialPlatform;
    postType: SocialPostType;
    scheduledFor: string;
    captionPreview: string;
    status: SocialDraftStatus;
  }>;
}

export const UpdateDraftStatusInput = z.object({
  status: z.enum(SOCIAL_DRAFT_STATUSES),
  feedback: z.string().optional(),
});
export type UpdateDraftStatusInput = z.infer<typeof UpdateDraftStatusInput>;

export const DispatchApprovalInput = z.object({
  channel: z.enum(['whatsapp', 'telegram', 'webhook']).default('whatsapp'),
  target: z.string().optional(),
});
export type DispatchApprovalInput = z.infer<typeof DispatchApprovalInput>;

export const UpdateAdCampaignInput = z.object({
  status: z.enum(AD_CAMPAIGN_STATUSES).optional(),
  dailyBudget: z.number().positive().optional(),
  safetyGuardrail: z.number().positive().optional(),
});
export type UpdateAdCampaignInput = z.infer<typeof UpdateAdCampaignInput>;

export const CreateAdCampaignInput = z.object({
  brandSlug: z.string().optional(),
  brandId: z.string().optional(),
  platform: z.enum(AD_PLATFORMS),
  campaignName: z.string().min(3, 'Campaign name must be at least 3 characters'),
  objective: z.string().min(2, 'Objective must be at least 2 characters'),
  dailyBudget: z.number().positive('Daily budget must be greater than 0'),
  safetyGuardrail: z.number().positive('Safety guardrail must be greater than 0'),
});
export type CreateAdCampaignInput = z.infer<typeof CreateAdCampaignInput>;

export const SyncInstagramInput = z.object({
  handle: z.string().min(1).optional(),
});
export type SyncInstagramInput = z.infer<typeof SyncInstagramInput>;

export const AnalyzeSocialStyleInput = z.object({
  handle: z.string().optional(),
  postUrls: z.array(z.string()).optional(),
  sampleCaptions: z.string().optional(),
});
export type AnalyzeSocialStyleInput = z.infer<typeof AnalyzeSocialStyleInput>;

export const AddInstagramPostInput = z.object({
  url: z.string().min(3, 'URL or shortcode is required'),
  caption: z.string().optional(),
});
export type AddInstagramPostInput = z.infer<typeof AddInstagramPostInput>;

export const UpdateDraftInput = z.object({
  caption: z.string().optional(),
  scheduledFor: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()).optional(),
  status: z.enum(SOCIAL_DRAFT_STATUSES).optional(),
  feedback: z.string().nullable().optional(),
});
export type UpdateDraftInput = z.infer<typeof UpdateDraftInput>;

export const UpdateBrandPlatformsInput = z.object({
  activePlatforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1, 'At least one social platform must remain active'),
});
export type UpdateBrandPlatformsInput = z.infer<typeof UpdateBrandPlatformsInput>;

export const UpdateBrandIntegrationsInput = z.object({
  integrations: z.record(z.string(), z.unknown()).optional(),
  autoPublish: z.boolean().optional(),
  autoReplyChat: z.boolean().optional(),
  instagramHandle: z.string().optional(),
});
export type UpdateBrandIntegrationsInput = z.infer<typeof UpdateBrandIntegrationsInput>;

export const TestChatMessageInput = z.object({
  message: z.string().min(1, 'Message is required'),
  customerName: z.string().optional(),
  conversationId: z.string().optional(),
});
export type TestChatMessageInput = z.infer<typeof TestChatMessageInput>;

// --- Argentine Promotions Engine -------------------------------------------------------------------

export const PROMO_CATEGORIES = [
  'supermarkets',
  'fuel',
  'gastronomy',
  'pharmacy',
  'clothing',
  'technology',
  'entertainment',
  'travel',
  'services',
  'other',
] as const;
export type ArgentinePromoCategory = (typeof PROMO_CATEGORIES)[number];

export const PAYMENT_METHODS = ['qr', 'credit', 'debit', 'wallet_balance', 'any'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PromoAudience = 'general' | 'seniors_60' | 'teens' | 'students';
export type PromoTier = 'none' | 'level_2' | 'level_3' | 'vip_black';

export interface ArgentinePromo {
  id: string;
  title: string;
  entity: string; // e.g. "Cuenta DNI", "MODO", "Mercado Pago", "Banco Galicia", "Santander", "YPF App"
  entityType: 'bank' | 'wallet' | 'store' | 'loyalty';
  category: ArgentinePromoCategory;
  discount: string; // e.g. "30%", "20%", "40%"
  discountPercent: number; // numeric e.g. 30
  cashbackCap: string | null; // e.g. "$6.000 por semana", "$12.000 por mes"
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat. If empty, all days.
  applicableBusinesses: string[]; // e.g. ["Coto", "Carrefour", "Jumbo"]
  paymentMethod: PaymentMethod;
  validUntil: string | null;
  description: string;
  termsUrl?: string;
  isTodayActive: boolean;
  highlight?: string;
  sourceUrl?: string;
  scrapedAt: string;
  httpStatus?: number;
  httpResponseTimeMs?: number;
  httpVerifiedAt?: string;
  isVerifiedLive?: boolean;
  targetAudience?: PromoAudience;
  tierRequirement?: PromoTier;
}

export interface PromotionsOverview {
  todayDayName: string; // e.g. "Domingo", "Lunes"
  todayDayIndex: number; // 0 - 6
  todayDateFormatted: string; // e.g. "8 de Noviembre de 2026"
  totalPromos: number;
  activeTodayCount: number;
  lastScrapedAt: string | null;
  promotions: ArgentinePromo[];
  topEntities: { name: string; count: number }[];
  categories: { id: ArgentinePromoCategory; label: string; count: number }[];
}

export interface SavingsCalculationResult {
  promoId: string;
  promoTitle: string;
  entity: string;
  category: ArgentinePromoCategory;
  discountPercent: number;
  cashbackCap: string | null;
  paymentMethod: PaymentMethod;
  inputAmount: number;
  calculatedSavings: number;
  effectiveDiscountRate: number;
  finalPrice: number;
  recommendation: string;
}

export const CalculateSavingsInput = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  category: z.enum(PROMO_CATEGORIES).optional(),
  dayIndex: z.number().min(0).max(6).optional(),
});
export type CalculateSavingsInput = z.infer<typeof CalculateSavingsInput>;

export const ScrapePromosInput = z.object({
  forceFresh: z.boolean().default(false),
  category: z.enum(PROMO_CATEGORIES).optional(),
});
export type ScrapePromosInput = z.infer<typeof ScrapePromosInput>;

export type PriceAnomalyType = 'PRICE_BUG' | 'MASSIVE_CLEARANCE' | 'FLASH_DROP';

export interface PriceGlitchItem {
  id: string;
  title: string;
  retailer: string;
  category: ArgentinePromoCategory;
  originalPrice: number;
  glitchPrice: number;
  discountPercent: number;
  currency: 'ARS' | 'USD';
  anomalyType: PriceAnomalyType;
  sourceUrl: string;
  sourceChannel: string;
  detectedAt: string;
  verifiedActive: boolean;
  httpStatus?: number;
  httpVerifiedAt?: string;
  httpResponseTimeMs?: number;
  notes?: string;
  targetAudience?: PromoAudience;
  tierRequirement?: PromoTier;
}

export interface PriceGlitchOverview {
  totalGlitches: number;
  highestDiscount: number;
  glitches: PriceGlitchItem[];
  lastCheckedAt: string;
}

// --- VPS Security Audit & Hardening -------------------------------------------------------------

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityCheckStatus = 'pass' | 'warn' | 'fail';

export interface SecurityCheckItem {
  id: string;
  category: 'ssh' | 'firewall' | 'network' | 'docker' | 'system' | 'auth';
  title: string;
  status: SecurityCheckStatus;
  severity: SecuritySeverity;
  summary: string;
  details: string;
  remediation?: string;
}

export interface VpsSecurityAudit {
  score: number;
  evaluatedAt: string;
  hostname: string;
  osInfo: {
    distro: string;
    kernel: string;
    arch: string;
  };
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
  };
  checks: SecurityCheckItem[];
}


export interface RepoGraphNode {
  id: string;
  label: string;
  category: 'app' | 'infrastructure' | 'module' | 'service' | 'database' | 'external';
  tech: string;
  description: string;
  filePath?: string;
  inbound: string[];
  outbound: string[];
  tags: string[];
}

export interface RepoGraphEdge {
  id: string;
  source: string;
  target: string;
  protocol: 'HTTP/REST' | 'MCP/JSON-RPC' | 'Redis/BullMQ' | 'PostgreSQL/TCP' | 'Docker/Mount' | 'Internal/Import';
  label: string;
  description: string;
}

export interface RepoAnalysisResult {
  analyzedAt: string;
  nextScheduledAnalysis: string;
  repoName: string;
  version: string;
  summary: {
    totalNodes: number;
    totalEdges: number;
    totalApps: number;
    totalServices: number;
    totalTechnologies: number;
  };
  technologies: Array<{
    name: string;
    category: string;
    version?: string;
    usedIn: string[];
  }>;
  nodes: RepoGraphNode[];
  edges: RepoGraphEdge[];
  communicationFlows: Array<{
    title: string;
    steps: string[];
  }>;
}

export interface ProjectFunctionItem {
  name: string;
  file: string;
  line: number;
  module: string;
  category: string;
  exported: boolean;
  async: boolean;
  params: string;
  kind: 'function' | 'arrow' | 'function-expr' | 'method' | 'route-handler';
  isTest?: boolean;
}

export interface FunctionsCatalogResult {
  analyzedAt: string;
  total: number;
  summary: {
    byModule: Record<string, number>;
    byCategory: Record<string, number>;
  };
  functions: ProjectFunctionItem[];
}

// --- Observability Telemetry ------------------------------------------------------------------------

export interface LlmTraceView {
  id: string;
  provider: string;
  model: string;
  caller: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  status: 'ok' | 'error' | 'fallback';
  errorMessage: string | null;
  promptPreview: string | null;
  responsePreview: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LlmTelemetrySummary {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  errorRatePercent: number;
  byModel: Array<{ model: string; calls: number; tokens: number; costUsd: number }>;
}

export interface ApiMetricsView {
  totalRequests: number;
  requestsPerMinute: number;
  statusCodes: {
    status2xx: number;
    status4xx: number;
    status5xx: number;
  };
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  topSlowRoutes: Array<{
    route: string;
    method: string;
    calls: number;
    avgDurationMs: number;
    maxDurationMs: number;
  }>;
}

export interface QueueJobView {
  id: string;
  name: string;
  data: unknown;
  failedReason?: string;
  timestamp: number;
  attemptsMade: number;
}

export interface QueueMetricsView {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  failedJobs?: QueueJobView[];
}

export interface ObservabilityOverview {
  llm: LlmTelemetrySummary;
  api: ApiMetricsView;
  queues: QueueMetricsView[];
  recentTraces: LlmTraceView[];
}

// --- MCP Hub & Observability ------------------------------------------------------------------------

export type McpTransportType = 'http-jsonrpc' | 'sse' | 'stdio';

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
      items?: unknown;
    }>;
    required?: string[];
  };
}

export interface McpResourceSchema {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpServerRecord {
  id: string;
  name: string;
  description: string;
  type: McpTransportType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled: boolean;
  isBuiltIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type McpServerStatus = 'online' | 'degraded' | 'offline' | 'checking';

export interface McpServerLiveView extends McpServerRecord {
  status: McpServerStatus;
  latencyMs: number | null;
  protocolVersion?: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  tools: McpToolSchema[];
  resources: McpResourceSchema[];
  lastCheckedAt: string | null;
  errorMessage?: string | null;
}

export interface McpToolCallLog {
  id: string;
  serverId: string;
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  responsePreview: string;
  isError: boolean;
  latencyMs: number;
  calledAt: string;
}

export interface McpTelemetryOverview {
  totalServers: number;
  activeServers: number;
  totalTools: number;
  totalCalls: number;
  errorRatePercent: number;
  avgLatencyMs: number;
  recentCalls: McpToolCallLog[];
}

