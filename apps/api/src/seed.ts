// Loads the things I own. Safe to run again: it updates instead of duplicating.
//   docker compose run --rm tools pnpm --filter @cc/api db:seed
import type { TargetType } from '@cc/shared';
import type { Prisma } from './generated/prisma/client.js';
import { checkerById } from './checkers/index.js';
import { loadEnv } from './env.js';
import { createPrisma } from './infra.js';

interface SeedMonitor {
  checker: string;
  intervalSeconds?: number;
  settings?: Prisma.InputJsonObject;
}
interface SeedTarget {
  name: string;
  type: TargetType;
  config: Prisma.InputJsonObject;
  tags: string[];
  monitors: SeedMonitor[];
}

const domain = (name: string, tags: string[]): SeedTarget => ({
  name, type: 'domain', config: { domain: name }, tags, monitors: [{ checker: 'domain-expiry' }],
});
const site = (name: string, url: string, tags: string[], type: TargetType = 'website'): SeedTarget => ({
  name, type, config: { url }, tags, monitors: [{ checker: 'http-uptime' }, { checker: 'ssl-expiry' }],
});

const database = (
  name: string, engine: 'postgres' | 'redis', connectionEnv: string, purpose: string, tags: string[], extra: SeedMonitor[] = [],
): SeedTarget => ({
  name, type: 'database', config: { engine, connectionEnv, purpose }, tags,
  monitors: [{ checker: engine === 'postgres' ? 'postgres-health' : 'redis-health' }, ...extra],
});

const targets: SeedTarget[] = [
  domain('nicoguzmandev.com', ['owner:me']),
  domain('nikipeppers.com', ['client:niki']),
  domain('susterart.com', ['client:belen']),

  site('Nikipeppers site', 'https://nikipeppers.com', ['client:niki', 'vercel']),
  site('Susterart site', 'https://susterart.com', ['client:belen', 'vercel']),
  site('Resume site', 'https://resume.nicoguzmandev.com', ['owner:me', 'vercel']),

  site('CMS', 'https://cms.nicoguzmandev.com/server/health', ['infra', 'vps'], 'service'),
  site('CMS panel (Niki)', 'https://blog.nikipeppers.com/server/health', ['client:niki', 'vps'], 'service'),
  site('CMS panel (Belén)', 'https://blog.susterart.com/server/health', ['client:belen', 'vps'], 'service'),

  database('CMS database', 'postgres', 'MONITOR_CMS_POSTGRES_URL', "Directus: clients' content, users and settings", ['infra', 'vps', 'cms'], [
    { checker: 'backup-age', settings: { logPath: '/backups/cms/backup.log', destination: 'VPS (7 days) + encrypted Google Drive (30 days)' } },
  ]),
  database('CMS cache', 'redis', 'MONITOR_CMS_REDIS_URL', 'Directus cache: safe to lose, rebuilt on demand', ['infra', 'vps', 'cms']),
  database('Control Center database', 'postgres', 'MONITOR_CC_POSTGRES_URL', 'Targets, check results, incidents, users and sessions', ['infra', 'vps']),
  database('Control Center queue', 'redis', 'MONITOR_CC_REDIS_URL', 'Check schedules and jobs, login attempt counters', ['infra', 'vps']),

  // The VPN panel must stay behind Cloudflare Access: a 200 here would mean it is exposed.
  {
    name: 'VPN panel (Access)',
    type: 'service',
    config: { url: 'https://vpn.nicoguzmandev.com' },
    tags: ['infra', 'security'],
    monitors: [
      { checker: 'http-uptime', settings: { followRedirects: false, expectStatus: [302], expectRedirectTo: 'cloudflareaccess.com' } },
      { checker: 'ssl-expiry' },
    ],
  },
];

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);

