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

describe.skipIf(!url)('GET /api/databases', () => {
  const prisma = createPrisma(url ?? '');
  const up = async () => 'ok';
  const app = buildApp({ prisma, probes: { database: up, redis: up }, dashboardOrigin: ORIGIN, cookieSecure: true });
  afterAll(() => prisma.$disconnect());

  it('returns each database with its health and backup checks, and no connection secrets', async () => {
    await prisma.$executeRawUnsafe('TRUNCATE targets, users CASCADE');
    await prisma.user.create({ data: { email: 'me@example.com', passwordHash: await hashPassword('a long enough password') } });
    const login = await app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: ORIGIN, 'cf-connecting-ip': '192.0.2.51' },
      payload: { email: 'me@example.com', password: 'a long enough password' },
    });
    const cookies = { cc_session: login.cookies.find((c) => c.name === 'cc_session')!.value };

    const t = await prisma.target.create({ data: { name: 'Main DB', type: 'database', config: { engine: 'postgres', connectionEnv: 'MONITOR_MAIN', purpose: 'Everything' } } });
    const health = await prisma.monitor.create({ data: { targetId: t.id, checker: 'postgres-health', intervalSeconds: 300, lastStatus: 'ok' } });
    await prisma.result.create({ data: { monitorId: health.id, status: 'ok', durationMs: 4, message: 'PostgreSQL 16.4', metrics: { sizeBytes: 1000 }, details: { version: '16.4' } } });
    await prisma.monitor.create({ data: { targetId: t.id, checker: 'backup-age', intervalSeconds: 3600, settings: { logPath: '/x' }, lastStatus: 'warn' } });
    await prisma.target.create({ data: { name: 'Cache', type: 'database', config: { engine: 'redis', connectionEnv: 'MONITOR_CACHE' } } });

    const res = await app.inject({ url: '/api/databases', cookies });
    expect(res.statusCode).toBe(200);
    const [main, cache] = res.json(); // the database with a warning comes first
    expect(main).toMatchObject({ name: 'Main DB', engine: 'postgres', purpose: 'Everything', status: 'warn',
      health: { status: 'ok', metrics: { sizeBytes: 1000 }, details: { version: '16.4' } }, backup: { status: 'warn' } });
    expect(cache).toMatchObject({ name: 'Cache', engine: 'redis', status: null, health: null, backup: null });
    expect(res.body).not.toContain('MONITOR_');
  });
});

describe.skipIf(!url)('improvements and learning progress', () => {
  const prisma = createPrisma(url ?? '');
  const up = async () => 'ok';
  const app = buildApp({ prisma, probes: { database: up, redis: up }, dashboardOrigin: ORIGIN, cookieSecure: true });
  afterAll(() => prisma.$disconnect());

  const loginAs = async (email: string, ip: string) => {
    await prisma.user.create({ data: { email, passwordHash: await hashPassword('a long enough password') } });
    const res = await app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: ORIGIN, 'cf-connecting-ip': ip },
      payload: { email, password: 'a long enough password' },
    });
    return { cc_session: res.cookies.find((c) => c.name === 'cc_session')!.value };
  };
  const send = (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, cookies: Record<string, string>, payload?: object) =>
    app.inject({ method, url: path, cookies, headers: { origin: ORIGIN }, ...(payload ? { payload } : {}) });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users, improvements CASCADE');
  });

  it('creates, lists in working order, updates, completes, reopens and deletes improvements', async () => {
    const me = await loginAs('me@example.com', '192.0.2.60');
    expect((await send('POST', '/api/improvements', me, { title: 'x', area: 'security' })).statusCode).toBe(400);

    const low = (await send('POST', '/api/improvements', me, { title: 'Turn on DNSSEC', area: 'domains', priority: 'low' })).json();
    const high = (await send('POST', '/api/improvements', me, { title: 'Back up the database', area: 'backups', priority: 'high' })).json();
    await send('PATCH', `/api/improvements/${low.id}`, me, { status: 'in_progress' });
    const list = (await app.inject({ url: '/api/improvements', cookies: me })).json();
    expect(list.map((i: { title: string }) => i.title)).toEqual(['Turn on DNSSEC', 'Back up the database']); // in progress first

    const done = (await send('PATCH', `/api/improvements/${high.id}`, me, { status: 'done' })).json();
    expect(done.doneAt).not.toBeNull();
    const reopened = (await send('PATCH', `/api/improvements/${high.id}`, me, { status: 'planned' })).json();
    expect(reopened.doneAt).toBeNull();

    expect((await send('DELETE', `/api/improvements/${low.id}`, me)).statusCode).toBe(204);
    expect((await send('DELETE', `/api/improvements/${low.id}`, me)).statusCode).toBe(404);
  });

  it('keeps learning progress per user', async () => {
    const me = await loginAs('me@example.com', '192.0.2.61');
    const other = await loginAs('other@example.com', '192.0.2.62');
    expect((await send('PUT', '/api/learning/progress/docker', me, { score: 100 })).statusCode).toBe(200);
    expect((await send('PUT', '/api/learning/progress/Not Valid', me, { score: 100 })).statusCode).toBe(400);

    expect((await app.inject({ url: '/api/learning/progress', cookies: me })).json()).toMatchObject([{ moduleId: 'docker', score: 100 }]);
    expect((await app.inject({ url: '/api/learning/progress', cookies: other })).json()).toEqual([]);

    await send('DELETE', '/api/learning/progress/docker', other); // someone else cannot reset mine
    expect((await app.inject({ url: '/api/learning/progress', cookies: me })).json()).toHaveLength(1);
    await send('DELETE', '/api/learning/progress/docker', me);
    expect((await app.inject({ url: '/api/learning/progress', cookies: me })).json()).toEqual([]);
  });
});
