import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const up = async () => 'ok';
const down = async () => {
  throw new Error('connection refused');
};

describe('GET /health', () => {
  it('is 200 when the database and Redis answer', async () => {
    const res = await buildApp({ pingDatabase: up, pingRedis: up }).inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'ok', redis: 'ok' } });
  });

  it('is 503 and names the broken part when one is down', async () => {
    const res = await buildApp({ pingDatabase: up, pingRedis: down }).inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'fail', checks: { database: 'ok', redis: 'fail' } });
  });

  it('is 503 instead of hanging when a dependency never answers', async () => {
    const never = () => new Promise(() => {});
    const res = await buildApp({ pingDatabase: never, pingRedis: up }, {}, 50).inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'fail', checks: { database: 'fail', redis: 'ok' } });
  });
});
