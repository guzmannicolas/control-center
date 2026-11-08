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


