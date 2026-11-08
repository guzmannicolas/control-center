#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const CANDIDATE_ROOTS = [
  process.env.KNOWLEDGE_DIR,
  resolve(process.cwd(), 'knowledge'),
  resolve(process.cwd(), '../knowledge'),
  resolve(process.cwd(), '../../knowledge'),
  '/home/adminnico/control-center/knowledge',
  '/app/knowledge',
].filter(Boolean);

function getKnowledgeBaseDir() {
  for (const root of CANDIDATE_ROOTS) {
    if (existsSync(root)) return root;
  }
  return resolve(process.cwd(), 'knowledge');
}

function extractTitle(content, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  return match && match[1] ? match[1].trim() : fallback;
}

function sanitizeSlug(rawSlug) {
  const cleaned = rawSlug.replace(/^\/+/, '').replace(/\.md$/, '').trim();
  if (cleaned.includes('..') || /[<>:"\\|?*]/.test(cleaned)) {
    throw new Error('Invalid document slug');
  }
  return cleaned;
}

function listKnowledgeDocs() {
  const baseDir = getKnowledgeBaseDir();
  if (!existsSync(baseDir)) return [];
  const results = [];

  function walk(currentDir) {
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
        } catch {}
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

function readKnowledgeDoc(rawSlug) {
  const slug = sanitizeSlug(rawSlug);
  const baseDir = getKnowledgeBaseDir();
  const filePath = join(baseDir, `${slug}.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Knowledge document "${slug}" not found`);
  }

  const content = readFileSync(filePath, 'utf8');
  return { slug, content };
}

function getSystemContext(topicsQuery) {
  const allDocs = listKnowledgeDocs();
  if (allDocs.length === 0) return '# System Knowledge Base\n\nNo documentation found.';

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
    if (selectedDocs.length === 0) selectedDocs = allDocs;
  }

  const sections = [
    '# Control Center — Agentic System Context & Knowledge Base',
    `Generated: ${new Date().toISOString()}`,
    'Target Host: Contabo VPS (173.212.224.70:2222) · Reverse Proxy: Caddy · Stack: Directus CMS + Fastify Control Center',
    '---',
  ];

  for (const doc of selectedDocs) {
    try {
      const { content } = readKnowledgeDoc(doc.slug);
      sections.push(`\n<!-- BEGIN KNOWLEDGE DOC: ${doc.slug} -->\n${content.trim()}\n<!-- END KNOWLEDGE DOC: ${doc.slug} -->\n`);
    } catch {}
  }

  return sections.join('\n\n');
}

function handleRequest(req) {
  const { id = null, method, params = {} } = req;
  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              resources: { subscribe: false, listChanged: false },
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'control-center-knowledge-mcp',
              version: '1.0.0',
            },
          },
        };

      case 'notifications/initialized':
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'resources/list': {
        const docs = listKnowledgeDocs();
        const resources = docs.map((doc) => ({
          uri: `knowledge://${doc.slug}`,
          name: doc.title,
          description: `Knowledge documentation for ${doc.category}: ${doc.title}`,
          mimeType: 'text/markdown',
        }));
        return { jsonrpc: '2.0', id, result: { resources } };
      }

      case 'resources/read': {
        const uri = String(params.uri || '');
        if (!uri.startsWith('knowledge://')) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unsupported URI: ${uri}` } };
        }
        const slug = uri.replace(/^knowledge:\/\//, '');
        const doc = readKnowledgeDoc(slug);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [{ uri, mimeType: 'text/markdown', text: doc.content }],
          },
        };
      }

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_system_context',
                description:
                  'Returns consolidated system knowledge, VPS architecture, database schema, and operational guidelines.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    topics: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Optional topics or categories, e.g. ["architecture", "skills"] or ["all"].',
                    },
                  },
                },
              },
              {
                name: 'read_knowledge_doc',
                description: 'Reads a specific markdown knowledge document by its slug.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'The document slug without .md extension.' },
                  },
                  required: ['path'],
                },
              },
            ],
          },
        };

      case 'tools/call': {
        const toolName = String(params.name || '');
        const args = params.arguments || {};

        if (toolName === 'get_system_context') {
          const topicsArray = Array.isArray(args.topics) ? args.topics.join(',') : undefined;
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: getSystemContext(topicsArray) }] },
          };
        }

        if (toolName === 'read_knowledge_doc') {
          const docPath = String(args.path || args.slug || '');
          const doc = readKnowledgeDoc(docPath);
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: doc.content }] },
          };
        }

        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
      }

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err) {
    return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message || String(err) } };
  }
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const parsed = JSON.parse(line);
    const response = handleRequest(parsed);
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error', data: err.message },
      }) + '\n'
    );
  }
});
