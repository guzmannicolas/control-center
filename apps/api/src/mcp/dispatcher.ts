import type { McpToolContext } from './types.js';
import { mcpToolRegistry } from './registry.js';
import { mcpAuditLogger } from './audit.js';
import { listKnowledgeDocs, readKnowledgeDoc } from '../knowledge/manager.js';

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export async function dispatchMcpRequest(
  req: McpJsonRpcRequest,
  ctx: McpToolContext
): Promise<McpJsonRpcResponse> {
  const { id = null, method, params = {} } = req;
  const startTime = Date.now();
  let toolName: string | undefined;
  let status: 'ok' | 'error' = 'ok';

  try {
    switch (method) {
      case 'initialize': {
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
              version: '1.1.0',
            },
          },
        };
      }

      case 'notifications/initialized':
      case 'ping': {
        return { jsonrpc: '2.0', id, result: {} };
      }

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
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unsupported URI scheme: ${uri}` },
          };
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

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: mcpToolRegistry.getTools() },
        };
      }

      case 'tools/call': {
        toolName = String(params.name || '');
        const args = (params.arguments as Record<string, unknown>) || {};
        const result = await mcpToolRegistry.executeTool(toolName, args, ctx);
        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      }

      default: {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
    }
  } catch (err: unknown) {
    status = 'error';
    const message = err instanceof Error ? err.message : String(err);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message },
    };
  } finally {
    const durationMs = Date.now() - startTime;
    void mcpAuditLogger.logAccess({
      clientId: ctx.client.id,
      clientName: ctx.client.name,
      ip: ctx.ip,
      method,
      toolName,
      status,
      durationMs,
      details: toolName ? { params } : undefined,
    });
  }
}
