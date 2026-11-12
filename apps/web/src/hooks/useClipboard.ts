import { useState, useCallback } from 'react';

export function useClipboard(timeoutMs = 2500) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(
    async (id: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => {
          setCopiedId((curr) => (curr === id ? null : curr));
        }, timeoutMs);
        return true;
      } catch {
        return false;
      }
    },
    [timeoutMs]
  );

  return {
    copiedId,
    isCopied: (id: string) => copiedId === id,
    copy,
    setCopiedId,
  };
}
