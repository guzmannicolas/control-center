import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchIndex } from '../search/useSearchIndex.ts';
import type { SearchCategory, SearchResult, SearchItemStatus } from '../search/types.ts';
import { navigate } from '../router.tsx';
import { SearchIcon, CloseIcon, OverviewIcon } from './Icons.tsx';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: Array<SearchCategory | 'All'> = [
  'All',
  'Services',
  'Containers',
  'Navigation',
  'Databases',
  'Domains',
  'Tools & MCP',
];

function StatusIndicator({ status }: { status?: SearchItemStatus }) {
  if (!status) return null;

  let colorClass = 'bg-neutral-500';
  let label = status;

  if (status === 'ok' || status === 'running' || status === 'online') {
    colorClass = 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]';
  } else if (status === 'warn' || status === 'degraded') {
    colorClass = 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]';
  } else if (status === 'fail' || status === 'exited' || status === 'offline') {
    colorClass = 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]';
  }

  return (
    <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted">
      <span className={`size-2 rounded-full ${colorClass}`} />
      <span>{label}</span>
    </span>
  );
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | 'All'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const { search, categoryCounts, isLoading } = useSearchIndex();

  const results: SearchResult[] = useMemo(() => {
    return search(query, {
      categoryFilter: selectedCategory,
      limit: 40,
    });
  }, [search, query, selectedCategory]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
      setSelectedCategory('All');
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex].item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelect = (item: SearchResult['item']) => {
    onClose();
    if (item.path) {
      navigate(item.path);
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-12 sm:pt-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Services and Navigation"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-page text-ink shadow-2xl transition-all"
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-line bg-surface px-4 py-3">
          <SearchIcon size={18} className="text-muted shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, containers, databases, tools, or navigation..."
            className="w-full bg-transparent text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-muted hover:text-ink transition"
              aria-label="Clear query"
            >
              <CloseIcon />
            </button>
          ) : (
            <span className="rounded border border-line bg-page px-1.5 py-0.5 text-[10px] font-mono text-muted">
              ESC
            </span>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line/60 bg-surface/50 px-4 py-2 text-xs">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  isSelected
                    ? 'bg-series text-white shadow-sm'
                    : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-line/40 text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div
          ref={resultsContainerRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-line/40"
        >
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              {isLoading ? 'Indexing services...' : `No matching services or items found for "${query}"`}
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              const { item } = res;
              const IconComponent = item.icon || OverviewIcon;

              return (
                <div
                  key={item.id}
                  data-active={isSelected ? 'true' : 'false'}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer text-xs transition ${
                    isSelected
                      ? 'bg-series/15 text-ink ring-1 ring-series/40'
                      : 'hover:bg-surface text-ink-2 hover:text-ink'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-line ${
                        isSelected ? 'bg-series text-white' : 'bg-surface text-muted group-hover:text-ink'
                      }`}
                    >
                      <IconComponent size={15} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink truncate">{item.title}</span>
                        <span className="rounded bg-line/40 px-1.5 py-0.5 text-[9px] font-mono text-muted uppercase">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="mt-0.5 text-[11px] text-muted truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusIndicator status={item.status} />
                    {item.path && (
                      <span className="hidden sm:inline font-mono text-[10px] text-muted truncate max-w-[120px]">
                        {item.path}
                      </span>
                    )}
                    <span className="text-[11px] text-muted font-mono">↵</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-line bg-surface/80 px-4 py-2 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-line bg-page px-1 py-0.5 font-mono text-[10px]">↑</kbd>
              <kbd className="ml-1 rounded border border-line bg-page px-1 py-0.5 font-mono text-[10px]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-line bg-page px-1 py-0.5 font-mono text-[10px]">↵</kbd> to open
            </span>
          </div>
          <span>{results.length} item(s) found</span>
        </div>
      </div>
    </div>
  );
}
