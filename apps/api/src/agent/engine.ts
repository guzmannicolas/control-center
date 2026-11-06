import { GoogleGenAI, type Content, type FunctionDeclaration, Type } from '@google/genai';
import { executeTool, ensureRepoCloned, GENERAL_CONTEXT, type AgentToolCall } from './tools.js';

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

const FALLBACK_MODEL_POOL = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function* runAgentLoop(
  repo: string,
  instruction: string,
  apiKey: string,
  modelName = 'auto',
  priorHistory: ChatTurnMessage[] = []
): AsyncGenerator<AgentStepEvent> {
  const ai = new GoogleGenAI({ apiKey });
  const isGeneral = !repo || repo === GENERAL_CONTEXT;

  if (!isGeneral) {
    const cloneStatus = await ensureRepoCloned(repo);
    if (cloneStatus.error) {
      yield { type: 'error', content: `Failed to clone ${repo} from GitHub: ${cloneStatus.error}` };
      return;
    }
    if (cloneStatus.cloned) {
      yield { type: 'thought', content: `☁️ Repositorio 'guzmannicolas/${repo}' clonado desde GitHub al VPS.` };
    }
  }

  const systemInstruction = isGeneral
    ? `You are an autonomous senior DevOps and full-stack developer agent running on Nicolas Guzman's Linux VPS (Contabo).
Your working directory is '/home/adminnico/repositories', which contains all local repositories on the VPS.
You can inspect VPS system health (RAM via 'free -h', disk via 'df -h', CPU/uptime via 'uptime', processes, network, logs) using 'run_command', or inspect and work across any repository folder.
Respond in the same language as the user (Spanish by default). Be concise, structured, and helpful.`
    : `You are an autonomous senior developer agent operating inside the repository '${repo}' (/home/adminnico/repositories/${repo}) on Nicolas Guzman's Linux VPS.
You have access to tools to read, edit, write files, inspect directories, and run shell commands (including git, pnpm, etc.).
Always inspect existing code before modifying it. Respond in the same language as the user (Spanish by default).`;

  // Build ordered model list with user's choice first, then fallback pool
  const preferred = modelName === 'auto' || !modelName ? 'gemini-3.5-flash' : modelName;
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

    // Try models in pool; if all hit 429, wait and retry once
    for (let attempt = 0; attempt < modelPool.length + 2; attempt++) {
      const currentModel = modelPool[activeModelIdx % modelPool.length]!;
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
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        const isQuotaOrOverload =
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('quota');

        if (isQuotaOrOverload) {
          activeModelIdx++;
          const nextModel = modelPool[activeModelIdx % modelPool.length]!;
          // If we cycled through all models in the pool, pause before retrying
          if (attempt >= modelPool.length - 1) {
            yield {
              type: 'thought',
              content: `⏳ Límite de solicitudes por minuto alcanzado en el tier gratuito; esperando 10s y rotando a ${nextModel}...`,
            };
            await sleep(10_000);
          }
          continue;
        }
        // Non-retriable error
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

    // Process all function calls requested by the model in this turn
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
