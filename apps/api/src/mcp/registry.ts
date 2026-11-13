import type { IMcpToolRegistry, McpToolDefinition, McpToolContext } from './types.js';
import { getSystemContext, readKnowledgeDoc } from '../knowledge/manager.js';

export class McpToolRegistry implements IMcpToolRegistry {
  private tools = new Map<string, McpToolDefinition<any, any>>();

  constructor() {
    this.registerBuiltinTools();
  }

  registerTool(tool: McpToolDefinition<any, any>): void {
    this.tools.set(tool.name, tool);
  }

  getTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async executeTool(name: string, args: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered`);
    }
    return tool.execute(args, ctx);
  }

  private registerBuiltinTools(): void {
    // 1. get_system_context
    this.registerTool({
      name: 'get_system_context',
      description: 'Returns consolidated system knowledge, VPS architecture, database schema, and operational guidelines.',
      inputSchema: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional topic slugs or categories to filter, e.g. ["architecture", "database-schema", "skills"] or ["all"].',
          },
        },
      },
      execute: (args: { topics?: string[] }) => {
        const topicsStr = Array.isArray(args.topics) ? args.topics.join(',') : undefined;
        return { content: [{ type: 'text', text: getSystemContext(topicsStr) }] };
      },
    });

    // 2. read_knowledge_doc
    this.registerTool({
      name: 'read_knowledge_doc',
      description: 'Reads a specific markdown knowledge document by its slug.',
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
      execute: (args: { path?: string; slug?: string }) => {
        const docPath = String(args.path || args.slug || '');
        if (!docPath) {
          throw new Error('Document path parameter is required');
        }
        const doc = readKnowledgeDoc(docPath);
        return { content: [{ type: 'text', text: doc.content }] };
      },
    });
  }
}

export const mcpToolRegistry = new McpToolRegistry();