for (const t of targets) {
  const target = await prisma.target.upsert({
    where: { name: t.name },
    create: { name: t.name, type: t.type, config: t.config, tags: t.tags },
    update: { type: t.type, config: t.config, tags: t.tags },
  });
  for (const m of t.monitors) {
    const checker = checkerById.get(m.checker);
    if (!checker) throw new Error(`Unknown checker ${m.checker}`);
    checker.settings.parse(m.settings ?? {}); // fail here, not at 3 a.m. in the worker
    const intervalSeconds = m.intervalSeconds ?? checker.defaultIntervalSeconds;
    await prisma.monitor.upsert({
      where: { targetId_checker: { targetId: target.id, checker: m.checker } },
      create: { targetId: target.id, checker: m.checker, intervalSeconds, settings: m.settings ?? {} },
      update: { intervalSeconds, settings: m.settings ?? {} },
    });
  }
  console.log(`✓ ${t.name} (${t.monitors.map((m) => m.checker).join(', ')})`);
}
// The first backlog: only written once, so items you edit or delete in the dashboard stay that way.
type SeedImprovement = { title: string; area: string; priority: 'high' | 'medium' | 'low'; status?: 'idea' | 'planned' | 'done'; details: string };
const improvements: SeedImprovement[] = [
  { title: 'Back up the Control Center database', area: 'backups', priority: 'high', status: 'planned',
    details: 'Its Postgres (targets, history, incidents, users) is not backed up anywhere. Add it to the nightly backup with the same encrypted Google Drive copy.' },
  { title: 'Own Google Drive access for rclone', area: 'backups', priority: 'high',
    details: "rclone's shared Google Drive client_id is being retired during 2026. When it stops, the encrypted Drive copy of the CMS backups stops silently. Create an OAuth client in Google Cloud and reconnect the gdrive remote." },
  { title: 'Rotate the Cloudflare Global API Key', area: 'security', priority: 'high',
    details: 'It was pasted in a chat on 2026-10-17. Change it in Cloudflare: My Profile → API Tokens → Global API Key → Change. Nothing depends on it.' },
  { title: 'Two-factor login for the dashboard', area: 'security', priority: 'high', status: 'planned',
    details: 'An authenticator-app code (TOTP) on top of the password. Required before connecting personal accounts like email or Drive.' },
  { title: 'Telegram alerts for incidents', area: 'monitoring', priority: 'high', status: 'planned',
    details: 'One message when an incident opens and one when it resolves.' },
  { title: 'Projects section (Vercel projects and deploys)', area: 'dashboard', priority: 'medium', status: 'planned',
    details: 'Every Vercel project with its last deploy, state, domains and repository. Needs VERCEL_TOKEN in .env.' },
  { title: 'Reach the API from Spain during LaLiga blocks', area: 'infrastructure', priority: 'medium',
    details: "Spanish ISPs block Cloudflare IPs during matches, so control-api (and vpn./ssh.) are unreachable from Spain then. Turn off Bot Fight Mode so Vercel can forward /api, or route the API outside Cloudflare." },
  { title: 'CI with GitHub Actions', area: 'code quality', priority: 'medium', status: 'planned',
    details: 'On every push: typecheck, tests (with Postgres and Redis services), production build. Red = do not deploy.' },
  { title: 'Linting with ESLint and typescript-eslint', area: 'code quality', priority: 'medium',
    details: 'Catch unused code, unhandled promises and risky patterns automatically.' },
  { title: 'Move the browser tests into the repository', area: 'code quality', priority: 'medium',
    details: 'The Playwright tests run from a scratch folder today. Put them in the repo so CI can run them.' },
  { title: 'Upgrade wg-easy from v14 to v15', area: 'infrastructure', priority: 'medium',
    details: 'v14 is no longer maintained. v15 uses a different configuration, so it is its own migration.' },
  { title: 'Turn on DNSSEC for the 3 domains', area: 'domains', priority: 'low',
    details: 'Protects against forged DNS answers. One click per domain in Cloudflare, which is also the registrar.' },
  { title: 'Keep check history small', area: 'monitoring', priority: 'low',
    details: 'Results grow by about 5,000 rows a day. Keep raw results for 30 days, then daily summaries.' },
  { title: 'Limit login attempts per account too', area: 'security', priority: 'low',
    details: 'Today the limit is per IP only (5 attempts per 15 minutes).' },
  { title: 'Remove or reuse erp.nicoguzmandev.com', area: 'infrastructure', priority: 'low',
    details: 'The DNS record points to the VPS but ERPNext is not running (error 525).' },
  { title: 'Delete the old susterart-old repo and Vercel project', area: 'clients', priority: 'low',
    details: 'Left over from the first attempt on 2026-10-09.' },
  { title: "Add Belén's WhatsApp number", area: 'clients', priority: 'low',
    details: 'Her WhatsApp buttons fall back to email until site_profile.whatsapp is set.' },
  { title: 'Domains section', area: 'dashboard', priority: 'medium', status: 'done',
    details: 'Renewal, registrar, DNS, DNSSEC, transfer lock and sites per domain.' },
  { title: 'Databases section', area: 'dashboard', priority: 'medium', status: 'done',
    details: 'Health, size, biggest tables and backups, with statistics-only database users.' },
  { title: 'Stop the endless "Loading…"', area: 'dashboard', priority: 'high', status: 'done',
    details: 'Requests time out after 15 s and retry on network errors.' },
];
if ((await prisma.improvement.count()) === 0) {
  await prisma.improvement.createMany({
    data: improvements.map((i) => ({ ...i, status: i.status ?? 'idea', doneAt: i.status === 'done' ? new Date() : null })),
  });
  console.log(`✓ backlog: ${improvements.length} improvements`);
}

await prisma.$disconnect();
