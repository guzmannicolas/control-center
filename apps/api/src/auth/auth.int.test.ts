// Integration test: the whole login flow over HTTP against a real Postgres (TEST_DATABASE_URL).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createPrisma } from '../infra.js';
import { hashPassword } from './password.js';
import { hashToken } from './sessions.js';

const url = process.env.TEST_DATABASE_URL;
const ORIGIN = 'https://dash.test';
const EMAIL = 'me@example.com';
const PASSWORD = 'a long enough password';

describe.skipIf(!url)('login, session and protected routes', () => {
  const prisma = createPrisma(url ?? '');
  const up = async () => 'ok';
  let app: ReturnType<typeof buildApp>;

  const login = (password: string, ip = '203.0.113.1', email = EMAIL) =>
    app.inject({ method: 'POST', url: '/auth/login', headers: { origin: ORIGIN, 'cf-connecting-ip': ip }, payload: { email, password } });
  const cookieOf = (res: Awaited<ReturnType<typeof login>>) => res.cookies.find((c) => c.name === 'cc_session');

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users CASCADE');
    await prisma.user.create({ data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD) } });
    app = buildApp({ prisma, probes: { database: up, redis: up }, dashboardOrigin: ORIGIN, cookieSecure: true });
  });
  afterAll(() => prisma.$disconnect());

  it('rejects a wrong password and an unknown email with the same message', async () => {
    const wrong = await login('nope', '203.0.113.2');
    const unknown = await login(PASSWORD, '203.0.113.2', 'nobody@example.com');
    expect([wrong.statusCode, unknown.statusCode]).toEqual([401, 401]);
    expect(wrong.json()).toEqual(unknown.json());
    expect(cookieOf(wrong)).toBeUndefined();
  });

  it('logs in with a secure session cookie and stores only its hash', async () => {
    const res = await login(PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: EMAIL } });

    const cookie = cookieOf(res);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    const session = await prisma.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(hashToken(cookie!.value));
    expect(session.tokenHash).not.toBe(cookie!.value);
    expect(session.ip).toBe('203.0.113.1');
  });

  it('protects /api until logged in, and again after logout', async () => {
    expect((await app.inject('/api/overview')).statusCode).toBe(401);

    const cookies = { cc_session: cookieOf(await login(PASSWORD))!.value };
    const overview = await app.inject({ url: '/api/overview', cookies });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toHaveProperty('counts');

    await app.inject({ method: 'POST', url: '/auth/logout', headers: { origin: ORIGIN }, cookies });
    expect(await prisma.session.count()).toBe(0);
    expect((await app.inject({ url: '/api/overview', cookies })).statusCode).toBe(401);
  });

  it('refuses an expired session', async () => {
    const cookies = { cc_session: cookieOf(await login(PASSWORD))!.value };
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await app.inject({ url: '/auth/me', cookies })).statusCode).toBe(401);
  });

  it('blocks the 6th attempt from the same IP within 15 minutes', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await login('guess', '198.51.100.7')).statusCode);
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
    expect((await login(PASSWORD, '198.51.100.8')).statusCode).toBe(200); // other IPs are unaffected
  });
});
