import tls from 'node:tls';
import { z } from 'zod';
import type { CheckOutcome } from '@cc/shared';
import { daysBetween, defineChecker, hostOf, statusByDaysLeft } from './define.js';

export interface CertificateInfo {
  validTo: Date;
  trusted: boolean;
  trustError?: string;
  issuer?: string;
}

// Reads the certificate the server presents, without trusting it blindly: trust is reported, not required.
export function readCertificate(host: string, signal: AbortSignal, port = 443): Promise<CertificateInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    const onAbort = () => socket.destroy(new Error('timed out'));
    signal.addEventListener('abort', onAbort, { once: true });
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const org = cert.issuer?.O;
      resolve({
        validTo: new Date(cert.valid_to),
        trusted: socket.authorized,
        trustError: socket.authorizationError ? String(socket.authorizationError) : undefined,
        issuer: Array.isArray(org) ? org[0] : org,
      });
      socket.end();
    });
    socket.once('error', reject);
    socket.once('close', () => signal.removeEventListener('abort', onAbort));
  });
}

const Settings = z.object({
  // Vercel/Cloudflare/Caddy renew ~30 days before expiry, so under 21 days means renewal is failing.
  warnDays: z.number().int().default(21),
  failDays: z.number().int().default(7),
  timeoutMs: z.number().int().positive().default(10_000),
});

export function classifyCertificate(cert: CertificateInfo, now: Date, s: z.output<typeof Settings>): CheckOutcome {
  const daysLeft = daysBetween(now, cert.validTo);
  const metrics = { daysLeft };
  if (!cert.trusted) return { status: 'fail', message: `Certificate not trusted: ${cert.trustError ?? 'unknown reason'}`, metrics };
  if (daysLeft < 0) return { status: 'fail', message: `Certificate expired ${-daysLeft} days ago`, metrics };
  const by = cert.issuer ? ` (${cert.issuer})` : '';
  return { status: statusByDaysLeft(daysLeft, s), message: `Certificate expires in ${daysLeft} days${by}`, metrics };
}

export const sslExpiry = defineChecker({
  id: 'ssl-expiry',
  description: 'Checks that the HTTPS certificate is trusted and not about to expire.',
  appliesTo: ['website', 'service', 'domain'],
  defaultIntervalSeconds: 86_400,
  settings: Settings,
  async run(target, s, ctx) {
    // If we cannot connect we do not know the certificate state: that is "error", and uptime reports the outage.
    const cert = await readCertificate(hostOf(target), AbortSignal.any([ctx.signal, AbortSignal.timeout(s.timeoutMs)]));
    return classifyCertificate(cert, ctx.now, s);
  },
});
