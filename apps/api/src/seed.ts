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
await prisma.$disconnect();
