import { z } from 'zod';

export const TARGET_TYPES = ['domain', 'website', 'vercel_project', 'github_repo', 'server', 'service'] as const;
export const TargetType = z.enum(TARGET_TYPES);
export type TargetType = z.infer<typeof TargetType>;

// ok: all good · warn: works but needs attention · fail: broken · error: the check itself could not run
export const CHECK_STATUSES = ['ok', 'warn', 'fail', 'error'] as const;
export const CheckStatus = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const CheckOutcome = z.object({
  status: CheckStatus,
  message: z.string().max(500),
  metrics: z.record(z.string(), z.number()).default({}),
});
export type CheckOutcome = z.infer<typeof CheckOutcome>;

// "error" ranks below "fail": not knowing is less bad than knowing it is broken.
const SEVERITY: Record<CheckStatus, number> = { ok: 0, warn: 1, error: 2, fail: 3 };

export function worstStatus(statuses: readonly CheckStatus[]): CheckStatus {
  return statuses.reduce<CheckStatus>((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), 'ok');
}
