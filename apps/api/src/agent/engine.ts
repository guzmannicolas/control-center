import { GoogleGenAI, type Content, type FunctionDeclaration, Type } from '@google/genai';
import { executeTool, ensureRepoCloned, GENERAL_CONTEXT, type AgentToolCall } from './tools.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { recordLlmTrace } from '../observability/telemetry.js';

export interface AgentStepEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
}

export interface ChatTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RunAgentOptions {
  repo: string;
  instruction: string;
  apiKey?: string;
  provider?: 'gemini' | 'openrouter';
  modelName?: string;
  priorHistory?: ChatTurnMessage[];
  prisma?: PrismaClient;
}

const FALLBACK_MODEL_POOL = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
];

export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'read_file',
    description: 'Read the text content of a file.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to the file' },
        content: { type: Type.STRING, description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace an exact target snippet in a file with a replacement snippet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to the file' },
        target: { type: Type.STRING, description: 'Exact string to be replaced' },
        replacement: { type: Type.STRING, description: 'Replacement string' },
      },
      required: ['path', 'target', 'replacement'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a path (use empty string for root).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to directory (empty for root)' },
      },
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command on the VPS (e.g. git status, free -h, df -h, uptime, ls, pnpm test).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: 'Shell command string to execute' },
      },
      required: ['command'],
    },
  },
];

// OpenRouter JSON Schema formatted tools
const OPENROUTER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the text content of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace an exact target snippet in a file with a replacement snippet.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
          target: { type: 'string', description: 'Exact string to be replaced' },
          replacement: { type: 'string', description: 'Replacement string' },
        },
        required: ['path', 'target', 'replacement'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories in a path (use empty string for root).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to directory (empty for root)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command on the VPS (e.g. git status, free -h, df -h, uptime, ls, pnpm test).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command string to execute' },
        },
        required: ['command'],
      },
    },
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildSystemInstruction(repo: string, isGeneral: boolean): string {
  return isGeneral
    ? `You are an autonomous senior DevOps and full-stack developer agent running on Nicolas Guzman's Linux VPS (Contabo).
Your working directory is '/home/adminnico', and all git repositories live in '/home/adminnico/repositories'.
IMPORTANT CAPABILITIES IN THIS ENVIRONMENT:
1. You have FULL Docker CLI access via '/var/run/docker.sock': you can run 'docker ps', 'docker system df', 'docker images', 'docker logs <container>', 'docker stats --no-stream', etc.
2. The entire VPS host root filesystem '/' is mounted read-only at '/host', and '/home/adminnico' is mounted read-write at '/home/adminnico'.
   - To inspect VPS disk space and what consumes the most storage, run: 'df -h /host', 'docker system df', 'du -xh --max-depth=1 /host 2>/dev/null | sort -hr', and 'du -xh --max-depth=2 /home/adminnico 2>/dev/null | sort -hr'.
3. You can also inspect RAM/swap ('free -h'), CPU/uptime ('uptime'), and work across any repository inside '/home/adminnico/repositories'.
Respond in the same language as the user (Spanish by default). Be concise, structured, and helpful.`
    : `You are an autonomous senior developer agent operating inside the repository '${repo}' (/home/adminnico/repositories/${repo}) on Nicolas Guzman's Linux VPS.
You have access to tools to read, edit, write files, inspect directories, and run shell commands (including git, docker, pnpm, etc.).
Always inspect existing code before modifying it. Respond in the same language as the user (Spanish by default).`;
}

// OpenRouter Runner
async function* runOpenRouterLoop(
  repo: string,
  instruction: string,
  apiKey: string,
  modelName: string,
  priorHistory: ChatTurnMessage[],
  systemInstruction: string
): AsyncGenerator<AgentStepEvent> {
  const chosenModel = modelName && modelName !== 'auto' ? modelName : 'meta-llama/llama-3.3-70b-instruct';

  interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemInstruction },
  ];

  for (const h of priorHistory.slice(-12)) {
    if (h.text?.trim()) {
      messages.push({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text,
      });
    }
  }

  messages.push({
    role: 'user',
    content: instruction,
  });

  let turns = 0;
  const MAX_TURNS = 25;

  while (turns < MAX_TURNS) {
    turns++;
    let responseData: any = null;

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://control.nicoguzmandev.com',
          'X-Title': 'Control Center Agent',
        },
        body: JSON.stringify({
          model: chosenModel,
          messages,
          tools: OPENROUTER_TOOLS,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        yield { type: 'error', content: `OpenRouter error (${res.status}): ${errorText}` };
        return;
      }

      responseData = await res.json();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', content: `OpenRouter network error: ${msg}` };
      return;
    }

    const choice = responseData?.choices?.[0];
    const assistantMsg = choice?.message;

    if (!assistantMsg) {
      yield { type: 'error', content: 'Respuesta vacía de OpenRouter' };
      return;
    }

    messages.push(assistantMsg);

    const textContent = assistantMsg.content;
    const toolCalls = assistantMsg.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      yield { type: 'final', content: typeof textContent === 'string' ? textContent : 'Tarea completada.' };
      return;
    }

    if (textContent && typeof textContent === 'string') {
      yield { type: 'thought', content: textContent };
    }

    for (const call of toolCalls) {
      const callName = call.function.name;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}');
      } catch {
        parsedArgs = {};
      }

      const toolCall: AgentToolCall = {
        id: call.id,
        name: callName,
        args: parsedArgs,
      };

      yield {
        type: 'tool_call',
        content: `Executing ${callName}`,
        toolName: callName,
        toolArgs: toolCall.args,
      };

      const result = await executeTool(repo, toolCall);

      yield {
        type: 'tool_result',
        content: `Result of ${callName}`,
        toolName: callName,
        toolOutput: result.output,
      };

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result.output,
      });
    }
  }

  yield { type: 'error', content: 'El agente alcanzó el límite máximo de pasos por turno (25).' };
}

