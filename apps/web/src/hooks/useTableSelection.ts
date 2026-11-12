import { useState, useCallback } from 'react';

export function useTableSelection<T = string>(initialSet?: Set<T>) {
  const [selected, setSelected] = useState<Set<T>>(initialSet ?? new Set<T>());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: T[]) => {
    setSelected((prev) => {
      if (prev.size === allIds.length && allIds.length > 0) {
        return new Set<T>();
      }
      return new Set<T>(allIds);
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set<T>()), []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  return {
    selected,
    size: selected.size,
    toggle,
    toggleAll,
    clear,
    isSelected,
    setSelected,
  };
}
