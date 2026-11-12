import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FunctionsCatalogResult, ProjectFunctionItem } from '@cc/shared';
import fallbackCatalog from '../catalog/functions-catalog.json';
import { api } from '../api.ts';
import { useClipboard } from '../hooks/useClipboard.ts';

const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Backend API (@cc/api)': { bg: '#172554', text: '#93c5fd', border: '#1e40af' },
  'Frontend Web (@cc/web)': { bg: '#042f2e', text: '#5eead4', border: '#0f766e' },
  'Shared Contracts (@cc/shared)': { bg: '#2e1065', text: '#d8b4fe', border: '#6b21a8' },
  'Automation Scripts': { bg: '#451a03', text: '#fdba74', border: '#9a3412' },
  'Root & Tooling': { bg: '#1f2937', text: '#9ca3af', border: '#374151' },
};

export function ProjectFunctionsView() {
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hideTests, setHideTests] = useState<boolean>(true);
  const [onlyExported, setOnlyExported] = useState<boolean>(false);
  const [onlyRoutes, setOnlyRoutes] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 40;

  const { copiedId, copy } = useClipboard(2000);
  const { copiedId: copiedListId, copy: copyList } = useClipboard(2500);

  const { data, isLoading, error } = useQuery<FunctionsCatalogResult>({
    queryKey: ['knowledgeFunctions'],
    queryFn: () => api.knowledgeFunctions(),
    initialData: fallbackCatalog as unknown as FunctionsCatalogResult,
  });

  const allFunctions = data?.functions ?? [];

  // Extract unique categories for filter
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const fn of allFunctions) {
      if (selectedModule === 'all' || fn.module === selectedModule) {
        cats.add(fn.category);
      }
    }
    return Array.from(cats).sort();
  }, [allFunctions, selectedModule]);

  // Filter functions
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFunctions.filter((fn) => {
      if (hideTests && fn.isTest) return false;
      if (selectedModule !== 'all' && fn.module !== selectedModule) return false;
      if (selectedCategory !== 'all' && fn.category !== selectedCategory) return false;
      if (onlyExported && !fn.exported) return false;
      if (onlyRoutes && fn.kind !== 'route-handler') return false;

      if (q) {
        const inName = fn.name.toLowerCase().includes(q);
        const inFile = fn.file.toLowerCase().includes(q);
        const inParams = fn.params.toLowerCase().includes(q);
        const inCategory = fn.category.toLowerCase().includes(q);
        if (!inName && !inFile && !inParams && !inCategory) return false;
      }
      return true;
    });
  }, [allFunctions, search, selectedModule, selectedCategory, hideTests, onlyExported, onlyRoutes]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedFunctions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Counts for summary metrics
  const totalCount = allFunctions.length;
  const backendCount = allFunctions.filter((f) => f.module.includes('Backend API')).length;
  const frontendCount = allFunctions.filter((f) => f.module.includes('Frontend Web')).length;
  const sharedCount = allFunctions.filter((f) => f.module.includes('Shared Contracts')).length;
  const routeCount = allFunctions.filter((f) => f.kind === 'route-handler').length;

  const handleCopyFilteredSummary = () => {
    const summary = filtered
      .map((f) => `- [${f.module}] ${f.name}(${f.params}) -> ${f.file}:${f.line} [${f.category}]`)
      .join('\n');
    const header = `# Control Center Functions Catalog (${filtered.length} functions)\n\n`;
    copyList('all', header + summary);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>Project Functions & Endpoints Catalog</span>
            <span
              style={{
                fontSize: '0.74rem',
                background: '#3b0764',
                color: '#e9d5ff',
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #7e22ce',
                fontWeight: 600,
              }}
            >
              AST Canonical Index
            </span>
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem', color: '#94a3b8' }}>
            Comprehensive AST inventory of all functions, handlers, routes, components, and hooks across the Control Center monorepo.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyFilteredSummary}
          style={{
            background: copiedListId === 'all' ? '#065f46' : '#1e3a8a',
            border: `1px solid ${copiedListId === 'all' ? '#10b981' : '#3b82f6'}`,
            color: copiedListId === 'all' ? '#6ee7b7' : '#93c5fd',
            borderRadius: '8px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {copiedListId === 'all' ? 'Copied Functions to Clipboard!' : `Copy Filtered List (${filtered.length}) for LLM`}
        </button>
      </div>

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Functions</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {totalCount} Discovered
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 600 }}>Backend API (@cc/api)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#93c5fd', marginTop: '0.2rem' }}>
            {backendCount} Functions
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#5eead4', textTransform: 'uppercase', fontWeight: 600 }}>Frontend Web (@cc/web)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#5eead4', marginTop: '0.2rem' }}>
            {frontendCount} Functions
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#d8b4fe', textTransform: 'uppercase', fontWeight: 600 }}>Fastify Endpoints</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d8b4fe', marginTop: '0.2rem' }}>
            {routeCount} Routes
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#fcd34d', textTransform: 'uppercase', fontWeight: 600 }}>Shared Contracts</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fcd34d', marginTop: '0.2rem' }}>
            {sharedCount} Pure Utilities
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#0b0f19',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        {/* Search input and category dropdown */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search functions by name, parameter, file path, or category..."
              style={{
                width: '100%',
                background: '#050811',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '0.55rem 0.85rem',
                fontSize: '0.85rem',
                color: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            style={{
              background: '#050811',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.55rem 0.85rem',
              fontSize: '0.84rem',
              color: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories ({filtered.length})</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Module filter pills & flags */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginRight: '0.2rem' }}>Module:</span>
            {[
              { id: 'all', label: 'All Modules' },
              { id: 'Backend API (@cc/api)', label: 'Backend API' },
              { id: 'Frontend Web (@cc/web)', label: 'Frontend Web' },
              { id: 'Shared Contracts (@cc/shared)', label: 'Shared Contracts' },
              { id: 'Automation Scripts', label: 'Scripts' },
            ].map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setSelectedModule(mod.id);
                  setSelectedCategory('all');
                  setPage(1);
                }}
                style={{
                  background: selectedModule === mod.id ? '#1e293b' : 'transparent',
                  border: `1px solid ${selectedModule === mod.id ? '#3b82f6' : '#334155'}`,
                  color: selectedModule === mod.id ? '#f8fafc' : '#94a3b8',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {mod.label}
              </button>
            ))}
          </div>

          {/* Quick Filter Toggles */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideTests}
                onChange={(e) => {
                  setHideTests(e.target.checked);
                  setPage(1);
                }}
                style={{ cursor: 'pointer' }}
              />
              Hide Tests
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyExported}
                onChange={(e) => {
                  setOnlyExported(e.target.checked);
                  setPage(1);
                }}
                style={{ cursor: 'pointer' }}
              />
              Exported Only
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyRoutes}
                onChange={(e) => {
                  setOnlyRoutes(e.target.checked);
                  setPage(1);
                }}
                style={{ cursor: 'pointer' }}
              />
              Routes Only
            </label>
          </div>
        </div>
      </div>

      {/* Results Header and Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
        <div>
          Showing <span style={{ color: '#f8fafc', fontWeight: 600 }}>{filtered.length}</span> functions
          {filtered.length > pageSize && (
            <span>
              {' '}(Page {currentPage} of {totalPages})
            </span>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                background: currentPage <= 1 ? '#0f172a' : '#1e293b',
                border: '1px solid #334155',
                color: currentPage <= 1 ? '#475569' : '#cbd5e1',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.76rem',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.78rem', color: '#cbd5e1', padding: '0 0.3rem' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                background: currentPage >= totalPages ? '#0f172a' : '#1e293b',
                border: '1px solid #334155',
                color: currentPage >= totalPages ? '#475569' : '#cbd5e1',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.76rem',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>
          Loading functions catalog from Knowledge Base engine...
        </div>
      )}

      {error && !isLoading && allFunctions.length === 0 && (
        <div style={{ padding: '1rem', background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
          Unable to fetch real-time function catalog from API.
        </div>
      )}

      {/* Functions Grid / List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {paginatedFunctions.map((fn, idx) => {
          const modStyle = MODULE_COLORS[fn.module] ?? { bg: '#1e293b', text: '#cbd5e1', border: '#334155' };
          const itemKey = `${fn.file}:${fn.line}:${fn.name}:${idx}`;
          const isCopied = copiedId === itemKey;

          return (
            <div
              key={itemKey}
              style={{
                background: '#0b0f19',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                transition: 'border-color 0.15s ease',
              }}
            >
              {/* Function Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 350px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: fn.kind === 'route-handler' ? '#38bdf8' : '#f8fafc',
                    }}
                  >
                    {fn.name}
                  </span>

                  {/* Signature parameter */}
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8' }}>
                    ({fn.params})
                  </span>

                  {/* Kind Pill */}
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: fn.kind === 'route-handler' ? '#0369a1' : '#1e293b',
                      color: fn.kind === 'route-handler' ? '#e0f2fe' : '#94a3b8',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {fn.kind}
                  </span>

                  {/* Async indicator */}
                  {fn.async && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#701a75',
                        color: '#f5d0fe',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      async
                    </span>
                  )}

                  {/* Exported indicator */}
                  {fn.exported && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#064e3b',
                        color: '#a7f3d0',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      export
                    </span>
                  )}

                  {/* Test indicator */}
                  {fn.isTest && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#374151',
                        color: '#d1d5db',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      test
                    </span>
                  )}
                </div>

                {/* File path and category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.76rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                    {fn.file}:{fn.line}
                  </span>
                  <span>-</span>
                  <span style={{ color: '#cbd5e1' }}>{fn.category}</span>
                </div>
              </div>

              {/* Module Pill & Copy Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: modStyle.bg,
                    color: modStyle.text,
                    border: `1px solid ${modStyle.border}`,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fn.module}
                </span>

                <button
                  type="button"
                  onClick={() => copy(itemKey, `${fn.file}#L${fn.line}`)}
                  style={{
                    background: isCopied ? '#065f46' : '#1e293b',
                    border: `1px solid ${isCopied ? '#10b981' : '#334155'}`,
                    color: isCopied ? '#6ee7b7' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCopied ? 'Copied' : 'Copy Ref'}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && !isLoading && (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              background: '#0b0f19',
              border: '1px dashed #334155',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '0.88rem',
            }}
          >
            No functions found matching the current search filters.
          </div>
        )}
      </div>
    </div>
  );
}
