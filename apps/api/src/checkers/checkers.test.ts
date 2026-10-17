import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckTarget } from './define.js';
import { classifyExpiry, findExpiration, parseRdap } from './domain-expiry.js';
import { httpUptime } from './http-uptime.js';
import { classifyCertificate } from './ssl-expiry.js';

const now = new Date('2026-10-16T12:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('http-uptime (against a local server)', () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/broken') return res.writeHead(500).end();
      if (req.url === '/slow') return setTimeout(() => res.writeHead(200).end(), 120);
      if (req.url === '/login-wall') return res.writeHead(302, { location: 'https://team.cloudflareaccess.com/login' }).end();
      res.writeHead(200).end('hi');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const target = (path: string): CheckTarget => ({ id: 't', name: 't', type: 'website', config: { url: base + path } });
  const run = (path: string, settings: Record<string, unknown> = {}) =>
    httpUptime.run(target(path), httpUptime.settings.parse(settings), { signal: new AbortController().signal, now });

  it('is ok for a fast 200', async () => {
    const r = await run('/');
    expect(r.status).toBe('ok');
    expect(r.metrics?.statusCode).toBe(200);
  });

  it('fails on a 500', async () => {
    expect((await run('/broken')).status).toBe('fail');
  });

  it('warns when slower than slowMs', async () => {
    expect((await run('/slow', { slowMs: 50 })).status).toBe('warn');
  });

  it('fails when it times out', async () => {
    const r = await run('/slow', { timeoutMs: 30 });
    expect(r).toMatchObject({ status: 'fail', message: 'No response: timed out' });
  });

  it('accepts a redirect to the expected login wall', async () => {
    const settings = { followRedirects: false, expectStatus: [302], expectRedirectTo: 'cloudflareaccess.com' };
    expect((await run('/login-wall', settings)).status).toBe('ok');
  });

  it('fails when a protected page answers 200 (protection is gone)', async () => {
    const settings = { followRedirects: false, expectStatus: [302], expectRedirectTo: 'cloudflareaccess.com' };
    expect((await run('/', settings)).message).toBe('Unexpected HTTP 200');
  });

  it('fails when nothing listens', async () => {
    const tmp = createServer();
    await new Promise<void>((r) => tmp.listen(0, '127.0.0.1', r));
    const { port } = tmp.address() as AddressInfo;
    await new Promise<void>((r) => tmp.close(() => r()));
    const closed: CheckTarget = { id: 't', name: 't', type: 'website', config: { url: `http://127.0.0.1:${port}/` } };
    const r = await httpUptime.run(closed, httpUptime.settings.parse({}), { signal: new AbortController().signal, now });
    expect(r).toMatchObject({ status: 'fail', message: 'No response: ECONNREFUSED' });
  });
});

describe('ssl-expiry classification', () => {
  const s = { warnDays: 21, failDays: 7, timeoutMs: 1000 };
  it.each([
    [60, 'ok'],
    [20, 'warn'],
    [3, 'fail'],
  ] as const)('%i days left is %s', (days, status) => {
    expect(classifyCertificate({ validTo: inDays(days), trusted: true }, now, s).status).toBe(status);
  });

  it('fails an untrusted certificate even with time left', () => {
    const r = classifyCertificate({ validTo: inDays(80), trusted: false, trustError: 'SELF_SIGNED' }, now, s);
    expect(r).toMatchObject({ status: 'fail', message: 'Certificate not trusted: SELF_SIGNED' });
  });

  it('says how long ago it expired', () => {
    expect(classifyCertificate({ validTo: inDays(-2), trusted: true }, now, s).message).toBe('Certificate expired 2 days ago');
  });
});

describe('domain-expiry', () => {
  it('finds the expiration event in an RDAP response', () => {
    const rdap = { events: [{ eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-04-24T02:01:18Z' }] };
    expect(findExpiration(rdap)?.toISOString()).toBe('2027-04-24T02:01:18.000Z');
  });

  it('returns null when there is no usable date', () => {
    expect(findExpiration({ events: [{ eventAction: 'expiration', eventDate: 'soon' }] })).toBeNull();
    expect(findExpiration({ nothing: true })).toBeNull();
  });

  it('warns 30 days ahead and gives the date to renew by', () => {
    const r = classifyExpiry(inDays(20), now, { warnDays: 30, failDays: 7, timeoutMs: 1, rdapBase: 'https://x/' });
    expect(r).toEqual({ status: 'warn', message: 'Renew by 2026-11-05 (20 days left)', metrics: { daysLeft: 20 }, details: {} });
  });

  it('reads registrar, DNS, DNSSEC and transfer lock from a real-shaped RDAP record', () => {
    const rdap = {
      status: ['client transfer prohibited'],
      nameservers: [{ ldhName: 'ASPEN.NS.CLOUDFLARE.COM' }, { ldhName: 'COLIN.NS.CLOUDFLARE.COM' }],
      secureDNS: { delegationSigned: false },
      events: [
        { eventAction: 'registration', eventDate: '2025-04-24T02:01:18Z' },
        { eventAction: 'expiration', eventDate: '2027-04-24T02:01:18Z' },
      ],
      entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Cloudflare, Inc.']]] }],
    };
    expect(parseRdap(rdap)?.details).toEqual({
      registrar: 'Cloudflare, Inc.',
      registeredOn: '2025-04-24T02:01:18.000Z',
      expiresOn: '2027-04-24T02:01:18.000Z',
      nameservers: ['aspen.ns.cloudflare.com', 'colin.ns.cloudflare.com'],
      dnsProvider: 'Cloudflare',
      dnssec: false,
      transferLocked: true,
    });
  });

  it('copes with a record that has no registrar, name servers or lock', () => {
    const d = parseRdap({ events: [{ eventAction: 'expiration', eventDate: '2027-01-01T00:00:00Z' }] })?.details;
    expect(d).toMatchObject({ registrar: null, nameservers: [], dnsProvider: null, dnssec: null, transferLocked: false });
  });
});
