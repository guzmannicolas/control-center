import { z } from 'zod';
import type { CheckOutcomeInput, DomainDetails } from '@cc/shared';
import { USER_AGENT, daysBetween, defineChecker, hostOf, statusByDaysLeft } from './define.js';

// RDAP is the structured (JSON) successor of WHOIS. rdap.org forwards to the right registry.
const Rdap = z.object({
  events: z.array(z.object({ eventAction: z.string(), eventDate: z.string() })).default([]),
  status: z.array(z.string()).default([]),
  nameservers: z.array(z.object({ ldhName: z.string() })).default([]),
  secureDNS: z.object({ delegationSigned: z.boolean().optional() }).optional(),
  entities: z.array(z.object({ roles: z.array(z.string()).default([]), vcardArray: z.unknown().optional() })).default([]),
});

const validDate = (iso: string | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

// vCard in JSON: ["vcard", [["fn", {}, "text", "Cloudflare, Inc."], …]]
function vcardName(vcard: unknown): string | null {
  const props = Array.isArray(vcard) && Array.isArray(vcard[1]) ? (vcard[1] as unknown[]) : [];
  const fn = props.find((p): p is unknown[] => Array.isArray(p) && p[0] === 'fn');
  return typeof fn?.[3] === 'string' ? fn[3] : null;
}

function dnsProvider(nameservers: string[]): string | null {
  if (!nameservers.length) return null;
  if (nameservers.every((n) => n.endsWith('.ns.cloudflare.com'))) return 'Cloudflare';
  if (nameservers.every((n) => n.includes('vercel-dns'))) return 'Vercel';
  return nameservers[0]!.split('.').slice(-2).join('.');
}

export function parseRdap(json: unknown): { expires: Date | null; details: DomainDetails } | null {
  const parsed = Rdap.safeParse(json);
  if (!parsed.success) return null;
  const r = parsed.data;
  const event = (action: string) => validDate(r.events.find((e) => e.eventAction === action)?.eventDate);
  const expires = event('expiration');
  const nameservers = r.nameservers.map((n) => n.ldhName.toLowerCase());
  const registrar = r.entities.find((e) => e.roles.includes('registrar'));
  return {
    expires,
    details: {
      registrar: registrar ? vcardName(registrar.vcardArray) : null,
      registeredOn: event('registration')?.toISOString() ?? null,
      expiresOn: expires?.toISOString() ?? null,
      nameservers,
      dnsProvider: dnsProvider(nameservers),
      dnssec: r.secureDNS?.delegationSigned ?? null,
      // Locked = cannot be moved to another registrar without unlocking first (protects against hijacking).
      transferLocked: r.status.some((s) => s.toLowerCase().includes('transfer prohibited')),
    },
  };
}

export const findExpiration = (json: unknown) => parseRdap(json)?.expires ?? null;

const Settings = z.object({
  warnDays: z.number().int().default(30),
  failDays: z.number().int().default(7),
  timeoutMs: z.number().int().positive().default(15_000),
  rdapBase: z.url().default('https://rdap.org/domain/'),
});

export function classifyExpiry(expires: Date, now: Date, s: z.output<typeof Settings>, details: DomainDetails | Record<string, never> = {}): CheckOutcomeInput {
  const daysLeft = daysBetween(now, expires);
  const day = expires.toISOString().slice(0, 10);
  const base = { metrics: { daysLeft }, details };
  if (daysLeft < 0) return { status: 'fail', message: `Domain expired on ${day}`, ...base };
  return { status: statusByDaysLeft(daysLeft, s), message: `Renew by ${day} (${daysLeft} days left)`, ...base };
}

export const domainExpiry = defineChecker({
  id: 'domain-expiry',
  description: 'Reads the registration record from RDAP: expiry, registrar, DNS, DNSSEC and transfer lock.',
  appliesTo: ['domain'],
  defaultIntervalSeconds: 86_400,
  settings: Settings,
  async run(target, s, ctx) {
    const res = await fetch(new URL(hostOf(target), s.rdapBase), {
      headers: { accept: 'application/rdap+json, application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(s.timeoutMs)]),
    });
    if (!res.ok) throw new Error(`RDAP answered HTTP ${res.status}`);
    const parsed = parseRdap(await res.json());
    if (!parsed?.expires) throw new Error('RDAP response has no expiration date');
    return classifyExpiry(parsed.expires, ctx.now, s, parsed.details);
  },
});
