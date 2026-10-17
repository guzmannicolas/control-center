import { afterEach, describe, expect, it } from 'vitest';
import { classifyBackup, parseBackupLog } from './backup-age.js';
import { monitorUrl, type CheckTarget } from './define.js';
import { postgresHealth } from './postgres-health.js';
import { parseRedisInfo, redisHealth } from './redis-health.js';

const now = new Date('2026-10-17T12:00:00+02:00');
const ctx = () => ({ signal: new AbortController().signal, now });
const settings = { logPath: '/x', destination: 'Google Drive', warnHours: 26, failHours: 50 };

// Copied from the real CMS backup log (shortened).
const REAL_LOG = `
2026-10-16T03:30:40+02:00 OK cms-20261016-0330.tar 57M
2026/10/17 03:30:18 NOTICE: gdrive: This remote uses rclone's shared Google Drive client_id, which is being retired and will stop working during 2026.
2026/10/17 03:30:30 NOTICE: gdrive: This remote uses rclone's shared Google Drive client_id, which is being retired and will stop working during 2026.
2026-10-17T03:30:40+02:00 OK cms-20261017-0330.tar 58M
`;

describe('backup log', () => {
  it('finds the latest good backup and the warnings printed during that run (once each)', () => {
    const parsed = parseBackupLog(REAL_LOG);
    expect(parsed.lastBackup).toEqual({ at: '2026-10-17T01:30:40.000Z', file: 'cms-20261017-0330.tar', size: '58M' });
    expect(parsed.notices).toHaveLength(1);
    expect(parsed.notices[0]?.message).toMatch(/will stop working during 2026/);
  });

  it('warns about a fresh backup that printed warnings', () => {
    const r = classifyBackup(parseBackupLog(REAL_LOG), now, settings);
    expect(r).toMatchObject({ status: 'warn', message: 'Last backup 8 h ago (58M) · 1 warning' });
  });

  it('is ok for a fresh, clean backup', () => {
    expect(classifyBackup(parseBackupLog('2026-10-17T03:30:40+02:00 OK cms-a.tar 58M'), now, settings).status).toBe('ok');
  });

  it('warns when last night is missing and fails when much older', () => {
    const at = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString().replace('Z', '+00:00');
    expect(classifyBackup(parseBackupLog(`${at(30)} OK a.tar 1M`), now, settings).status).toBe('warn');
    expect(classifyBackup(parseBackupLog(`${at(60)} OK a.tar 1M`), now, settings).status).toBe('fail');
  });

  it('fails when a run after the last success printed an error', () => {
    const log = `${REAL_LOG}\npg_dump: ERROR: connection to server failed\n`;
    expect(classifyBackup(parseBackupLog(log), now, settings)).toMatchObject({ status: 'fail', message: 'Latest run failed: connection to server failed' });
  });

  it('fails when the log has no success at all', () => {
    expect(classifyBackup(parseBackupLog('starting\n'), now, settings).status).toBe('fail');
  });
});

describe('redis INFO', () => {
  it('reads version, memory, clients, keys across databases and persistence', () => {
    const info = ['# Server', 'redis_version:7.4.1', 'uptime_in_seconds:3600', '# Clients', 'connected_clients:4',
      '# Memory', 'used_memory:1048576', 'maxmemory:0', '# Persistence', 'aof_enabled:1', 'rdb_last_save_time:1792200000',
      'rdb_last_bgsave_status:ok', '# Stats', 'evicted_keys:0', '# Keyspace', 'db0:keys=12,expires=3,avg_ttl=0', 'db1:keys=5,expires=0,avg_ttl=0'].join('\r\n');
    expect(parseRedisInfo(info)).toMatchObject({
      version: '7.4.1', clients: 4, usedMemoryBytes: 1_048_576, maxMemoryBytes: 0, keys: 17, uptimeSeconds: 3600, aofEnabled: true, lastSaveOk: true,
    });
  });
});

describe('connection URLs come only from MONITOR_ variables', () => {
  afterEach(() => { delete process.env.MONITOR_TEST_X; });

  it('refuses any other variable name, so a checker can never read DATABASE_URL', () => {
    expect(() => monitorUrl('DATABASE_URL')).toThrow(/not a MONITOR_ variable/);
  });

  it('explains when the variable is missing', () => {
    expect(() => monitorUrl('MONITOR_TEST_X')).toThrow('MONITOR_TEST_X is not set on the server');
  });
});

const db = (engine: 'postgres' | 'redis', connectionEnv: string): CheckTarget => ({
  id: 't', name: 't', type: 'database', config: { engine, connectionEnv },
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('postgres-health against a real database', () => {
  afterEach(() => { delete process.env.MONITOR_TEST_PG; });

  it('reads version, size, connections and uptime', async () => {
    process.env.MONITOR_TEST_PG = process.env.TEST_DATABASE_URL;
    const r = await postgresHealth.run(db('postgres', 'MONITOR_TEST_PG'), postgresHealth.settings.parse({}), ctx());
    expect(r.status).toBe('ok');
    expect(r.message).toMatch(/^PostgreSQL 16\.\d+ · \d+\/\d+ connections$/);
    expect(r.metrics?.sizeBytes).toBeGreaterThan(0);
    expect(r.details).toMatchObject({ database: 'control_test' });
  });

  it('fails when the server cannot be reached', async () => {
    process.env.MONITOR_TEST_PG = 'postgresql://nobody:x@127.0.0.1:1/none';
    const r = await postgresHealth.run(db('postgres', 'MONITOR_TEST_PG'), postgresHealth.settings.parse({ timeoutMs: 2000 }), ctx());
    expect(r).toMatchObject({ status: 'fail', message: 'Cannot connect: ECONNREFUSED' });
  });
});

describe.skipIf(!process.env.REDIS_URL)('redis-health against a real Redis', () => {
  afterEach(() => { delete process.env.MONITOR_TEST_REDIS; });

  it('reads INFO', async () => {
    process.env.MONITOR_TEST_REDIS = process.env.REDIS_URL;
    const r = await redisHealth.run(db('redis', 'MONITOR_TEST_REDIS'), redisHealth.settings.parse({}), ctx());
    expect(r.status).toBe('ok');
    expect(r.message).toMatch(/^Redis 7\.\d+\.\d+ · \d+ keys · \d+ clients$/);
  });

  it('fails when Redis cannot be reached', async () => {
    process.env.MONITOR_TEST_REDIS = 'redis://127.0.0.1:1';
    const r = await redisHealth.run(db('redis', 'MONITOR_TEST_REDIS'), redisHealth.settings.parse({ timeoutMs: 2000 }), ctx());
    expect(r).toMatchObject({ status: 'fail', message: 'Cannot connect: ECONNREFUSED' });
  });
});
