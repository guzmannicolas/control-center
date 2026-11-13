import type { FastifyPluginAsync } from 'fastify';
import { getOrRunDailyRepoGraph, getFunctionsCatalog } from '../knowledge/analyzer.js';
import {
  listKnowledgeDocs,
  readKnowledgeDoc,
  writeKnowledgeDoc,
  getSystemContext,
} from '../knowledge/manager.js';
import { handleMcpRequest } from '../knowledge/mcp.js';
import { dispatchMcpRequest, type McpJsonRpcRequest } from '../mcp/dispatcher.js';

export const knowledgeRoutes: FastifyPluginAsync = async (app) => {
  // Knowledge Base & Repository Graph routes
  app.get('/knowledge/graph', async () => {
    return getOrRunDailyRepoGraph(false);
  });

  app.post('/knowledge/graph/analyze', async () => {
    return getOrRunDailyRepoGraph(true);
  });

  app.get('/knowledge/functions', async () => {
    return getFunctionsCatalog();
  });

  // Knowledge Base & Agent Context routes
  app.get('/knowledge', async () => {
    return listKnowledgeDocs();
  });

  app.get('/knowledge/*', async (req, reply) => {
    const slug = (req.params as Record<string, string>)['*'];
    if (!slug) {
      return reply.code(400).send({ error: 'Missing document slug' });
    }
    try {
      const doc = readKnowledgeDoc(slug);
      const query = req.query as { raw?: string; format?: string };
      if (query.raw === 'true' || req.headers.accept === 'text/plain' || req.headers.accept === 'text/markdown') {
        reply.header('content-type', 'text/markdown; charset=utf-8');
        return reply.send(doc.content);
      }
      return doc;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(404).send({ error: msg });
    }
  });

  app.put('/knowledge/*', async (req, reply) => {
    const slug = (req.params as Record<string, string>)['*'];
    if (!slug) {
      return reply.code(400).send({ error: 'Missing document slug' });
    }

    let content: string | undefined;
    if (typeof req.body === 'string') {
      content = req.body;
    } else if (req.body && typeof req.body === 'object' && 'content' in req.body) {
      content = String((req.body as { content: unknown }).content);
    }

    if (content === undefined) {
      return reply.code(400).send({ error: 'Document content is required' });
    }

    try {
      const meta = writeKnowledgeDoc(slug, content);
      return { ok: true, meta };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get('/agent/context', async (req, reply) => {
    const query = req.query as { topic?: string; format?: string };
    const topics = query.topic || 'all';
    const markdownContext = getSystemContext(topics);

    if (query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return { topic: topics, context: markdownContext };
    }

    reply.header('content-type', 'text/markdown; charset=utf-8');
    return reply.send(markdownContext);
  });

  app.post('/mcp', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    try {
      const client = (req as any).mcpClient || {
        id: 'master-token',
        name: 'Master Admin (.env)',
        role: 'admin',
        enabled: true,
        rateLimitPerMinute: 300,
      };
      const ip = req.ip || '127.0.0.1';
      const body = req.body as McpJsonRpcRequest;
      const response = await dispatchMcpRequest(body, { client, ip });
      return response;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: msg },
      });
    }
  });
};
