import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '../generated/prisma/client.js';
import { runAgentLoop, type ChatTurnMessage } from '../agent/engine.js';
import {
  GENERAL_CONTEXT,
  listAvailableRepos,
  loadChatSessions,
  upsertChatSession,
  deleteChatSession,
  type StoredChatSession,
} from '../agent/tools.js';

export const agentRoutes: FastifyPluginAsync<{ prisma?: PrismaClient }> = async (app, opts) => {
  const { prisma } = opts;
  app.get('/agent/repos', async () => {
    const repos = await listAvailableRepos();
    return { repos };
  });

  app.get('/agent/sessions', async () => {
    return { sessions: loadChatSessions() };
  });

  app.put('/agent/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<StoredChatSession>;
    const session: StoredChatSession = {
      id,
      title: body.title?.slice(0, 120) || 'Conversación',
      repo: body.repo || GENERAL_CONTEXT,
      model: body.model || 'auto',
      updatedAt: new Date().toISOString(),
      messages: Array.isArray(body.messages) ? body.messages : [],
    };
    return { sessions: upsertChatSession(session) };
  });

  app.delete('/agent/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { sessions: deleteChatSession(id) };
  });

  app.post('/agent/run', async (req, reply) => {
    const body = req.body as {
      repo?: string;
      instruction?: string;
      apiKey?: string;
      provider?: 'gemini' | 'openrouter';
      model?: string;
      history?: ChatTurnMessage[];
    };
    const repo = body.repo?.trim() || GENERAL_CONTEXT;
    const instruction = body.instruction?.trim() || '';

    if (!instruction) {
      return reply.code(400).send({ error: 'Instruction is required' });
    }

    const provider = body.provider || 'gemini';
    const serverApiKey = provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY
      : process.env.GEMINI_API_KEY;

    const apiKey = (body.apiKey && body.apiKey.trim().length > 0)
      ? body.apiKey.trim()
      : serverApiKey;

    if (!apiKey) {
      return reply.code(400).send({
        error: `No hay una API Key configurada para '${provider}'. Por favor ingresá tu API Key en los ajustes o definila en las variables de entorno.`,
      });
    }

    // Inform Fastify that we take manual control of writing the raw response,
    // which prevents Fastify hooks (e.g. onSend) from running and crashing the stream.
    reply.hijack();

    const origin = req.headers.origin || 'https://control.nicoguzmandev.com';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });

    try {
      const history = Array.isArray(body.history) ? body.history : [];
      for await (const event of runAgentLoop({
        repo,
        instruction,
        apiKey,
        provider,
        modelName: body.model || 'auto',
        priorHistory: history,
        prisma,
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });
};
