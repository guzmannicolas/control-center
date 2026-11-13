import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  McpServerRecord,
  McpServerLiveView,
  McpTelemetryOverview,
  McpToolCallLog,
  McpToolSchema,
  McpResourceSchema,
} from '@cc/shared';
import { handleMcpRequest, type McpJsonRpcResponse } from '../knowledge/mcp.js';

const STORAGE_PATH =
  process.env.MCP_REGISTRY_FILE ||
  (process.env.VAULT_STORAGE_FILE
    ? join(dirname(process.env.VAULT_STORAGE_FILE), 'mcp_servers.json')
    : join(process.cwd(), 'data', 'mcp_servers.json'));

const BUILTIN_SERVER_ID = 'builtin-control-center';

function getBuiltInServer(): McpServerRecord {
  const token = process.env.MCP_API_TOKEN || '';
  const now = new Date().toISOString();
  return {
    id: BUILTIN_SERVER_ID,
    name: 'Control Center Knowledge & Context',
    description: 'Core JSON-RPC 2.0 MCP server exposing VPS architecture, live knowledge docs, and system context.',
    type: 'http-jsonrpc',
    url: process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/api/mcp` : 'https://control-api.nicoguzmandev.com/api/mcp',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    enabled: true,
    isBuiltIn: true,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: now,
  };
}

// In-memory ring buffer for recent tool call telemetry
const RECENT_CALLS_MAX = 100;
const callHistory: McpToolCallLog[] = [];

export function recordToolCall(log: McpToolCallLog): void {
  callHistory.unshift(log);
  if (callHistory.length > RECENT_CALLS_MAX) {
    callHistory.pop();
  }
}

export function getCallHistory(): McpToolCallLog[] {
  return [...callHistory];
}

export function loadServers(): McpServerRecord[] {
  try {
    if (!existsSync(STORAGE_PATH)) {
      const initial = [getBuiltInServer()];
      saveServers(initial);
      return initial;
    }
    const raw = readFileSync(STORAGE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as McpServerRecord[];
    if (!Array.isArray(parsed)) {
      return [getBuiltInServer()];
    }

    // Ensure built-in server is always present
    const hasBuiltIn = parsed.some((s) => s.id === BUILTIN_SERVER_ID);
    if (!hasBuiltIn) {
      parsed.unshift(getBuiltInServer());
      saveServers(parsed);
    } else {
      // Keep builtin server token in sync with current env
      const idx = parsed.findIndex((s) => s.id === BUILTIN_SERVER_ID);
      const bServer = parsed[idx];
      if (idx !== -1 && process.env.MCP_API_TOKEN && bServer) {
        bServer.headers = {
          ...(bServer.headers || {}),
          Authorization: `Bearer ${process.env.MCP_API_TOKEN}`,
        };
      }
    }
    return parsed;
  } catch (err) {
    console.error('[mcp-hub] Failed to load servers from storage:', err);
    return [getBuiltInServer()];
  }
}

export function saveServers(servers: McpServerRecord[]): void {
  try {
    const dir = dirname(STORAGE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(STORAGE_PATH, JSON.stringify(servers, null, 2), 'utf-8');
  } catch (err) {
    console.error('[mcp-hub] Failed to save servers:', err);
    throw err;
  }
}

export async function probeServer(server: McpServerRecord): Promise<McpServerLiveView> {
  const baseView: McpServerLiveView = {
    ...server,
    status: 'offline',
    latencyMs: null,
    tools: [],
    resources: [],
    lastCheckedAt: new Date().toISOString(),
    errorMessage: null,
  };

  if (!server.enabled) {
    baseView.status = 'offline';
    baseView.errorMessage = 'Server is disabled';
    return baseView;
  }

  // Built-in shortcut when targeting local control center
  const isBuiltIn = server.id === BUILTIN_SERVER_ID;

  if (server.type === 'http-jsonrpc') {
    if (!server.url) {
      baseView.errorMessage = 'Missing endpoint URL';
      return baseView;
    }

    const start = Date.now();
    try {
      // 1. Initialize check
      const initPayload = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'control-center-mcp-hub', version: '1.0.0' },
        },
      };

      let initRes: McpJsonRpcResponse;
      if (isBuiltIn && !process.env.FORCE_MCP_REMOTE_PROBE) {
        // Direct in-process execution for local built-in server (instant latency)
        initRes = handleMcpRequest(initPayload);
      } else {
        const res = await fetch(server.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(server.headers || {}),
          },
          body: JSON.stringify(initPayload),
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        initRes = (await res.json()) as McpJsonRpcResponse;
      }

      const elapsed = Date.now() - start;
      baseView.latencyMs = elapsed;

      const initResult = initRes.result as {
        protocolVersion?: string;
        serverInfo?: { name: string; version: string };
      } | undefined;

      baseView.protocolVersion = initResult?.protocolVersion || '2024-11-05';
      baseView.serverInfo = initResult?.serverInfo;

      // 2. Fetch Tools List
      const toolsPayload = { jsonrpc: '2.0' as const, id: 2, method: 'tools/list', params: {} };
      let toolsRes: McpJsonRpcResponse;
      if (isBuiltIn && !process.env.FORCE_MCP_REMOTE_PROBE) {
        toolsRes = handleMcpRequest(toolsPayload);
      } else {
        const res = await fetch(server.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(server.headers || {}),
          },
          body: JSON.stringify(toolsPayload),
          signal: AbortSignal.timeout(4000),
        });
        toolsRes = (await res.json()) as McpJsonRpcResponse;
      }

      if (toolsRes?.result && typeof toolsRes.result === 'object' && 'tools' in toolsRes.result) {
        baseView.tools = (toolsRes.result as { tools: McpToolSchema[] }).tools || [];
      }

      // 3. Fetch Resources List (optional)
      try {
        const resPayload = { jsonrpc: '2.0' as const, id: 3, method: 'resources/list', params: {} };
        let resRes: McpJsonRpcResponse;
        if (isBuiltIn && !process.env.FORCE_MCP_REMOTE_PROBE) {
          resRes = handleMcpRequest(resPayload);
        } else {
          const res = await fetch(server.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(server.headers || {}),
            },
            body: JSON.stringify(resPayload),
            signal: AbortSignal.timeout(3000),
          });
          resRes = (await res.json()) as McpJsonRpcResponse;
        }

        if (resRes?.result && typeof resRes.result === 'object' && 'resources' in resRes.result) {
          baseView.resources = (resRes.result as { resources: McpResourceSchema[] }).resources || [];
        }
      } catch {
        // Resources list optional
      }

      baseView.status = elapsed > 2500 ? 'degraded' : 'online';
      return baseView;
    } catch (err: unknown) {
      baseView.latencyMs = Date.now() - start;
      baseView.status = 'offline';
      baseView.errorMessage = err instanceof Error ? err.message : String(err);
      return baseView;
    }
  }

  if (server.type === 'sse') {
    if (!server.url) {
      baseView.errorMessage = 'Missing SSE endpoint URL';
      return baseView;
    }
    const start = Date.now();
    try {
      const res = await fetch(server.url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', ...(server.headers || {}) },
        signal: AbortSignal.timeout(3000),
      });
      baseView.latencyMs = Date.now() - start;
      if (res.ok) {
        baseView.status = 'online';
        baseView.protocolVersion = 'sse-v1';
      } else {
        baseView.status = 'offline';
        baseView.errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      }
    } catch (err: unknown) {
      baseView.latencyMs = Date.now() - start;
      baseView.status = 'offline';
      baseView.errorMessage = err instanceof Error ? err.message : String(err);
    }
    return baseView;
  }

  if (server.type === 'stdio') {
    baseView.status = 'online';
    baseView.protocolVersion = 'stdio';
    baseView.serverInfo = { name: server.command || 'stdio-process', version: 'local' };
    return baseView;
  }

  return baseView;
}

export async function executeMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<{ ok: boolean; result?: unknown; error?: string; latencyMs: number }> {
  const servers = loadServers();
  const server = servers.find((s) => s.id === serverId);
  if (!server) {
    throw new Error(`MCP server "${serverId}" not found in registry`);
  }

  const start = Date.now();
  let isError = false;
  let responseData: unknown = null;
  let errorMessage: string | null = null;

  try {
    const isBuiltIn = server.id === BUILTIN_SERVER_ID;
    const rpcPayload = {
      jsonrpc: '2.0' as const,
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    if (isBuiltIn && !process.env.FORCE_MCP_REMOTE_PROBE) {
      const res = handleMcpRequest(rpcPayload);
      if (res.error) {
        isError = true;
        errorMessage = res.error.message;
        responseData = res.error;
      } else {
        responseData = res.result;
      }
    } else {
      if (!server.url) {
        throw new Error('Server URL not configured');
      }

      const res = await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(server.headers || {}),
        },
        body: JSON.stringify(rpcPayload),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as McpJsonRpcResponse;
      if (json.error) {
        isError = true;
        errorMessage = json.error.message;
        responseData = json.error;
      } else {
        responseData = json.result;
      }
    }

    const latencyMs = Date.now() - start;

    // Record telemetry log
    recordToolCall({
      id: randomUUID(),
      serverId: server.id,
      serverName: server.name,
      toolName,
      arguments: args,
      responsePreview: JSON.stringify(responseData || errorMessage).slice(0, 1000),
      isError,
      latencyMs,
      calledAt: new Date().toISOString(),
    });

    if (isError) {
      return { ok: false, error: errorMessage || 'MCP Tool execution error', latencyMs };
    }

    return { ok: true, result: responseData, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    recordToolCall({
      id: randomUUID(),
      serverId: server.id,
      serverName: server.name,
      toolName,
      arguments: args,
      responsePreview: `Error: ${msg}`,
      isError: true,
      latencyMs,
      calledAt: new Date().toISOString(),
    });

    return { ok: false, error: msg, latencyMs };
  }
}

export async function getMcpOverview(): Promise<{
  servers: McpServerLiveView[];
  summary: McpTelemetryOverview;
}> {
  const servers = loadServers();
  const liveViews = await Promise.all(servers.map((s) => probeServer(s)));

  const activeCount = liveViews.filter((s) => s.status === 'online').length;
  const totalTools = liveViews.reduce((sum, s) => sum + s.tools.length, 0);

  const history = getCallHistory();
  const totalCalls = history.length;
  const errorCalls = history.filter((c) => c.isError).length;
  const errorRatePercent = totalCalls > 0 ? Math.round((errorCalls / totalCalls) * 100) : 0;
  const avgLatencyMs =
    totalCalls > 0 ? Math.round(history.reduce((sum, c) => sum + c.latencyMs, 0) / totalCalls) : 0;

  return {
    servers: liveViews,
    summary: {
      totalServers: liveViews.length,
      activeServers: activeCount,
      totalTools,
      totalCalls,
      errorRatePercent,
      avgLatencyMs,
      recentCalls: history.slice(0, 20),
    },
  };
}

export function generateClientConfigs(): {
  cursor: Record<string, unknown>;
  claude: Record<string, unknown>;
  antigravity: Record<string, unknown>;
  vscode: Record<string, unknown>;
} {
  const servers = loadServers().filter((s) => s.enabled);
  const token = process.env.MCP_API_TOKEN || '';

  // Cursor format (.cursor/mcp.json)
  const cursorMcpServers: Record<string, unknown> = {};
  // Claude Desktop format (claude_desktop_config.json)
  const claudeMcpServers: Record<string, unknown> = {};
  // Antigravity format
  const antigravityMcpServers: Record<string, unknown> = {};

  for (const s of servers) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');

    if (s.type === 'http-jsonrpc' || s.type === 'sse') {
      const url = s.url || 'https://control-api.nicoguzmandev.com/api/mcp';
      const headers = s.headers || (token ? { Authorization: `Bearer ${token}` } : {});

      cursorMcpServers[slug] = {
        url,
        headers,
      };

      claudeMcpServers[slug] = {
        command: 'npx',
        args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${token}`],
      };

      antigravityMcpServers[slug] = {
        type: 'http',
        url,
        headers,
      };
    } else if (s.type === 'stdio') {
      const entry = {
        command: s.command || 'node',
        args: s.args || [],
        env: s.env || {},
      };
      cursorMcpServers[slug] = entry;
      claudeMcpServers[slug] = entry;
      antigravityMcpServers[slug] = entry;
    }
  }

  return {
    cursor: { mcpServers: cursorMcpServers },
    claude: { mcpServers: claudeMcpServers },
    antigravity: { mcpServers: antigravityMcpServers },
    vscode: { 'mcp.servers': cursorMcpServers },
  };
}
