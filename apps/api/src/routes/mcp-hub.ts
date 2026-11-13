import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { McpServerRecord } from '@cc/shared';
import {
  loadServers,
  saveServers,
  probeServer,
  getMcpOverview,
  executeMcpTool,
  generateClientConfigs,
} from '../mcp/hub.js';
import { mcpAuthenticator } from '../mcp/auth.js';
import { mcpAuditLogger } from '../mcp/audit.js';

export const mcpHubRoutes: FastifyPluginAsync = async (app) => {
  // Observability & Server List
  app.get('/mcp/servers', async () => {
    return getMcpOverview();
  });

  // Collaborator Token Management
  app.get('/mcp/tokens', async () => {
    return mcpAuthenticator.listTokens();
  });

  app.post('/mcp/tokens', async (req, reply) => {
    const body = (req.body || {}) as {
      name?: string;
      role?: 'admin' | 'collaborator' | 'read-only';
      rateLimit?: number;
    };
    if (!body.name?.trim()) {
      return reply.code(400).send({ error: 'Token name is required' });
    }
    const result = await mcpAuthenticator.createToken(body.name, body.role, body.rateLimit);
    return reply.code(201).send(result);
  });

  app.delete('/mcp/tokens/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await mcpAuthenticator.revokeToken(id);
    if (!ok) return reply.code(404).send({ error: 'Token not found' });
    return { ok: true, revokedId: id };
  });

  // Real-Time Audit Logs & Client Stats
  app.get('/mcp/audit', async (req) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const [recentLogs, clientStats] = await Promise.all([
      mcpAuditLogger.getRecentLogs(limit),
      mcpAuditLogger.getClientStats(),
    ]);
    return { recentLogs, clientStats };
  });

  // Client configuration snippets
  app.get('/mcp/configs', async () => {
    return generateClientConfigs();
  });

  // Force probe / ping a specific server
  app.post('/mcp/servers/:id/ping', async (req, reply) => {
    const { id } = req.params as { id: string };
    const servers = loadServers();
    const server = servers.find((s) => s.id === id);
    if (!server) {
      return reply.code(404).send({ error: `MCP server "${id}" not found` });
    }
    const liveView = await probeServer(server);
    return liveView;
  });

  // Execute a tool interactively
  app.post('/mcp/servers/:id/call', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { toolName?: string; arguments?: Record<string, unknown> };

    if (!body.toolName) {
      return reply.code(400).send({ error: 'toolName parameter is required' });
    }

    try {
      const result = await executeMcpTool(id, body.toolName, body.arguments || {});
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ ok: false, error: msg });
    }
  });

  // Create new MCP server
  app.post('/mcp/servers', async (req, reply) => {
    const body = req.body as Partial<McpServerRecord>;
    if (!body.name || !body.type) {
      return reply.code(400).send({ error: 'name and type are required' });
    }

    const servers = loadServers();
    const now = new Date().toISOString();
    const newServer: McpServerRecord = {
      id: randomUUID(),
      name: body.name.trim(),
      description: body.description?.trim() || '',
      type: body.type,
      url: body.url?.trim(),
      command: body.command?.trim(),
      args: Array.isArray(body.args) ? body.args : [],
      env: body.env || {},
      headers: body.headers || {},
      enabled: body.enabled !== false,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };

    servers.push(newServer);
    saveServers(servers);

    // Initial probe
    const liveView = await probeServer(newServer);
    return reply.code(201).send(liveView);
  });

  // Update existing MCP server
  app.put('/mcp/servers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<McpServerRecord>;

    const servers = loadServers();
    const index = servers.findIndex((s) => s.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: `MCP server "${id}" not found` });
    }

    const existing = servers[index]!;
    const updated: McpServerRecord = {
      id: existing.id,
      name: body.name !== undefined ? body.name.trim() : existing.name,
      description: body.description !== undefined ? body.description.trim() : existing.description,
      type: existing.isBuiltIn ? existing.type : (body.type || existing.type),
      url: body.url !== undefined ? body.url.trim() : existing.url,
      command: body.command !== undefined ? body.command.trim() : existing.command,
      args: body.args !== undefined && Array.isArray(body.args) ? body.args : existing.args,
      headers: body.headers !== undefined ? body.headers : existing.headers,
      env: body.env !== undefined ? body.env : existing.env,
      enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
      isBuiltIn: existing.isBuiltIn,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    servers[index] = updated;
    saveServers(servers);

    const liveView = await probeServer(updated);
    return liveView;
  });

  // Delete MCP server
  app.delete('/mcp/servers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const servers = loadServers();
    const target = servers.find((s) => s.id === id);

    if (!target) {
      return reply.code(404).send({ error: `MCP server "${id}" not found` });
    }

    if (target.isBuiltIn) {
      return reply.code(400).send({ error: 'Cannot delete the built-in Control Center MCP server' });
    }

    const filtered = servers.filter((s) => s.id !== id);
    saveServers(filtered);

    return { ok: true, id };
  });
};
