// Integration test: the dashboard's read endpoints over HTTP against a real Postgres (TEST_DATABASE_URL).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { createPrisma } from '../infra.js';

const url = process.env.TEST_DATABASE_URL;
const ORIGIN = 'https://dash.test';

describe.skipIf(!url)('GET /api/domains', () => {
  const prisma = createPrisma(url ?? '');
  const up = async () => 'ok';
  const app = buildApp({ prisma, probes: { database: up, redis: up }, dashboardOrigin: ORIGIN, cookieSecure: true });
  let cookies: Record<string, string>;

  const domain = async (name: string, daysLeft: number, details: object) => {
    const t = await prisma.target.create({ data: { name, type: 'domain', config: { domain: name } } });
    const m = await prisma.monitor.create({ data: { targetId: t.id, checker: 'domain-expiry', intervalSeconds: 86_400, lastStatus: 'ok', lastCheckedAt: new Date() } });
    await prisma.result.create({ data: { monitorId: m.id, status: 'ok', durationMs: 5, message: `${daysLeft} days`, metrics: { daysLeft }, details } });
  };
  const site = async (name: string, siteUrl: string, status: 'ok' | 'fail') => {
    const t = await prisma.target.create({ data: { name, type: 'website', config: { url: siteUrl } } });
    await prisma.monitor.create({ data: { targetId: t.id, checker: 'http-uptime', intervalSeconds: 300, lastStatus: status } });
  };

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE targets, users CASCADE');
    await prisma.user.create({ data: { email: 'me@example.com', passwordHash: await hashPassword('a long enough password') } });
    const login = await app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: ORIGIN, 'cf-connecting-ip': '192.0.2.50' },
      payload: { email: 'me@example.com', password: 'a long enough password' },
    });
    cookies = { cc_session: login.cookies.find((c) => c.name === 'cc_session')!.value };
  });
  afterAll(() => prisma.$disconnect());

  it('lists domains soonest renewal first, with their facts and the sites on them', async () => {
    const facts = { registrar: 'Cloudflare, Inc.', registeredOn: null, expiresOn: '2027-04-24T00:00:00.000Z', nameservers: [], dnsProvider: 'Cloudflare', dnssec: false, transferLocked: true };
    await domain('later.com', 300, facts);
    await domain('sooner.com', 40, facts);
    await site('Main site', 'https://sooner.com', 'ok');
    await site('Panel', 'https://panel.sooner.com/health', 'fail');
    await site('Look-alike', 'https://notsooner.com', 'ok');

    const res = await app.inject({ url: '/api/domains', cookies });
    expect(res.statusCode).toBe(200);
    const [first, second] = res.json();
    expect(first).toMatchObject({ name: 'sooner.com', daysLeft: 40, details: { registrar: 'Cloudflare, Inc.', transferLocked: true } });
    expect(first.sites.map((s: { name: string; status: string }) => `${s.name}:${s.status}`)).toEqual(['Main site:ok', 'Panel:fail']);
    expect(second).toMatchObject({ name: 'later.com', sites: [] });
  });

  it('is only for logged-in users', async () => {
    expect((await app.inject('/api/domains')).statusCode).toBe(401);
  });
});
