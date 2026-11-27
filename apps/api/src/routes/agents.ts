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
import { getVaultSecretValue, upsertVaultItem, VAULT_PROJECT } from '../vault/vault.js';
import { deployVaultToDisk } from '../vault/audit.js';

function maskApiKey(secret: string | undefined): string | null {
  if (!secret || secret.length < 10) return null;
  if (secret.length <= 14) {
    return `${secret.slice(0, 4)}...${secret.slice(-3)}`;
  }
  return `${secret.slice(0, 10)}...${secret.slice(-6)}`;
}

function getAgentVaultConfig() {
  const geminiKey = getVaultSecretValue('GEMINI_API_KEY');
  const openrouterKey = getVaultSecretValue('OPENROUTER_API_KEY');
  const savedProvider = getVaultSecretValue('AGENT_DEFAULT_PROVIDER');
  const defaultProvider: 'gemini' | 'openrouter' =
    savedProvider === 'openrouter'
      ? 'openrouter'
      : savedProvider === 'gemini'
      ? 'gemini'
      : openrouterKey
      ? 'openrouter'
      : 'gemini';

  return {
    defaultProvider,
    geminiConfigured: Boolean(geminiKey),
    geminiMasked: maskApiKey(geminiKey),
    openrouterConfigured: Boolean(openrouterKey),
    openrouterMasked: maskApiKey(openrouterKey),
  };
}

export const agentRoutes: FastifyPluginAsync<{ prisma?: PrismaClient }> = async (app, opts) => {
  const { prisma } = opts;

  app.get('/agent/repos', async () => {
    const repos = await listAvailableRepos();
    return { repos };
  });

  app.get('/agent/config', async () => {
    return getAgentVaultConfig();
  });

  app.put('/agent/config', async (req, reply) => {
    const body = (req.body ?? {}) as {
      provider?: 'gemini' | 'openrouter';
      geminiApiKey?: string;
      openrouterApiKey?: string;
    };

    try {
      if (body.provider === 'gemini' || body.provider === 'openrouter') {
        upsertVaultItem({
          key: 'AGENT_DEFAULT_PROVIDER',
          value: body.provider,
          project: VAULT_PROJECT,
          description: 'Default AI Provider for Control Center Agent',
          isSecret: false,
        });
        process.env.AGENT_DEFAULT_PROVIDER = body.provider;
      }

      if (typeof body.openrouterApiKey === 'string' && body.openrouterApiKey.trim().length > 0) {
        const cleanOrKey = body.openrouterApiKey.trim();
        upsertVaultItem({
          key: 'OPENROUTER_API_KEY',
          value: cleanOrKey,
          project: VAULT_PROJECT,
          description: 'OpenRouter Multi-LLM API Key',
          isSecret: true,
        });
        process.env.OPENROUTER_API_KEY = cleanOrKey;
      }

      if (typeof body.geminiApiKey === 'string' && body.geminiApiKey.trim().length > 0) {
        const cleanGemKey = body.geminiApiKey.trim();
        upsertVaultItem({
          key: 'GEMINI_API_KEY',
          value: cleanGemKey,
          project: VAULT_PROJECT,
          description: 'Google Gemini API Key',
          isSecret: true,
        });
        process.env.GEMINI_API_KEY = cleanGemKey;
      }

      // Sync updated Vault variables to .env file on disk without restarting container mid-request
      try {
        await deployVaultToDisk(VAULT_PROJECT, false);
      } catch {
        // Ignore disk sync error in local dev environments
      }

      return getAgentVaultConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get('/agent/sessions', async () => {
    return { sessions: loadChatSessions() };
  });

  app.put('/agent/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<StoredChatSession>;
    const session: StoredChatSession = {
      id,
      title: body.title?.slice(0, 120) || 'Conversation',
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
    const apiKey =
      provider === 'openrouter'
        ? getVaultSecretValue('OPENROUTER_API_KEY')
        : getVaultSecretValue('GEMINI_API_KEY');

    if (!apiKey) {
      return reply.code(400).send({
        error: `No API Key is configured in the VPS Vault for '${provider}'. Please configure it in Agent Settings or in the Vault tab.`,
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
