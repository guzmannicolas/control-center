import type { PrismaClient } from '../generated/prisma/client.js';
import { calculateLlmCost } from './pricing.js';

export interface RecordTraceInput {
  provider?: string;
  model: string;
  caller: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
  status: 'ok' | 'error' | 'fallback';
  errorMessage?: string | null;
  promptPreview?: string | null;
  responsePreview?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Safely persists an LLM invocation trace asynchronously.
 * Never throws or interrupts application execution if persistence fails.
 */
export async function recordLlmTrace(
  prisma: PrismaClient,
  input: RecordTraceInput
): Promise<void> {
  try {
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const costUsd = calculateLlmCost(input.model, promptTokens, completionTokens);

    await prisma.llmTrace.create({
      data: {
        provider: input.provider ?? 'gemini',
        model: input.model,
        caller: input.caller,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        durationMs: Math.max(0, Math.round(input.durationMs)),
        status: input.status,
        errorMessage: input.errorMessage ? input.errorMessage.slice(0, 1000) : null,
        promptPreview: input.promptPreview ? input.promptPreview.slice(0, 2000) : null,
        responsePreview: input.responsePreview ? input.responsePreview.slice(0, 2000) : null,
        metadata: (input.metadata ?? {}) as any,
      },
    });
  } catch (err) {
    // Non-blocking telemetry fallback
    console.error('[Telemetry] Failed to record LLM trace:', err);
  }
}
