import type { z } from 'zod';
import { DomainConfig, UrlConfig, type CheckOutcomeInput, type CheckStatus, type TargetType } from '@cc/shared';

export interface CheckTarget {
  id: string;
  name: string;
  type: TargetType;
  config: unknown;
}

export interface CheckContext {
  signal: AbortSignal; // aborted when the runner's deadline passes
  now: Date;
}

// The contract every checker follows. The runner, scheduler and dashboard only know this shape.
export interface Checker<S extends z.ZodType = z.ZodType> {
  id: string;
  description: string;
  appliesTo: readonly TargetType[];
  settings: S;
  defaultIntervalSeconds: number;
  run(target: CheckTarget, settings: z.output<S>, ctx: CheckContext): Promise<CheckOutcomeInput>;
}

export const defineChecker = <S extends z.ZodType>(checker: Checker<S>): Checker<S> => checker;

export const USER_AGENT = 'control-center/1.0 (+https://github.com/guzmannicolas/control-center)';

export const urlOf = (target: CheckTarget) => new URL(UrlConfig.parse(target.config).url);

export const hostOf = (target: CheckTarget) =>
  target.type === 'domain' ? DomainConfig.parse(target.config).domain : urlOf(target).hostname;

// Connection URLs for watched databases live in the environment, under MONITOR_* names only.
export function monitorUrl(envName: string): string {
  if (!/^MONITOR_[A-Z0-9_]+$/.test(envName)) throw new Error(`${envName} is not a MONITOR_ variable`);
  const value = process.env[envName];
  if (!value) throw new Error(`${envName} is not set on the server`);
  return value;
}

export const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / 86_400_000);

export function statusByDaysLeft(daysLeft: number, s: { warnDays: number; failDays: number }): CheckStatus {
  if (daysLeft < s.failDays) return 'fail';
  if (daysLeft < s.warnDays) return 'warn';
  return 'ok';
}

// The useful part ("ECONNREFUSED", "ENOTFOUND") is a code: on the error itself (pg, net) or in error.cause (fetch).
export function errorReason(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  if (err.name === 'TimeoutError') return 'timed out';
  const own = (err as { code?: unknown }).code;
  if (typeof own === 'string' && /^E[A-Z]+$/.test(own)) return own;
  const cause = err.cause as { code?: string; message?: string } | undefined;
  return cause?.code ?? cause?.message ?? err.message;
}
