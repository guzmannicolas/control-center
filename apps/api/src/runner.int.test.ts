// Integration test: real Postgres (TEST_DATABASE_URL), migrated by test/global-setup.ts.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { CheckOutcome } from '@cc/shared';
import { createPrisma } from './infra.js';
import { recordOutcome } from './runner.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('recordOutcome on a real database', () => {
  const prisma = createPrisma(url ?? '');
  let monitorId: string;
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 16, 12, minute));
  const record = (status: CheckOutcome['status'], minute: number, message: string = status) =>
    recordOutcome(prisma, monitorId, { status, message, metrics: {}, details: {} }, 10, at(minute));
  const incidents = () => prisma.incident.findMany({ where: { monitorId }, orderBy: { openedAt: 'asc' } });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE targets CASCADE');
    const target = await prisma.target.create({ data: { name: 'Test site', type: 'website', config: { url: 'https://example.com' } } });
    monitorId = (await prisma.monitor.create({ data: { targetId: target.id, checker: 'http-uptime', intervalSeconds: 60 } })).id;
  });
  afterAll(() => prisma.$disconnect());

  it('one outage = one incident, from first failure to recovery', async () => {
    await record('ok', 0);
    await record('fail', 5, 'HTTP 502');
    await record('fail', 10, 'HTTP 503');
    await record('ok', 15);

    const [incident, ...others] = await incidents();
    expect(others).toHaveLength(0);
    expect(incident).toMatchObject({ severity: 'fail', lastMessage: 'HTTP 503', openedAt: at(5), resolvedAt: at(15) });
    expect(await prisma.result.count({ where: { monitorId } })).toBe(4);
    expect(await prisma.monitor.findUnique({ where: { id: monitorId } })).toMatchObject({ lastStatus: 'ok', lastCheckedAt: at(15) });
  });

  it('"error" (could not check) neither opens nor resolves an incident', async () => {
    await record('error', 0);
    expect(await incidents()).toHaveLength(0);

    await record('fail', 5);
    await record('error', 10);
    expect((await incidents())[0]?.resolvedAt).toBeNull();
  });

  it('the database refuses a second open incident for the same monitor', async () => {
    await record('fail', 0);
    await expect(prisma.incident.create({ data: { monitorId, severity: 'fail', lastMessage: 'dup' } })).rejects.toThrow();
  });
});
