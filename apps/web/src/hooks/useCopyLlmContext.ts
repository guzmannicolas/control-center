import { useState, useCallback } from 'react';
import { api } from '../api.ts';

export function useCopyLlmContext(defaultFallback?: () => string | undefined) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const copyContext = useCallback(
    async (fallbackParam?: string | unknown) => {
      setCopying(true);
      try {
        const res = await api.agentContext('all');
        const text = typeof res === 'string' ? res : res.context;
        await navigator.clipboard.writeText(text);
        setFeedback('System Context Copied!');
        setTimeout(() => setFeedback(null), 2500);
        return true;
      } catch {
        const customFallback = typeof fallbackParam === 'string' ? fallbackParam : defaultFallback?.();
        if (customFallback) {
          await navigator.clipboard.writeText(customFallback);
          setFeedback('Active Document Copied!');
          setTimeout(() => setFeedback(null), 2500);
          return true;
        }
        setFeedback('Failed to copy context');
        setTimeout(() => setFeedback(null), 2500);
        return false;
      } finally {
        setCopying(false);
      }
    },
    [defaultFallback]
  );

  return { copyContext, feedback, copying, setFeedback };
}
