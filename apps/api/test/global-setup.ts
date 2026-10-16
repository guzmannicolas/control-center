// Before integration tests: make sure the test database exists and has the latest migrations.
import { execSync } from 'node:child_process';
import pg from 'pg';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  const admin = new URL(url);
  const name = admin.pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected test database name: ${name}`);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  await client.end();

  execSync('prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'ignore' });
}
