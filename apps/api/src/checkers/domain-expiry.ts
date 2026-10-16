import { z } from 'zod';
import type { CheckOutcome } from '@cc/shared';
import { USER_AGENT, daysBetween, defineChecker, hostOf, statusByDaysLeft } from './define.js';

// RDAP is the structured (JSON) successor of WHOIS. rdap.org forwards to the right registry.
const Rdap = z.object({
  events: z.array(z.object({ eventAction: z.string(), eventDate: z.string() })).default([]),
});

export function findExpiration(json: unknown): Date | null {
  const parsed = Rdap.safeParse(json);
  const event = parsed.success ? parsed.data.events.find((e) => e.eventAction === 'expiration') : undefined;
  const date = event ? new Date(event.eventDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

const Settings = z.object({
  warnDays: z.number().int().default(30),
  failDays: z.number().int().default(7),
  timeoutMs: z.number().int().positive().default(15_000),
  rdapBase: z.url().default('https://rdap.org/domain/'),
});

export function classifyExpiry(expires: Date, now: Date, s: z.output<typeof Settings>): CheckOutcome {
  const daysLeft = daysBetween(now, expires);
  const day = expires.toISOString().slice(0, 10);
  if (daysLeft < 0) return { status: 'fail', message: `Domain expired on ${day}`, metrics: { daysLeft } };
  return { status: statusByDaysLeft(daysLeft, s), message: `Renew by ${day} (${daysLeft} days left)`, metrics: { daysLeft } };
}

export const domainExpiry = defineChecker({
  id: 'domain-expiry',
  description: 'Reads the registration expiry date from RDAP.',
  appliesTo: ['domain'],
  defaultIntervalSeconds: 86_400,
  settings: Settings,
  async run(target, s, ctx) {
    const res = await fetch(new URL(hostOf(target), s.rdapBase), {
      headers: { accept: 'application/rdap+json, application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(s.timeoutMs)]),
    });
    if (!res.ok) throw new Error(`RDAP answered HTTP ${res.status}`);
    const expires = findExpiration(await res.json());
    if (!expires) throw new Error('RDAP response has no expiration date');
    return classifyExpiry(expires, ctx.now, s);
  },
});
