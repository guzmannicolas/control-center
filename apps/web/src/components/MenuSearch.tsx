import { useState, useEffect } from 'react';
import { SearchIcon } from './Icons.tsx';
import { SearchModal } from './SearchModal.tsx';

interface MenuSearchProps {
  compact?: boolean;
  className?: string;
  onOpenStateChange?: (isOpen: boolean) => void;
}

export function MenuSearch({ compact = false, className = '', onOpenStateChange }: MenuSearchProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = () => {
    setIsOpen(true);
    onOpenStateChange?.(true);
  };

  const closeSearch = () => {
    setIsOpen(false);
    onOpenStateChange?.(false);
  };

  // Global keyboard shortcut: Ctrl+K or Cmd+K or / (when not focused on input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Check for '/' when not typing in an editable field
      if (
        e.key === '/' &&
        !['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase()) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openSearch}
          title="Search services (Ctrl+K)"
          aria-label="Search services"
          className={`flex size-10 items-center justify-center rounded-lg border border-line bg-surface/80 text-muted hover:border-series/50 hover:text-ink active:scale-95 transition ${className}`}
        >
          <SearchIcon size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          title="Quick search (Ctrl+K)"
          aria-label="Search services and navigation"
          className={`group flex w-full items-center justify-between rounded-lg border border-line bg-surface/70 px-2.5 py-1.5 text-xs text-muted hover:border-series/40 hover:bg-surface hover:text-ink transition active:scale-[0.99] ${className}`}
        >
          <div className="flex items-center gap-2 truncate">
            <SearchIcon size={14} className="text-muted group-hover:text-series transition" />
            <span className="truncate font-normal">Search services...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-line bg-page px-1.5 py-0.5 font-mono text-[10px] text-muted">
            <span className="text-[9px]">Ctrl</span> K
          </kbd>
        </button>
      )}

      <SearchModal isOpen={isOpen} onClose={closeSearch} />
    </>
  );
}
