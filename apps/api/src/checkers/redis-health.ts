import { Redis } from 'ioredis';
import { z } from 'zod';
import { DatabaseConfig } from '@cc/shared';
import { defineChecker, errorReason, monitorUrl } from './define.js';

// INFO answers "key:value" lines in sections; "db0:keys=12,expires=3,…" holds the key counts.
export function parseRedisInfo(text: string) {
  const info = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0 && !line.startsWith('#')) info.set(line.slice(0, i), line.slice(i + 1));
  }
  const num = (key: string) => Number(info.get(key) ?? 0);
  let keys = 0;
  for (const [k, v] of info) if (/^db\d+$/.test(k)) keys += Number(/keys=(\d+)/.exec(v)?.[1] ?? 0);
  const lastSave = num('rdb_last_save_time');
  return {
    version: info.get('redis_version') ?? 'unknown',
    usedMemoryBytes: num('used_memory'),
    maxMemoryBytes: num('maxmemory'), // 0 = no limit
    clients: num('connected_clients'),
    keys,
    uptimeSeconds: num('uptime_in_seconds'),
    evictedKeys: num('evicted_keys'),
    aofEnabled: info.get('aof_enabled') === '1',
    lastSaveAt: lastSave ? new Date(lastSave * 1000).toISOString() : null,
    lastSaveOk: (info.get('rdb_last_bgsave_status') ?? 'ok') === 'ok',
  };
}

export const redisHealth = defineChecker({
  id: 'redis-health',
  description: 'Pings Redis and reads INFO: version, memory, keys, clients, persistence.',
  appliesTo: ['database'],
  defaultIntervalSeconds: 300,
  settings: z.object({
    warnMemoryPct: z.number().min(1).max(100).default(90),
    timeoutMs: z.number().int().positive().default(10_000),
  }),

  async run(target, s, ctx) {
    const config = DatabaseConfig.parse(target.config);
    if (config.engine !== 'redis') throw new Error(`redis-health cannot check a ${config.engine} database`);
    const redis = new Redis(monitorUrl(config.connectionEnv), {
      lazyConnect: true,
      connectTimeout: s.timeoutMs,
      commandTimeout: s.timeoutMs,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null, // one attempt: retrying is the scheduler's job
    });
    // With retries off, connect() only says "Connection is closed."; the real reason arrives as an error event.
    let lastError: unknown;
    redis.on('error', (err) => { lastError = err; });
    const stop = () => redis.disconnect();
    ctx.signal.addEventListener('abort', stop, { once: true });
    try {
      try {
        await redis.connect();
      } catch (err) {
        return { status: 'fail', message: `Cannot connect: ${errorReason(lastError ?? err)}` };
      }
      const i = parseRedisInfo(await redis.info());
      const metrics = {
        usedMemoryBytes: i.usedMemoryBytes,
        maxMemoryBytes: i.maxMemoryBytes,
        clients: i.clients,
        keys: i.keys,
        uptimeSeconds: i.uptimeSeconds,
        evictedKeys: i.evictedKeys,
      };
      const details = { version: i.version, aofEnabled: i.aofEnabled, lastSaveAt: i.lastSaveAt, lastSaveOk: i.lastSaveOk };
      const summary = `Redis ${i.version} · ${i.keys} keys · ${i.clients} clients`;
      if (!i.lastSaveOk) return { status: 'warn', message: `Last save to disk failed · ${summary}`, metrics, details };
      if (i.maxMemoryBytes > 0 && (i.usedMemoryBytes / i.maxMemoryBytes) * 100 >= s.warnMemoryPct) {
        return { status: 'warn', message: `Memory almost full · ${summary}`, metrics, details };
      }
      return { status: 'ok', message: summary, metrics, details };
    } finally {
      ctx.signal.removeEventListener('abort', stop);
      stop();
    }
  },
});
