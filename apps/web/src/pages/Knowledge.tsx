import { useState } from 'react';

interface KnowledgeItem {
  id: string;
  category: 'skills' | 'architecture' | 'playbooks' | 'security';
  title: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  summary: string;
  details: string[];
  codeSnippets?: { title: string; code: string }[];
}

const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: 'google-maps-prospector',
    category: 'skills',
    title: 'Google Maps Live Lead Prospector',
    badge: 'Sales Intelligence',
    badgeBg: '#064e3b',
    badgeColor: '#6ee7b7',
    summary:
      'Direct Google Maps data extractor capable of mining high-value local business prospects without websites in Argentina.',
    details: [
      'Extracts official business name, verified street address, rating, and review count directly from Google Maps live feed.',
      'Audits website status: detects custom commercial domains vs businesses relying strictly on Instagram, Facebook, or WhatsApp.',
      'Includes exact Google Maps Place ID with direct verification links (no partial matches or ambiguous search queries).',
      'Argentine telephone standardizer: automatically normalizes raw numbers into international format (+54 9 ...).',
      'Suggested demo matcher: maps categories (Gyms, Dental, Barbers, Pizzerias) to live Vercel showcase applications.',
    ],
    codeSnippets: [
      {
        title: 'Backend Extractor Route',
        code: 'POST /api/leads/scrape\nBody: { "category": "Gyms & Crossfit Centers", "city": "Palermo, CABA", "limit": 15 }',
      },
      {
        title: 'Place Verification URL Schema',
        code: 'https://www.google.com/maps/place/?q=place_id:<PLACE_ID>',
      },
    ],
  },
  {
    id: 'outreach-assistant',
    category: 'skills',
    title: 'Semi-Automated WhatsApp Outreach Assistant',
    badge: 'Growth & Outreach',
    badgeBg: '#1e3a8a',
    badgeColor: '#93c5fd',
    summary:
      'Fast-track outreach queue designed to connect with targeted prospects with single-click WhatsApp Web launch and automatic status auditing.',
    details: [
      'Filters leads by contact readiness: targets having phone numbers and uncontacted status.',
      'Dynamic pitch template engine with variables: {name}, {city}, {rating}, {category}, {demo}.',
      'One-click WhatsApp dispatcher: opens pre-filled conversation, logs contacted timestamp, and advances to the next prospect.',
      'Batch management tools: select and delete invalid scraps, mass status updates, or wipe old database entries.',
    ],
  },
  {
    id: 'gemini-orchestration',
    category: 'skills',
    title: 'Multi-Model Gemini AI Orchestrator',
    badge: 'AI Core',
    badgeBg: '#312e81',
    badgeColor: '#c7d2fe',
    summary:
      'Resilient AI framework connecting to Google Gen AI with automatic failover between model tiers and persistent session memory.',
    details: [
      'Tiered model pool: gemini-3.5-flash-lite, gemini-3.6-flash, gemini-3.5-flash, gemini-3.1-flash-lite.',
      'Strict temperature 0.0 configuration for factual business intelligence and JSON structured output validation.',
      'Contextual agent sessions: memory persistence, customizable system prompt directives, and agent roles.',
      'Integrated Web Speech API dictation with intelligent duplicate word filtration.',
    ],
  },
  {
    id: 'vps-infrastructure',
    category: 'architecture',
    title: 'VPS Infrastructure & Docker Topology',
    badge: 'Contabo VPS',
    badgeBg: '#0f172a',
    badgeColor: '#94a3b8',
    summary:
      'Production server topology hosted at 173.212.224.70 running containerized microservices and automated management hooks.',
    details: [
      'Caddy Reverse Proxy: automatic TLS certificates, port 80/443 listener, upstream proxying to internal services.',
      'Directus CMS (Headless): centralized content repository, REST/GraphQL API, authenticated admin panel.',
      'PostgreSQL 16 & Redis 7: persistent transactional database (pg_data) and memory caching layer.',
      'Control Center API & Worker: containerized on port 4100 with host Docker socket mount for server metrics.',
      'Cloudflare Tunnel (cloudflared): zero-trust ingress securing management interfaces without exposed public ports.',
    ],
    codeSnippets: [
      {
        title: 'Check Running Containers on Host',
        code: 'ssh -p 2222 adminnico@173.212.224.70 "docker ps"',
      },
      {
        title: 'View Control Center API Health',
        code: 'curl -s http://127.0.0.1:4100/health',
      },
    ],
  },
  {
    id: 'backup-architecture',
    category: 'security',
    title: 'Dual-Layer Backup & Disaster Recovery Architecture',
    badge: 'Data Protection',
    badgeBg: '#422006',
    badgeColor: '#fde68a',
    summary:
      'High-availability disaster recovery scheme combining daily local tar archives on the VPS with encrypted offsite Google Drive storage.',
    details: [
      'Nightly Cron Schedule: triggers /home/adminnico/cms/scripts/backup.sh at 03:30 hs every day.',
      'Three-tier archive package: PostgreSQL dump (database.sql.gz) + Directus media uploads + secret env tokens.',
      'Encrypted Cloud Synchronization: uploaded via rclone to gcrypt:daily/ (AES-256 encrypted before leaving the VPS).',
      'Automated Retention Policy: 7 days kept on local VPS disk; 30 days retained on Google Drive.',
      'Management UI: select and delete temporary snapshots (pre-*), view cloud sync timestamps and total storage.',
    ],
    codeSnippets: [
      {
        title: 'Manual Backup Trigger Command',
        code: 'bash /home/adminnico/cms/scripts/backup.sh',
      },
      {
        title: 'Query Cloud Storage via rclone',
        code: 'rclone --config ~/.config/rclone/rclone.conf size gcrypt:daily/ --json',
      },
    ],
  },
  {
    id: 'client-demos-fleet',
    category: 'architecture',
    title: 'Vercel Client Demos Showcase Fleet',
    badge: 'Frontend Demos',
    badgeBg: '#172554',
    badgeColor: '#bfdbfe',
    summary:
      'Collection of deployed interactive client prototypes ready to pitch to prospective Argentine businesses.',
    details: [
      'Odontology & Dental Clinics: https://odontologia-ten.vercel.app',
      'Gyms & Crossfit Centers: https://gym-web-demo.vercel.app',
      'Pizzerias, Bars & Restaurants: https://pizzeria-demo.vercel.app',
      'Barber Shops & Salons: https://barberia-demo.vercel.app',
      'Aesthetics & Nail Spa: https://estetica-demo.vercel.app',
      'Real Estate & Properties: https://inmobiliaria-demo.vercel.app',
      'Fashion & Clothing Stores: https://indumentaria-demo.vercel.app',
    ],
  },
  {
    id: 'deployment-playbook',
    category: 'playbooks',
    title: 'Deployment & Continuous Delivery Playbook',
    badge: 'DevOps SOP',
    badgeBg: '#1e293b',
    badgeColor: '#cbd5e1',
    summary:
      'Step-by-step standard operating procedure for deploying updates across the web frontend and API microservices.',
    details: [
      'Web Frontend (control.nicoguzmandev.com): hosted on Vercel with automatic deployments upon git push to main.',
      'Control Center API: built with pnpm run build (node build.mjs) generating dist/server.js and dist/worker.js.',
      'Production API rollout: bundle transferred via scp to VPS, copied into control-center-api-1 container, followed by docker restart.',
      'Prisma ORM Migrations: applied against control-center-postgres-1 using prisma migrate deploy.',
    ],
    codeSnippets: [
      {
        title: 'Build and Deploy API Server',
        code: 'cd apps/api && pnpm run build\nscp -P 2222 dist/server.js adminnico@173.212.224.70:/tmp/server.js\nssh -p 2222 adminnico@173.212.224.70 "docker cp /tmp/server.js control-center-api-1:/app/dist/server.js && docker restart control-center-api-1"',
      },
    ],
  },
  {
    id: 'outreach-playbook',
    category: 'playbooks',
    title: 'Argentine B2B Outreach Best Practices',
    badge: 'Sales Strategy',
    badgeBg: '#052e16',
    badgeColor: '#4ade80',
    summary:
      'Tactical guidelines to maximize reply rates and prevent spam flags when messaging local businesses on WhatsApp.',
    details: [
      'Number Identity: Always use an Argentine SIM card (+54 9 ...) with a professional WhatsApp Business profile.',
      'First Impression: Never send cold generic templates. Mention their exact business name, rating, and city.',
      'Show, Don\'t Tell: Include a direct clickable link to their niche live demo (e.g. gym-web-demo.vercel.app).',
      'Soft Call to Action: Ask if they would like to review a custom proposal rather than asking for immediate payment.',
      'Pacing: Send messages in controlled batches (10 to 15 per hour) to maintain healthy account reputation.',
    ],
  },
  {
    id: 'disaster-restore-playbook',
    category: 'playbooks',
    title: 'CMS Disaster Recovery & Restore Playbook',
    badge: 'Disaster Recovery',
    badgeBg: '#450a0a',
    badgeColor: '#f87171',
    summary:
      'Standard operating procedure for restoring Directus CMS, PostgreSQL databases, and media volumes in case of data loss.',
    details: [
      'Identify target archive: locate latest cms-YYYYMMDD-HHMM.tar from /home/adminnico/cms/backups/ or Google Drive.',
      'Extract bundle: tar -xf cms-YYYYMMDD-HHMM.tar exposes database.sql.gz, uploads.tar.gz, and secrets.tar.gz.',
      'Database restoration: zcat database.sql.gz | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB.',
      'Media volume restoration: docker run --rm -v cms_directus_uploads:/data alpine tar -C /data -xzf - < uploads.tar.gz.',
      'Full documentation reference: maintained in /home/adminnico/cms/docs/RESTORE.md.',
    ],
    codeSnippets: [
      {
        title: 'Restore Database from Gzip SQL Dump',
        code: 'zcat database.sql.gz | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
      },
    ],
  },
];