// Gemini Runner
async function* runGeminiLoop(
  repo: string,
  instruction: string,
  apiKey: string,
  modelName: string,
  priorHistory: ChatTurnMessage[],
  systemInstruction: string,
  prisma?: PrismaClient
): AsyncGenerator<AgentStepEvent> {
  const ai = new GoogleGenAI({ apiKey });

  const preferred = modelName === 'auto' || !modelName ? 'gemini-2.5-flash' : modelName;
  const modelPool = [preferred, ...FALLBACK_MODEL_POOL.filter((m) => m !== preferred)];
  let activeModelIdx = 0;

  const contents: Content[] = [];
  for (const h of priorHistory.slice(-12)) {
    if (h.text?.trim()) {
      contents.push({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: instruction }],
  });

  let turns = 0;
  const MAX_TURNS = 25;

  while (turns < MAX_TURNS) {
    turns++;
    let response = null;
    let lastError = '';

    for (let attempt = 0; attempt < modelPool.length + 2; attempt++) {
      const currentModel = modelPool[activeModelIdx % modelPool.length]!;
      const startTime = Date.now();
      try {
        response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
            temperature: 0.2,
          },
        });
        const durationMs = Date.now() - startTime;
        if (prisma) {
          void recordLlmTrace(prisma, {
            provider: 'gemini',
            model: currentModel,
            caller: 'agent',
            promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            durationMs,
            status: 'ok',
            promptPreview: instruction.slice(0, 500),
            responsePreview: response.text ? response.text.slice(0, 500) : null,
            metadata: { repo, turn: turns },
          });
        }
        break;
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        const isQuotaOrOverload =
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('quota');

        if (prisma) {
          void recordLlmTrace(prisma, {
            provider: 'gemini',
            model: currentModel,
            caller: 'agent',
            durationMs,
            status: isQuotaOrOverload ? 'fallback' : 'error',
            errorMessage: msg,
            promptPreview: instruction.slice(0, 500),
            metadata: { repo, turn: turns, attempt },
          });
        }

        if (isQuotaOrOverload) {
          activeModelIdx++;
          const nextModel = modelPool[activeModelIdx % modelPool.length]!;
          if (attempt >= modelPool.length - 1) {
            yield {
              type: 'thought',
              content: `[Rate Limit] Limite de solicitudes alcanzado; esperando 10s y rotando a ${nextModel}...`,
            };
            await sleep(10_000);
          }
          continue;
        }
        yield { type: 'error', content: `Model error (${currentModel}): ${msg}` };
        return;
      }
    }

    if (!response) {
      yield { type: 'error', content: `Model error after retries: ${lastError}` };
      return;
    }

    const candidateContent = response.candidates?.[0]?.content;
    if (candidateContent) {
      contents.push(candidateContent);
    }

    const text = response.text;
    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      yield { type: 'final', content: text ?? 'Tarea completada.' };
      return;
    }

    if (text) {
      yield { type: 'thought', content: text };
    }

    const responseParts = [];
    for (const call of functionCalls) {
      const callName = call.name ?? 'unknown_tool';
      const toolCall: AgentToolCall = {
        id: call.id ?? callName,
        name: callName,
        args: (call.args as Record<string, unknown>) ?? {},
      };

      yield {
        type: 'tool_call',
        content: `Executing ${callName}`,
        toolName: callName,
        toolArgs: toolCall.args,
      };

      const result = await executeTool(repo, toolCall);

      yield {
        type: 'tool_result',
        content: `Result of ${callName}`,
        toolName: callName,
        toolOutput: result.output,
      };

      responseParts.push({
        functionResponse: {
          name: callName,
          response: { output: result.output },
        },
      });
    }

    contents.push({
      role: 'user',
      parts: responseParts,
    });
  }

  yield { type: 'error', content: 'El agente alcanzó el límite máximo de pasos por turno (25).' };
}

export async function* runAgentLoop(options: RunAgentOptions): AsyncGenerator<AgentStepEvent> {
  const {
    repo,
    instruction,
    apiKey,
    provider = 'gemini',
    modelName = 'auto',
    priorHistory = [],
    prisma,
  } = options;

  const isGeneral = !repo || repo === GENERAL_CONTEXT;

  if (!isGeneral) {
    const cloneStatus = await ensureRepoCloned(repo);
    if (cloneStatus.error) {
      yield { type: 'error', content: `Failed to clone ${repo} from GitHub: ${cloneStatus.error}` };
      return;
    }
    if (cloneStatus.cloned) {
      yield { type: 'thought', content: `[Git] Repositorio 'guzmannicolas/${repo}' clonado desde GitHub al VPS.` };
    }
  }

  const systemInstruction = buildSystemInstruction(repo, isGeneral);

  if (!apiKey) {
    yield { type: 'error', content: `Falta configurar la API Key para el proveedor '${provider}'.` };
    return;
  }

  if (provider === 'openrouter') {
    yield* runOpenRouterLoop(repo, instruction, apiKey, modelName, priorHistory, systemInstruction);
  } else {
    yield* runGeminiLoop(repo, instruction, apiKey, modelName, priorHistory, systemInstruction, prisma);
  }
}
