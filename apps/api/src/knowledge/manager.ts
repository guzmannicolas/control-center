import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

export interface KnowledgeDocMeta {
  slug: string;
  category: string;
  title: string;
  relativePath: string;
  sizeBytes: number;
  lastModified: string;
}

const CANDIDATE_ROOTS = [
  process.env.KNOWLEDGE_DIR,
  resolve(process.cwd(), 'knowledge'),
  resolve(process.cwd(), '../../knowledge'),
  resolve(process.cwd(), '../knowledge'),
  '/home/adminnico/control-center/knowledge',
  '/app/knowledge',
].filter((p): p is string => Boolean(p));

export function getKnowledgeBaseDir(): string {
  for (const root of CANDIDATE_ROOTS) {
    if (existsSync(root)) return root;
  }
  // Default to relative knowledge directory
  const fallback = resolve(process.cwd(), 'knowledge');
  if (!existsSync(fallback)) {
    try {
      mkdirSync(fallback, { recursive: true });
    } catch {
      // Ignore
    }
  }
  return fallback;
}

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
}

export function sanitizeSlug(rawSlug: string): string {
  const cleaned = rawSlug.replace(/^\/+/, '').replace(/\.md$/, '').trim();
  if (cleaned.includes('..') || /[<>:"\\|?*]/.test(cleaned)) {
    throw new Error('Invalid document slug');
  }
  return cleaned;
}

export function listKnowledgeDocs(): KnowledgeDocMeta[] {
  const baseDir = getKnowledgeBaseDir();
  if (!existsSync(baseDir)) return [];

  const results: KnowledgeDocMeta[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stats = statSync(fullPath);
          const rel = relative(baseDir, fullPath).replace(/\\/g, '/');
          const slug = rel.replace(/\.md$/, '');
          const content = readFileSync(fullPath, 'utf8');
          const title = extractTitle(content, entry.name.replace(/\.md$/, ''));

          let category = 'core';
          if (slug.startsWith('skills/')) category = 'skills';
          else if (slug.startsWith('playbooks/')) category = 'playbooks';
          else if (slug === 'architecture') category = 'architecture';
          else if (slug === 'database-schema') category = 'database';

          results.push({
            slug,
            category,
            title,
            relativePath: rel,
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
          });
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  walk(baseDir);
  return results.sort((a, b) => {
    if (a.slug === 'index') return -1;
    if (b.slug === 'index') return 1;
    return a.slug.localeCompare(b.slug);
  });
}

export function readKnowledgeDoc(rawSlug: string): { slug: string; content: string; meta: KnowledgeDocMeta } {
  const slug = sanitizeSlug(rawSlug);
  const baseDir = getKnowledgeBaseDir();
  const filePath = join(baseDir, `${slug}.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Knowledge document "${slug}" not found`);
  }

  const content = readFileSync(filePath, 'utf8');
  const stats = statSync(filePath);
  const rel = relative(baseDir, filePath).replace(/\\/g, '/');
  const title = extractTitle(content, slug);

  let category = 'core';
  if (slug.startsWith('skills/')) category = 'skills';
  else if (slug.startsWith('playbooks/')) category = 'playbooks';
  else if (slug === 'architecture') category = 'architecture';
  else if (slug === 'database-schema') category = 'database';

  return {
    slug,
    content,
    meta: {
      slug,
      category,
      title,
      relativePath: rel,
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    },
  };
}

export function writeKnowledgeDoc(rawSlug: string, content: string): KnowledgeDocMeta {
  const slug = sanitizeSlug(rawSlug);
  const baseDir = getKnowledgeBaseDir();
  const filePath = join(baseDir, `${slug}.md`);

  const parent = dirname(filePath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  writeFileSync(filePath, content, 'utf8');
  const stats = statSync(filePath);
  const title = extractTitle(content, slug);

  let category = 'core';
  if (slug.startsWith('skills/')) category = 'skills';
  else if (slug.startsWith('playbooks/')) category = 'playbooks';
  else if (slug === 'architecture') category = 'architecture';
  else if (slug === 'database-schema') category = 'database';

  return {
    slug,
    category,
    title,
    relativePath: relative(baseDir, filePath).replace(/\\/g, '/'),
    sizeBytes: stats.size,
    lastModified: stats.mtime.toISOString(),
  };
}

export function getSystemContext(topicsQuery?: string): string {
  const allDocs = listKnowledgeDocs();
  if (allDocs.length === 0) {
    return '# System Knowledge Base\n\nNo documentation found.';
  }

  let selectedDocs = allDocs;
  if (topicsQuery && topicsQuery !== 'all') {
    const requested = topicsQuery.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    selectedDocs = allDocs.filter((doc) => {
      return requested.some(
        (req) =>
          doc.slug.toLowerCase().includes(req) ||
          doc.category.toLowerCase() === req ||
          doc.title.toLowerCase().includes(req)
      );
    });
    if (selectedDocs.length === 0) {
      selectedDocs = allDocs;
    }
  }

  const sections: string[] = [
    '# Control Center — Agentic System Context & Knowledge Base',
    `Generated: ${new Date().toISOString()}`,
    'Target Host: Contabo VPS (173.212.224.70:2222) · Reverse Proxy: Caddy · Stack: Directus CMS + Fastify Control Center',
    '---',
  ];

  for (const doc of selectedDocs) {
    try {
      const { content } = readKnowledgeDoc(doc.slug);
      sections.push(`\n<!-- BEGIN KNOWLEDGE DOC: ${doc.slug} -->\n${content.trim()}\n<!-- END KNOWLEDGE DOC: ${doc.slug} -->\n`);
    } catch {
      // Continue
    }
  }

  return sections.join('\n\n');
}
