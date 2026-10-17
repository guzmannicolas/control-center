import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineChecker, type CheckTarget } from './checkers/define.js';
import { decideIncident, executeCheck } from './runner.js';

const site: CheckTarget = { id: 't', name: 'Site', type: 'website', config: { url: 'https://example.com' } };
const fake = (run: () => Promise<unknown>) =>
  defineChecker({
    id: 'fake', description: '', appliesTo: ['website'], defaultIntervalSeconds: 60,
    settings: z.object({ limit: z.number().default(1) }),
    run: run as never,
  });

describe('decideIncident', () => {
  it.each([
    [false, 'ok', { kind: 'none' }],
    [true, 'ok', { kind: 'resolve' }],
    [false, 'fail', { kind: 'open', severity: 'fail' }],
    [true, 'warn', { kind: 'update', severity: 'warn' }],
    [false, 'error', { kind: 'none' }],
    [true, 'error', { kind: 'none' }],
  ] as const)('open=%s + %s → %j', (open, status, action) => {
    expect(decideIncident(open, status)).toEqual(action);
  });
});

describe('executeCheck turns every kind of trouble into an "error" result', () => {
  it('passes a good outcome through', async () => {
    const { outcome } = await executeCheck(fake(async () => ({ status: 'ok', message: 'fine' })), site, {});
    expect(outcome).toEqual({ status: 'ok', message: 'fine', metrics: {}, details: {} });
  });

  it('unknown checker', async () => {
    expect((await executeCheck(undefined, site, {})).outcome.message).toBe('Unknown checker');
  });

  it('checker that does not apply to the target type', async () => {
    const domain: CheckTarget = { ...site, type: 'domain' };
    expect((await executeCheck(fake(async () => ({})), domain, {})).outcome.message).toBe('fake does not apply to a domain');
  });

  it('invalid settings', async () => {
    const { outcome } = await executeCheck(fake(async () => ({})), site, { limit: 'many' });
    expect(outcome.status).toBe('error');
    expect(outcome.message).toMatch(/^Invalid settings/);
  });

  it('checker that throws', async () => {
    const { outcome } = await executeCheck(fake(async () => { throw new Error('boom'); }), site, {});
    expect(outcome).toMatchObject({ status: 'error', message: 'Check could not run: boom' });
  });

  it('checker that never finishes', async () => {
    const { outcome } = await executeCheck(fake(() => new Promise(() => {})), site, {}, { timeoutMs: 30 });
    expect(outcome.message).toBe('Check could not run: timed out after 30ms');
  });

  it('checker that returns garbage', async () => {
    const { outcome } = await executeCheck(fake(async () => ({ status: 'great' })), site, {});
    expect(outcome.status).toBe('error');
  });
});
