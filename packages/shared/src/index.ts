import { z } from 'zod';

export const TARGET_TYPES = ['domain', 'website', 'vercel_project', 'github_repo', 'server', 'service'] as const;
export const TargetType = z.enum(TARGET_TYPES);
export type TargetType = z.infer<typeof TargetType>;

// What each target type stores in its `config` column.
export const DomainConfig = z.object({ domain: z.string().min(3) });
export const UrlConfig = z.object({ url: z.url() });

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
  sites: { id: string; name: string; url: string; status: CheckStatus | null }[];
}

export interface ResultPoint {
  checkedAt: string;
  status: CheckStatus;
  durationMs: number;
  message: string;
  metrics: Record<string, number>;
}