export function KnowledgePage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = KNOWLEDGE_ITEMS.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.details.some((d) => d.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const copyCode = (code: string, id: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Knowledge Base & Neural Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Central repository of intelligence, agent skills, system architecture, operational SOPs, and recovery playbooks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <span
            style={{
              background: '#052e16',
              border: '1px solid #166534',
              color: '#4ade80',
              padding: '0.35rem 0.8rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            ACTIVE NEURAL CORE
          </span>
        </div>
      </div>

      {/* Hub Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Documented Skills</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {KNOWLEDGE_ITEMS.filter((i) => i.category === 'skills').length} Skills
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>Architecture Nodes</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
            {KNOWLEDGE_ITEMS.filter((i) => i.category === 'architecture').length} Topologies
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Standard SOPs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
            {KNOWLEDGE_ITEMS.filter((i) => i.category === 'playbooks').length} Playbooks
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#facc15', textTransform: 'uppercase', fontWeight: 600 }}>Backup Protocols</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15', marginTop: '0.2rem' }}>
            2-Layer Dual Sync
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Knowledge' },
            { id: 'skills', label: 'Skills & AI' },
            { id: 'architecture', label: 'Architecture & Nodes' },
            { id: 'playbooks', label: 'Playbooks & SOPs' },
            { id: 'security', label: 'Security & Backups' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: activeCategory === cat.id ? '#1e293b' : 'transparent',
                border: `1px solid ${activeCategory === cat.id ? '#3b82f6' : '#334155'}`,
                color: activeCategory === cat.id ? '#f8fafc' : '#94a3b8',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search skills, playbooks, architecture..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#f8fafc',
            borderRadius: '8px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.84rem',
            minWidth: '260px',
          }}
        />
      </div>

      {/* Knowledge Items Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {/* Item Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>{item.title}</h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  {item.summary}
                </p>
              </div>

              <span
                style={{
                  background: item.badgeBg,
                  color: item.badgeColor,
                  border: `1px solid ${item.badgeColor}33`,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.badge}
              </span>
            </div>

            {/* Bullet Details */}
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.83rem', lineHeight: 1.6 }}>
              {item.details.map((point, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>
                  {point}
                </li>
              ))}
            </ul>

            {/* Code Snippets */}
            {item.codeSnippets && item.codeSnippets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
                {item.codeSnippets.map((snippet, sIdx) => {
                  const copyKey = `${item.id}-${sIdx}`;
                  return (
                    <div
                      key={sIdx}
                      style={{
                        background: '#050811',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#0f172a',
                          borderBottom: '1px solid #1e293b',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          fontWeight: 600,
                        }}
                      >
                        <span>{snippet.title}</span>
                        <button
                          type="button"
                          onClick={() => copyCode(snippet.code, copyKey)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === copyKey ? '#4ade80' : '#60a5fa',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          {copiedId === copyKey ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '0.75rem 0.85rem',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: '#e2e8f0',
                          overflowX: 'auto',
                          lineHeight: 1.45,
                        }}
                      >
                        {snippet.code}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: '#0b0f19', borderRadius: '12px' }}>
            No knowledge entries matching &quot;{search}&quot;. Try another search term.
          </div>
        )}
      </div>
    </div>
  );
}
