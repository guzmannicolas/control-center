import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getKnowledgeBaseDir, listKnowledgeDocs } from './manager.js';
import type {
  RepoAnalysisResult,
  RepoGraphNode,
  RepoGraphEdge,
} from '@cc/shared';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function analyzeControlCenterRepo(): RepoAnalysisResult {
  const knowledgeDir = getKnowledgeBaseDir();
  const repoRoot = resolve(knowledgeDir, '..');

  // 1. Gather docs & skills from knowledge base
  const docs = listKnowledgeDocs();
  const skillsCount = docs.filter((d) => d.category === 'skills').length;

  // 2. Build canonical technologies list
  const technologies = [
    { name: 'TypeScript', category: 'Language', version: '5.x', usedIn: ['@cc/api', '@cc/web', '@cc/shared', 'scripts'] },
    { name: 'Fastify', category: 'Backend Framework', version: '5.12.7', usedIn: ['@cc/api'] },
    { name: 'React', category: 'Frontend UI', version: '19.3.1', usedIn: ['@cc/web'] },
    { name: 'Vite', category: 'Bundler & Dev Server', version: '8.3.4', usedIn: ['@cc/web'] },
    { name: 'Tailwind CSS', category: 'Styling Engine', version: '4.3.3', usedIn: ['@cc/web'] },
    { name: 'Prisma ORM', category: 'Database ORM', version: '7.10.1', usedIn: ['@cc/api'] },
    { name: 'PostgreSQL', category: 'Relational Database', version: '16-alpine', usedIn: ['Infrastructure'] },
    { name: 'Redis', category: 'In-Memory Cache & Queue', version: '7-alpine', usedIn: ['Infrastructure'] },
    { name: 'BullMQ', category: 'Background Job Queues', version: '6.3.15', usedIn: ['@cc/api'] },
    { name: 'Model Context Protocol (MCP)', category: 'AI Protocol', version: '2024-11-05', usedIn: ['@cc/api', 'scripts'] },
    { name: 'Google Gen AI SDK', category: 'AI Inference', version: '2.32.0', usedIn: ['@cc/api'] },
    { name: 'Baileys WhatsApp', category: 'Messaging Engine', version: '7.0.0-rc14', usedIn: ['@cc/api'] },
    { name: 'Caddy', category: 'Reverse Proxy & TLS', version: '2.x', usedIn: ['Infrastructure'] },
    { name: 'rclone', category: 'Encrypted Cloud Storage', version: 'Latest', usedIn: ['Infrastructure'] },
    { name: 'Cloudflare Tunnels', category: 'Zero-Trust Ingress', version: 'cloudflared', usedIn: ['Infrastructure'] },
  ];

  // 3. Define the topology nodes
  const nodes: RepoGraphNode[] = [
    // Applications & Packages
    {
      id: 'app-web',
      label: 'Control Center Web',
      category: 'app',
      tech: 'React 19 + Vite 8 + Tailwind CSS 4',
      description: 'Single-page management console and Mission Control cockpit dashboard.',
      filePath: 'apps/web',
      inbound: ['caddy-proxy'],
      outbound: ['app-api'],
      tags: ['frontend', 'react', 'dashboard', 'vite'],
    },
    {
      id: 'app-api',
      label: 'Control Center API',
      category: 'app',
      tech: 'Fastify 5 + TypeScript + esbuild',
      description: 'Core REST microservice listening on internal port 4100. Manages auth, monitors, and features.',
      filePath: 'apps/api/src/server.ts',
      inbound: ['app-web', 'caddy-proxy', 'ext-ai-agents'],
      outbound: ['db-postgres', 'db-redis', 'knowledge-base', 'module-whatsapp', 'module-scraper', 'module-vault', 'vps-host'],
      tags: ['backend', 'fastify', 'rest', 'api'],
    },
    {
      id: 'app-worker',
      label: 'BullMQ Background Worker',
      category: 'app',
      tech: 'BullMQ 6 + ioredis + TypeScript',
      description: 'Asynchronous runner executing health checks, SSL verification, and outreach queue jobs.',
      filePath: 'apps/api/src/worker.ts',
      inbound: ['db-redis'],
      outbound: ['db-postgres', 'db-redis'],
      tags: ['worker', 'bullmq', 'background-jobs', 'scheduler'],
    },
    {
      id: 'pkg-shared',
      label: '@cc/shared Contracts',
      category: 'app',
      tech: 'Zod 4 + TypeScript Types',
      description: 'Monorepo workspace package exporting schemas, interfaces, and domain types.',
      filePath: 'packages/shared/src/index.ts',
      inbound: ['app-web', 'app-api'],
      outbound: [],
      tags: ['types', 'contracts', 'zod', 'validation'],
    },
    {
      id: 'knowledge-base',
      label: 'Knowledge Base Neural Core',
      category: 'module',
      tech: 'Markdown (.md) + MCP Engine',
      description: 'Canonical physical documentation repository storing architecture, database schema, and SOPs.',
      filePath: 'knowledge/',
      inbound: ['app-api', 'mcp-server', 'ext-ai-agents'],
      outbound: [],
      tags: ['knowledge-base', 'markdown', 'documentation', 'mcp'],
    },
    {
      id: 'mcp-server',
      label: 'Model Context Protocol Server',
      category: 'service',
      tech: 'Node.js stdio / Streamable HTTP',
      description: 'JSON-RPC 2.0 MCP server exposing get_system_context and read_knowledge_doc to AI agents.',
      filePath: 'scripts/mcp-server.mjs',
      inbound: ['ext-ai-agents'],
      outbound: ['knowledge-base'],
      tags: ['mcp', 'agentic', 'tools', 'json-rpc'],
    },

    // Feature Modules
    {
      id: 'module-scraper',
      label: 'Sales Lead Prospector',
      category: 'module',
      tech: 'Google Maps dynamic feed extractor',
      description: 'Extracts real commercial targets, Place ID links, and normalizes Argentine phone numbers.',
      filePath: 'apps/api/src/leads/scraper.ts',
      inbound: ['app-api'],
      outbound: ['db-postgres', 'ext-google-maps'],
      tags: ['sales', 'prospecting', 'google-maps', 'leads'],
    },
    {
      id: 'module-whatsapp',
      label: 'WhatsApp Outreach Engine',
      category: 'module',
      tech: '@whiskeysockets/baileys + BullMQ',
      description: 'Session manager and message dispatcher with template variable interpolation and anti-ban pacing.',
      filePath: 'apps/api/src/leads/whatsapp.ts',
      inbound: ['app-api', 'app-worker'],
      outbound: ['db-redis', 'ext-whatsapp'],
      tags: ['whatsapp', 'outreach', 'messaging', 'baileys'],
    },
    {
      id: 'module-vault',
      label: 'Encrypted Env Secrets Vault',
      category: 'module',
      tech: 'Scrypt + AES encryption + File audit',
      description: 'Centralized secret vault managing project .env configs, drift detection, and secure disk deployment.',
      filePath: 'apps/api/src/vault/vault.ts',
      inbound: ['app-api'],
      outbound: ['db-postgres', 'vps-host'],
      tags: ['security', 'vault', 'secrets', 'encryption'],
    },
    {
      id: 'module-ai',
      label: 'Gemini AI Orchestrator',
      category: 'module',
      tech: '@google/genai SDK (Tiered Flash pool)',
      description: 'Failover AI orchestrator executing pitch personalization, data audits, and marketing creative synthesis.',
      filePath: 'apps/api/src/marketing/agent.ts',
      inbound: ['app-api'],
      outbound: ['ext-gemini'],
      tags: ['gemini', 'google-genai', 'ai-agent', 'orchestrator'],
    },
    {
      id: 'module-backups',
      label: 'Dual-Layer Backup Manager',
      category: 'module',
      tech: 'Shell + pg_dump + rclone gcrypt',
      description: 'Nightly 03:30 backup coordinator bundling PostgreSQL, Directus media, and encrypted offsite Drive upload.',
      filePath: 'apps/api/src/ops.ts',
      inbound: ['app-api'],
      outbound: ['db-postgres', 'ext-gdrive', 'vps-host'],
      tags: ['backups', 'disaster-recovery', 'rclone', 'google-drive'],
    },

    // Infrastructure & Storage
    {
      id: 'vps-host',
      label: 'Contabo Cloud VPS',
      category: 'infrastructure',
      tech: 'Ubuntu 24.04 LTS (Kernel 6.8)',
      description: 'Production host server (173.212.224.70:2222) running Docker Engine and reverse proxy.',
      filePath: '/home/adminnico',
      inbound: ['ext-ssh'],
      outbound: ['caddy-proxy', 'db-postgres', 'db-redis', 'app-api'],
      tags: ['vps', 'contabo', 'ubuntu', 'hardware'],
    },
    {
      id: 'caddy-proxy',
      label: 'Caddy Reverse Proxy',
      category: 'infrastructure',
      tech: 'Caddy 2 + Automatic Let\'s Encrypt TLS',
      description: 'Handles incoming HTTP/HTTPS traffic, terminates TLS, and proxies upstream to port 4100.',
      filePath: '/etc/caddy/Caddyfile',
      inbound: ['ext-cloudflare', 'ext-users'],
      outbound: ['app-api', 'app-web'],
      tags: ['caddy', 'reverse-proxy', 'tls', 'ssl'],
    },
    {
      id: 'db-postgres',
      label: 'PostgreSQL 16 DB',
      category: 'database',
      tech: 'PostgreSQL 16-alpine container',
      description: 'Primary transactional storage holding users, monitored targets, health results, leads, and vault.',
      filePath: 'docker-compose.yml:postgres',
      inbound: ['app-api', 'app-worker', 'module-backups'],
      outbound: [],
      tags: ['database', 'postgres', 'sql', 'storage'],
    },
    {
      id: 'db-redis',
      label: 'Redis 7 Queue & Cache',
      category: 'database',
      tech: 'Redis 7-alpine container (AOF enabled)',
      description: 'In-memory store powering BullMQ queues, rate limit counters, and health status cache.',
      filePath: 'docker-compose.yml:redis',
      inbound: ['app-api', 'app-worker'],
      outbound: [],
      tags: ['redis', 'cache', 'queue', 'bullmq'],
    },

    // External Ecosystem
    {
      id: 'ext-cloudflare',
      label: 'Cloudflare Zero-Trust',
      category: 'external',
      tech: 'Cloudflare DNS + cloudflared tunnel',
      description: 'Ingress and DNS management for control-api.nicoguzmandev.com with DDoS protection.',
      inbound: ['ext-users'],
      outbound: ['caddy-proxy'],
      tags: ['cloudflare', 'dns', 'tunnel', 'security'],
    },
    {
      id: 'ext-gdrive',
      label: 'Google Drive Cloud Storage',
      category: 'external',
      tech: 'Encrypted remote (gcrypt:daily/)',
      description: 'Offsite disaster recovery storage retaining 30 days of AES-256 encrypted backup packages.',
      inbound: ['module-backups'],
      outbound: [],
      tags: ['google-drive', 'cloud-storage', 'rclone', 'offsite'],
    },
    {
      id: 'ext-gemini',
      label: 'Google Gemini AI API',
      category: 'external',
      tech: 'Gemini 3.5 / 3.6 Flash inference',
      description: 'Google Gen AI endpoint powering pitch synthesis, marketing copy, and intelligent data cleansing.',
      inbound: ['module-ai'],
      outbound: [],
      tags: ['gemini', 'google-ai', 'llm', 'api'],
    },
    {
      id: 'ext-whatsapp',
      label: 'WhatsApp Network',
      category: 'external',
      tech: 'End-to-end encrypted protocol',
      description: 'Official WhatsApp protocol servers connecting via Baileys multi-device pairing.',
      inbound: ['module-whatsapp'],
      outbound: [],
      tags: ['whatsapp', 'meta', 'e2ee'],
    },
    {
      id: 'ext-google-maps',
      label: 'Google Maps Public Feed',
      category: 'external',
      tech: 'Live search stream endpoint',
      description: 'Serves real commercial listings, ratings, reviews, and Place IDs.',
      inbound: ['module-scraper'],
      outbound: [],
      tags: ['google-maps', 'maps', 'scraper'],
    },
    {
      id: 'ext-ai-agents',
      label: 'AI Agents (Antigravity / Cursor)',
      category: 'external',
      tech: 'Model Context Protocol (MCP) clients',
      description: 'Autonomous development assistants pair-programming on the control-center repository.',
      inbound: [],
      outbound: ['mcp-server', 'app-api'],
      tags: ['antigravity', 'cursor', 'claude-code', 'agents'],
    },
  ];

  // 4. Define connecting edges with communication protocols
  const edges: RepoGraphEdge[] = [
    {
      id: 'e-web-api',
      source: 'app-web',
      target: 'app-api',
      protocol: 'HTTP/REST',
      label: 'REST APIs (/api/*)',
      description: 'Dashboard queries targets, leads, vault items, and knowledge docs over JSON REST with cookie auth.',
    },
    {
      id: 'e-api-postgres',
      source: 'app-api',
      target: 'db-postgres',
      protocol: 'PostgreSQL/TCP',
      label: 'Prisma Client (@5432)',
      description: 'Executes type-safe SQL queries for Leads, Targets, Monitors, Results, and Vault models.',
    },
    {
      id: 'e-api-redis',
      source: 'app-api',
      target: 'db-redis',
      protocol: 'Redis/BullMQ',
      label: 'BullMQ Producer (@6379)',
      description: 'Enqueues background health checks, WhatsApp outreach dispatches, and manages rate limits.',
    },
    {
      id: 'e-worker-redis',
      source: 'app-worker',
      target: 'db-redis',
      protocol: 'Redis/BullMQ',
      label: 'BullMQ Consumer',
      description: 'Pulls scheduled checking tasks and outreach jobs from Redis queues.',
    },
    {
      id: 'e-worker-postgres',
      source: 'app-worker',
      target: 'db-postgres',
      protocol: 'PostgreSQL/TCP',
      label: 'Log Results',
      description: 'Writes execution results, latency metrics, and incident timestamps to PostgreSQL.',
    },
    {
      id: 'e-api-knowledge',
      source: 'app-api',
      target: 'knowledge-base',
      protocol: 'Internal/Import',
      label: 'File Read/Write',
      description: 'Synchronizes physical Markdown docs on disk via listKnowledgeDocs and writeKnowledgeDoc.',
    },
    {
      id: 'e-mcp-knowledge',
      source: 'mcp-server',
      target: 'knowledge-base',
      protocol: 'Internal/Import',
      label: 'Knowledge Provider',
      description: 'Serves knowledge:// resources and get_system_context directly from markdown files.',
    },
    {
      id: 'e-agents-mcp',
      source: 'ext-ai-agents',
      target: 'mcp-server',
      protocol: 'MCP/JSON-RPC',
      label: 'MCP Protocol',
      description: 'Cursor, Antigravity, and Claude Code query system context and documentation before executing code.',
    },
    {
      id: 'e-agents-api',
      source: 'ext-ai-agents',
      target: 'app-api',
      protocol: 'HTTP/REST',
      label: 'GET /api/agent/context',
      description: 'Remote LLMs consume unified markdown system prompts directly over HTTPS.',
    },
    {
      id: 'e-caddy-api',
      source: 'caddy-proxy',
      target: 'app-api',
      protocol: 'HTTP/REST',
      label: 'Reverse Proxy (4100)',
      description: 'Proxies external HTTPS requests from control-api.nicoguzmandev.com into internal port 4100.',
    },
    {
      id: 'e-cf-caddy',
      source: 'ext-cloudflare',
      target: 'caddy-proxy',
      protocol: 'HTTP/REST',
      label: 'Zero-Trust Ingress',
      description: 'Routes public internet traffic securely through Cloudflare tunnels without exposed ports.',
    },
    {
      id: 'e-api-scraper',
      source: 'app-api',
      target: 'module-scraper',
      protocol: 'Internal/Import',
      label: 'Trigger Extraction',
      description: 'API triggers background or on-demand scraping batches by business category and Argentine city.',
    },
    {
      id: 'e-scraper-gmaps',
      source: 'module-scraper',
      target: 'ext-google-maps',
      protocol: 'HTTP/REST',
      label: 'Dynamic Search Feed',
      description: 'Fetches search result streams from Google Maps and parses data[64] arrays for Place IDs.',
    },
    {
      id: 'e-api-whatsapp',
      source: 'app-api',
      target: 'module-whatsapp',
      protocol: 'Internal/Import',
      label: 'Outreach Manager',
      description: 'Dispatches personalized pitch messages with Argentine tone and custom Vercel demo URLs.',
    },
    {
      id: 'e-whatsapp-net',
      source: 'module-whatsapp',
      target: 'ext-whatsapp',
      protocol: 'HTTP/REST',
      label: 'Multi-Device WS',
      description: 'Maintains authenticated WebSocket session with WhatsApp network using persistent credentials.',
    },
    {
      id: 'e-api-ai',
      source: 'app-api',
      target: 'module-ai',
      protocol: 'Internal/Import',
      label: 'Orchestrator Call',
      description: 'Generates structured JSON marketing creatives and tailored outreach pitches.',
    },
    {
      id: 'e-ai-gemini',
      source: 'module-ai',
      target: 'ext-gemini',
      protocol: 'HTTP/REST',
      label: 'Google Gen AI SDK',
      description: 'Calls gemini-3.5-flash-lite with temperature 0.0 and automatic model pool failover.',
    },
    {
      id: 'e-api-vault',
      source: 'app-api',
      target: 'module-vault',
      protocol: 'Internal/Import',
      label: 'Secrets Management',
      description: 'Audits disk .env files, computes drift against database vault, and deploys encrypted variables.',
    },
    {
      id: 'e-api-backups',
      source: 'app-api',
      target: 'module-backups',
      protocol: 'Internal/Import',
      label: 'Trigger Backup SOP',
      description: 'Executes backup.sh script generating PostgreSQL dumps, uploads tar, and secrets bundles.',
    },
    {
      id: 'e-backups-gdrive',
      source: 'module-backups',
      target: 'ext-gdrive',
      protocol: 'HTTP/REST',
      label: 'rclone gcrypt:daily',
      description: 'Encrypts daily archive with AES-256 before uploading to offsite Google Drive storage.',
    },
  ];

  // 5. Build architectural communication flows
  const communicationFlows = [
    {
      title: '1. AI Agent Context Acquisition Flow',
      steps: [
        'External AI Agent (Antigravity or Cursor) starts a conversation.',
        'Agent accesses MCP server via stdio (scripts/mcp-server.mjs) or HTTP (/api/agent/context).',
        'MCP Engine reads canonical physical markdown docs from knowledge/ directory on disk.',
        'Consolidated architecture and SOP guidelines are injected into the agent system prompt.',
        'Agent executes codebase modifications adhering strictly to project policies.',
      ],
    },
    {
      title: '2. B2B Sales Prospecting & Outreach Pipeline',
      steps: [
        'User or cron triggers POST /api/leads/scrape with category (e.g. Gyms) and city (e.g. Palermo, CABA).',
        'Scraper engine queries Google Maps dynamic feed and extracts Place IDs, phones, and website status.',
        'Phone numbers are normalized to international Argentine format (+54 9 ...).',
        'Leads are persisted to PostgreSQL with status "discovered" or "enriched".',
        'Outreach engine generates customized pitch using niche demo templates and enqueues in BullMQ.',
        'WhatsApp module dispatches message via Baileys multi-device connection with anti-spam cadence.',
      ],
    },
    {
      title: '3. Dual-Layer Disaster Recovery Protocol',
      steps: [
        'Nightly cron triggers /home/adminnico/cms/scripts/backup.sh at 03:30 hs ART.',
        'Generates database.sql.gz (Postgres dump), uploads.tar.gz (Directus media), and secrets.tar.gz.',
        'Archives are bundled into cms-YYYYMMDD-HHMM.tar and kept on local VPS disk (7-day retention).',
        'rclone encrypts the bundle with AES-256 and synchronizes to Google Drive gcrypt:daily/ (30-day retention).',
        'Control Center UI audits the backup age and cloud sync status in Mission Control.',
      ],
    },
    {
      title: '4. Secrets Vault & Configuration Deployment',
      steps: [
        'Sensitive tokens and keys are stored encrypted in PostgreSQL using scrypt-salted keys.',
        'Audit engine scans VPS filesystem discovering unmanaged or diverging .env files.',
        'Admin inspects diff between database Vault values and physical disk values.',
        'One-click deploy pushes encrypted secrets directly to target repository .env on VPS with atomic backup.',
      ],
    },
  ];

  const now = new Date();
  const nextScheduled = new Date(now.getTime() + ONE_DAY_MS);

  return {
    analyzedAt: now.toISOString(),
    nextScheduledAnalysis: nextScheduled.toISOString(),
    repoName: 'control-center',
    version: '2.4.0',
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalApps: 4,
      totalServices: 5,
      totalTechnologies: technologies.length,
    },
    technologies,
    nodes,
    edges,
    communicationFlows,
  };
}

export function getOrRunDailyRepoGraph(forceRefresh = false): RepoAnalysisResult {
  const knowledgeDir = getKnowledgeBaseDir();
  const cachePath = join(knowledgeDir, 'repo-graph.json');

  if (!forceRefresh && existsSync(cachePath)) {
    try {
      const raw = readFileSync(cachePath, 'utf8');
      const cached = JSON.parse(raw) as RepoAnalysisResult;
      const analyzedTime = new Date(cached.analyzedAt).getTime();
      const ageMs = Date.now() - analyzedTime;

      // If cached analysis is fresher than 24 hours, return it
      if (ageMs < ONE_DAY_MS) {
        return cached;
      }
    } catch {
      // Invalidate on parse error
    }
  }

  // Run fresh analysis
  const fresh = analyzeControlCenterRepo();
  try {
    writeFileSync(cachePath, JSON.stringify(fresh, null, 2), 'utf8');
  } catch {
    // Non-fatal write failure
  }

  return fresh;
}
