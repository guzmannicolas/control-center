import { GoogleGenAI, type FunctionDeclaration, Type } from '@google/genai';
import { executeTool, type AgentToolCall } from './tools.js';

export interface AgentStepEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
}

export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'read_file',
    description: 'Read the text content of a file in the repository.',
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
    description: 'List files and directories in a repository path.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Relative path to directory (empty for root)' },
      },
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command inside the repository directory (e.g. git status, pnpm test, ls).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: 'Shell command string to execute' },
      },
      required: ['command'],
    },
  },
];

export async function* runAgentLoop(
  repo: string,
  instruction: string,
  apiKey: string,
  modelName = 'gemini-3.5-flash'
): AsyncGenerator<AgentStepEvent> {
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an autonomous senior developer agent operating inside the repository '${repo}' on a Linux VPS.
You have access to tools to read, edit, write files, inspect directories, and run commands.
Always inspect existing code before modifying it. Test your changes whenever possible using run_command.
Work methodically. Once the task is fully accomplished, provide a concise summary of what was done.`;

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
      temperature: 0.2,
    },
  });

  yield { type: 'thought', content: `Starting agent task in ${repo}...` };

  let currentMessage: any = instruction;
  let turns = 0;
  const MAX_TURNS = 20;

  while (turns < MAX_TURNS) {
    turns++;
    let response;
    try {
      response = await chat.sendMessage({ message: currentMessage });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: 'error', content: `Model error: ${msg}` };
      return;
    }

    const text = response.text;
    if (text) {
      yield { type: 'thought', content: text };
    }

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      yield { type: 'final', content: text ?? 'Task completed.' };
      return;
    }

    // Process all function calls requested by the model in this turn
    const functionResponses = [];
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

      functionResponses.push({
        functionResponse: {
          name: callName,
          response: { output: result.output },
        },
      });
    }

    currentMessage = functionResponses;
  }

  yield { type: 'error', content: 'Agent reached maximum execution turns limit (20).' };
}
