#!/usr/bin/env node
import { createInterface } from 'node:readline';
import {
  getKnowledgeBaseDir,
  listKnowledgeDocs,
  readKnowledgeDoc,
  getSystemContext,
} from '../apps/api/src/knowledge/manager.ts';

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
