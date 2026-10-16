import { describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from './app.js';

const up = async () => 'ok';
const down = async () => {
  throw new Error('connection refused');
};
const never = () => new Promise(() => {});

const app = (probes: AppDeps['probes'], healthTimeoutMs?: number) =>
  buildApp({ prisma: {} as never, probes, dashboardOrigin: 'https://dash.test', cookieSecure: true, healthTimeoutMs });

describe('GET /health', () => {
  it('is 200 when the database and Redis answer', async () => {
    const res = await app({ database: up, redis: up }).inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'ok', redis: 'ok' } });
  });

  it('is 503 and names the broken part when one is down', async () => {
    const res = await app({ database: up, redis: down }).inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'fail', checks: { database: 'ok', redis: 'fail' } });
  });

  it('is 503 instead of hanging when a dependency never answers', async () => {
    const res = await app({ database: never, redis: up }, 50).inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'fail', checks: { database: 'fail', redis: 'ok' } });
  });
});

describe('CORS and CSRF', () => {
  it('lets the dashboard read responses with its cookie', async () => {
    const res = await app({ database: up, redis: up }).inject({ url: '/health', headers: { origin: 'https://dash.test' } });
    expect(res.headers['access-control-allow-origin']).toBe('https://dash.test');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not let other sites read responses', async () => {
    // CORS is enforced by the browser: it compares this header with the page's origin and blocks the mismatch.
    const res = await app({ database: up, redis: up }).inject({ url: '/health', headers: { origin: 'https://evil.test' } });
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.test');
  });

  it('refuses a POST from another origin before it reaches any route', async () => {
    const res = await app({ database: up, redis: up }).inject({ method: 'POST', url: '/auth/logout', headers: { origin: 'https://evil.test' } });
    expect(res.statusCode).toBe(403);
  });
});
