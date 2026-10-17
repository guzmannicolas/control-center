import pg from 'pg';
import { z } from 'zod';
import { DatabaseConfig } from '@cc/shared';
import { defineChecker, errorReason, monitorUrl } from './define.js';

const STATS = `
  SELECT current_setting('server_version') AS version,
         current_database() AS database,
         pg_database_size(current_database())::bigint AS size,
         (SELECT count(*) FROM pg_stat_activity)::int AS connections,
         current_setting('max_connections')::int AS max_connections,
         extract(epoch FROM now() - pg_postmaster_start_time())::bigint AS uptime,
         (SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)
            FROM pg_stat_database WHERE datname = current_database()) AS cache_hit`;

// Sizes and names only: the monitoring role (pg_monitor) cannot read any rows.
const BIGGEST_TABLES = `
  SELECT relname AS name, pg_total_relation_size(relid)::bigint AS bytes
    FROM pg_stat_user_tables ORDER BY 2 DESC LIMIT 5`;

export const postgresHealth = defineChecker({
  id: 'postgres-health',
  description: 'Connects with a statistics-only user: version, size, connections, uptime, cache hits, biggest tables.',
  appliesTo: ['database'],
  defaultIntervalSeconds: 300,
  settings: z.object({
    warnConnectionsPct: z.number().min(1).max(100).default(80),
    timeoutMs: z.number().int().positive().default(10_000),
  }),

  async run(target, s, ctx) {
    const config = DatabaseConfig.parse(target.config);
    if (config.engine !== 'postgres') throw new Error(`postgres-health cannot check a ${config.engine} database`);
    const client = new pg.Client({
      connectionString: monitorUrl(config.connectionEnv),
      connectionTimeoutMillis: s.timeoutMs,
      statement_timeout: s.timeoutMs,
      application_name: 'control-center-monitor',
    });
    const stop = () => void client.end().catch(() => {});
    ctx.signal.addEventListener('abort', stop, { once: true });
    try {
      try {
        await client.connect();
      } catch (err) {
        // For a database, "cannot connect" is the measurement: it is down for its app too.
        return { status: 'fail', message: `Cannot connect: ${errorReason(err)}` };
      }
      const [stats, tables] = await Promise.all([client.query(STATS), client.query(BIGGEST_TABLES)]);
      const r = stats.rows[0];
      const metrics = {
        sizeBytes: Number(r.size),
        connections: r.connections,
        maxConnections: r.max_connections,
        uptimeSeconds: Number(r.uptime),
        ...(r.cache_hit === null ? {} : { cacheHitPct: Number(r.cache_hit) }),
      };
      const details = {
        version: String(r.version).split(' ')[0],
        database: r.database,
        biggestTables: tables.rows.map((t) => ({ name: t.name, bytes: Number(t.bytes) })),
      };
      const usedPct = (metrics.connections / metrics.maxConnections) * 100;
      const summary = `PostgreSQL ${details.version} · ${metrics.connections}/${metrics.maxConnections} connections`;
      if (usedPct >= s.warnConnectionsPct) {
        return { status: 'warn', message: `Connections almost full: ${summary}`, metrics, details };
      }
      return { status: 'ok', message: summary, metrics, details };
    } finally {
      ctx.signal.removeEventListener('abort', stop);
      stop();
    }
  },
});
