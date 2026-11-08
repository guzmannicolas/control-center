import { listKnowledgeDocs, readKnowledgeDoc, getSystemContext } from './manager.js';

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

export function handleMcpRequest(req: McpJsonRpcRequest): McpJsonRpcResponse {
  const { id = null, method, params = {} } = req;

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
              version: '1.0.0',
            },
          },
        };
      }

      case 'notifications/initialized': {
        return { jsonrpc: '2.0', id, result: {} };
      }

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

        return {
          jsonrpc: '2.0',
          id,
          result: { resources },
        };
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
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: doc.content,
              },
            ],
          },
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_system_context',
                description:
                  'Returns consolidated system knowledge, VPS architecture, database schema, and operational guidelines for AI agents.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    topics: {
                      type: 'array',
                      items: { type: 'string' },
                      description:
                        'Optional topic slugs or categories to filter, e.g. ["architecture", "database-schema", "skills"] or ["all"].',
                    },
                  },
                },
              },
              {
                name: 'read_knowledge_doc',
                description:
                  'Reads a specific markdown knowledge document by its slug (e.g. "architecture", "skills/maps-scraper", "playbooks/deployment").',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      description: 'The slug or path of the document without .md extension.',
                    },
                  },
                  required: ['path'],
                },
              },
            ],
          },
        };
      }

      case 'tools/call': {
        const toolName = String(params.name || '');
        const args = (params.arguments as Record<string, unknown>) || {};

        if (toolName === 'get_system_context') {
          const topicsArray = Array.isArray(args.topics) ? (args.topics as string[]).join(',') : undefined;
          const context = getSystemContext(topicsArray);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: context }],
            },
          };
        }

        if (toolName === 'read_knowledge_doc') {
          const docPath = String(args.path || args.slug || '');
          if (!docPath) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing document path parameter' },
            };
          }

          const doc = readKnowledgeDoc(docPath);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: doc.content }],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
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
    const message = err instanceof Error ? err.message : String(err);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message },
    };
  }
}
