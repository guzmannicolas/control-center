import { z } from 'zod';

export const TARGET_TYPES = ['domain', 'website', 'vercel_project', 'github_repo', 'server', 'service', 'database'] as const;
export const TargetType = z.enum(TARGET_TYPES);
export type TargetType = z.infer<typeof TargetType>;

// What each target type stores in its `config` column.
export const DomainConfig = z.object({ domain: z.string().min(3) });
export const UrlConfig = z.object({ url: z.url() });
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

export interface Overview {
  generatedAt: string;
  counts: Record<CheckStatus | 'unknown', number>;
  targets: TargetView[]; // most serious first
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
  instagramHandle: string | null;
  activePlatforms: SocialPlatform[];
  scrapedPosts: InstagramPostReference[];
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

// --- Argentine Promotions Engine -------------------------------------------------------------------

export const PROMO_CATEGORIES = [
  'supermarkets',
  'fuel',
  'gastronomy',
  'pharmacy',
  'clothing',
  'technology',
  'entertainment',
  'services',
  'other',
] as const;
export type ArgentinePromoCategory = (typeof PROMO_CATEGORIES)[number];

export const PAYMENT_METHODS = ['qr', 'credit', 'debit', 'wallet_balance', 'any'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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

export const ScrapePromosInput = z.object({
  forceFresh: z.boolean().default(false),
  category: z.enum(PROMO_CATEGORIES).optional(),
});
export type ScrapePromosInput = z.infer<typeof ScrapePromosInput>;





