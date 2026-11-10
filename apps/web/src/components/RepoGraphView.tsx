import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RepoAnalysisResult, RepoGraphNode, RepoGraphEdge } from '@cc/shared';
import { api } from '../api.ts';
import { ago } from '../format.ts';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  app: { bg: '#f43f5e', border: '#fda4af', text: '#ffe4e6' },
  infrastructure: { bg: '#0284c7', border: '#7dd3fc', text: '#e0f2fe' },
  database: { bg: '#059669', border: '#6ee7b7', text: '#d1fae5' },
  module: { bg: '#d97706', border: '#fcd34d', text: '#fef3c7' },
  service: { bg: '#7c3aed', border: '#c4b5fd', text: '#ede9fe' },
  external: { bg: '#9333ea', border: '#d8b4fe', text: '#f3e8ff' },
};

// Fixed positions arranged in a balanced constellation for high readability
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Center Core
  'app-api': { x: 480, y: 320 },
  'pkg-shared': { x: 480, y: 190 },
  'knowledge-base': { x: 480, y: 460 },
  'mcp-server': { x: 300, y: 460 },

  // Left: Ingress & Frontend
  'app-web': { x: 230, y: 220 },
  'caddy-proxy': { x: 230, y: 320 },
  'ext-cloudflare': { x: 70, y: 320 },
  'ext-ai-agents': { x: 120, y: 460 },

  // Right: Databases & Background Queue
  'db-postgres': { x: 740, y: 240 },
  'db-redis': { x: 740, y: 380 },
  'app-worker': { x: 910, y: 380 },
  'vps-host': { x: 670, y: 110 },

  // Bottom Clusters: Feature Modules & External APIs
  'module-scraper': { x: 340, y: 600 },
  'ext-google-maps': { x: 340, y: 720 },
  'module-whatsapp': { x: 500, y: 600 },
  'ext-whatsapp': { x: 500, y: 720 },
  'module-ai': { x: 660, y: 600 },
  'ext-gemini': { x: 660, y: 720 },
  'module-vault': { x: 800, y: 550 },
  'module-backups': { x: 920, y: 220 },
  'ext-gdrive': { x: 1060, y: 220 },
};

export function RepoGraphView() {
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('app-api');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeViewMode, setActiveViewMode] = useState<'graph' | 'flows' | 'tech'>('graph');

  // Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const startDragRef = useRef({ x: 0, y: 0 });

  // Fetch graph analysis (daily cache)
  const { data: graphData, isLoading, refetch } = useQuery<RepoAnalysisResult>({
    queryKey: ['knowledgeRepoGraph'],
    queryFn: () => api.knowledgeGraph(),
  });

  // Manual analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => api.knowledgeGraphAnalyze(),
    onSuccess: (data) => {
      void queryClient.setQueryData(['knowledgeRepoGraph'], data);
    },
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    startDragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - startDragRef.current.x,
      y: e.clientY - startDragRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (activeCategoryFilter !== 'all' && n.category !== activeCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.label.toLowerCase().includes(q) ||
          n.tech.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [nodes, activeCategoryFilter, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Highlight connected edges for hovered/selected node
  const activeFocusId = hoveredNodeId || selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!activeFocusId) return new Set<string>();
    const set = new Set<string>([activeFocusId]);
    edges.forEach((e) => {
      if (e.source === activeFocusId) set.add(e.target);
      if (e.target === activeFocusId) set.add(e.source);
    });
    return set;
  }, [activeFocusId, edges]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Subheader & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Repository Architecture Map & Dependency Graph
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Daily automated analysis · Monorepo topology, inter-service communications, technology matrix, and file relations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.74rem',
              color: '#34d399',
              background: '#052e16',
              border: '1px solid #166534',
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            Daily Scan Active · {graphData?.analyzedAt ? ago(graphData.analyzedAt) : 'Today'}
          </span>

          <button
            type="button"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            style={{
              background: '#1e3a8a',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              borderRadius: '6px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: analyzeMutation.isPending ? 'default' : 'pointer',
            }}
          >
            {analyzeMutation.isPending ? 'Scanning Repo...' : 'Run Analysis Now'}
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Topology Nodes</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {graphData?.summary.totalNodes ?? 21} Nodes
          </div>
        </div>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>Communication Edges</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
            {graphData?.summary.totalEdges ?? 20} Protocols
          </div>
        </div>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>Tech Stack</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
            {graphData?.technologies.length ?? 15} Technologies
          </div>
        </div>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700 }}>Monorepo Modules</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#c084fc', marginTop: '0.2rem' }}>
            apps/ + packages/
          </div>
        </div>
      </div>

      {/* View Switcher Tabs (Graph vs Flows vs Tech) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            { id: 'graph', label: 'Interactive Obsidian Graph' },
            { id: 'flows', label: 'Communication Flows & SOPs' },
            { id: 'tech', label: 'Technology Stack Matrix' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveViewMode(tab.id as typeof activeViewMode)}
              style={{
                background: activeViewMode === tab.id ? '#1e293b' : 'transparent',
                border: 'none',
                color: activeViewMode === tab.id ? '#38bdf8' : '#94a3b8',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeViewMode === 'graph' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search nodes or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                minWidth: '180px',
              }}
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2))}
              style={{ background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
              style={{ background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '6px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              title="Zoom Out"
            >
              -
            </button>
            <button
              type="button"
              onClick={resetView}
              style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Main View Area */}
      {activeViewMode === 'graph' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 340px' : '1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Graph Canvas Container */}
          <div
            style={{
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              position: 'relative',
              overflow: 'hidden',
              height: '640px',
              cursor: isDraggingRef.current ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Category Filter Pills on Top-Left of Canvas */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', maxWidth: '80%' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'app', label: 'Apps' },
                { id: 'infrastructure', label: 'Host/Proxy' },
                { id: 'database', label: 'Databases' },
                { id: 'module', label: 'Feature Modules' },
                { id: 'external', label: 'External' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveCategoryFilter(c.id);
                  }}
                  style={{
                    background: activeCategoryFilter === c.id ? '#1e293b' : 'rgba(15, 23, 42, 0.75)',
                    border: `1px solid ${activeCategoryFilter === c.id ? '#38bdf8' : '#334155'}`,
                    color: activeCategoryFilter === c.id ? '#f8fafc' : '#94a3b8',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Hint Tag on Bottom-Left */}
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 10, color: '#64748b', fontSize: '0.72rem', background: 'rgba(11, 15, 25, 0.8)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Drag to pan · Click nodes to inspect details · Hover to trace links
            </div>

            {/* SVG Graph View */}
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1150 820"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '50% 50%',
                transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
                </marker>
                <marker id="arrow-highlight" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Connecting Edges */}
              {edges.map((edge) => {
                const sPos = NODE_POSITIONS[edge.source];
                const tPos = NODE_POSITIONS[edge.target];
                if (!sPos || !tPos) return null;

                const isConnectedToFocus = activeFocusId && (edge.source === activeFocusId || edge.target === activeFocusId);
                const strokeColor = isConnectedToFocus ? '#38bdf8' : '#1e293b';
                const strokeWidth = isConnectedToFocus ? 2.5 : 1.2;
                const strokeOpacity = activeFocusId ? (isConnectedToFocus ? 1 : 0.2) : 0.65;

                return (
                  <g key={edge.id}>
                    <line
                      x1={sPos.x}
                      y1={sPos.y}
                      x2={tPos.x}
                      y2={tPos.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={strokeOpacity}
                      strokeDasharray={edge.protocol.includes('REST') || edge.protocol.includes('MCP') ? '4 3' : 'none'}
                      markerEnd={isConnectedToFocus ? 'url(#arrow-highlight)' : 'url(#arrow)'}
                    />
                    {isConnectedToFocus && (
                      <text
                        x={(sPos.x + tPos.x) / 2}
                        y={(sPos.y + tPos.y) / 2 - 6}
                        fill="#93c5fd"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Graph Nodes */}
              {nodes.map((node) => {
                const pos = NODE_POSITIONS[node.id] || { x: 400, y: 400 };
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isConnected = activeFocusId && connectedNodeIds.has(node.id);
                const isFiltered = filteredNodeIds.has(node.id);

                const colors = CATEGORY_COLORS[node.category] || { bg: '#334155', border: '#64748b', text: '#cbd5e1' };
                const opacity = isFiltered ? (activeFocusId ? (isConnected ? 1 : 0.3) : 1) : 0.15;
                const radius = isSelected ? 22 : isHovered ? 20 : node.category === 'app' ? 18 : 15;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s ease' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    {/* Outer Glow Halo for selected or hovered */}
                    {(isSelected || isHovered) && (
                      <circle r={radius + 8} fill="none" stroke={colors.border} strokeWidth="2" opacity="0.6" strokeDasharray="3 3" />
                    )}

                    {/* Node Circle */}
                    <circle
                      r={radius}
                      fill="#0b0f19"
                      stroke={isSelected ? '#f8fafc' : colors.border}
                      strokeWidth={isSelected ? 3 : 2}
                    />

                    {/* Node Core Indicator */}
                    <circle r={radius - 7} fill={colors.bg} opacity="0.85" />

                    {/* Label below node */}
                    <text
                      y={radius + 14}
                      fill={isSelected ? '#f8fafc' : '#cbd5e1'}
                      fontSize={isSelected ? '12' : '11'}
                      fontWeight={isSelected ? 700 : 500}
                      fontFamily="system-ui, sans-serif"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Inspector Side Panel */}
          {selectedNode && (
            <div
              style={{
                background: '#0b0f19',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                maxHeight: '640px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                    {selectedNode.label}
                  </h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.3rem',
                      fontSize: '0.68rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: CATEGORY_COLORS[selectedNode.category]?.bg || '#1e293b',
                      color: CATEGORY_COLORS[selectedNode.category]?.text || '#cbd5e1',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {selectedNode.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}
                >
                  X
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                {selectedNode.description}
              </div>

              {/* Technology & Implementation */}
              <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Technology / Runtime</span>
                <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>{selectedNode.tech}</span>
              </div>

              {/* File Path */}
              {selectedNode.filePath && (
                <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Repository Path</span>
                  <span style={{ fontSize: '0.78rem', color: '#a78bfa', fontFamily: 'monospace' }}>{selectedNode.filePath}</span>
                </div>
              )}

              {/* Inbound & Outbound Connections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Connections ({selectedNode.inbound.length + selectedNode.outbound.length})
                </span>

                {selectedNode.outbound.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>Calls to:</span>
                    <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                      {selectedNode.outbound.map((tId) => {
                        const targetNode = nodes.find((n) => n.id === tId);
                        return (
                          <li key={tId} style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeId(tId)}>
                            <span style={{ color: '#60a5fa', textDecoration: 'underline' }}>{targetNode?.label || tId}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {selectedNode.inbound.length > 0 && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 600 }}>Called by:</span>
                    <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                      {selectedNode.inbound.map((sId) => {
                        const sourceNode = nodes.find((n) => n.id === sId);
                        return (
                          <li key={sId} style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeId(sId)}>
                            <span style={{ color: '#60a5fa', textDecoration: 'underline' }}>{sourceNode?.label || sId}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                {selectedNode.tags.map((t) => (
                  <span key={t} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#1e293b', color: '#94a3b8' }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Communication Flows Tab */}
      {activeViewMode === 'flows' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(graphData?.communicationFlows ?? []).map((flow, idx) => (
            <div
              key={idx}
              style={{
                background: '#0b0f19',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8', fontWeight: 700 }}>
                {flow.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                {flow.steps.map((step, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span
                      style={{
                        background: '#1e293b',
                        color: '#93c5fd',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {sIdx + 1}
                    </span>
                    <span style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tech Stack Matrix Tab */}
      {activeViewMode === 'tech' && (
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>
              Monorepo Technology Matrix & Runtime Dependencies
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Extracted from package.json, pnpm-workspace, Dockerfile, and docker-compose definitions.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Technology</th>
                <th style={{ padding: '0.75rem 1rem' }}>Role / Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                <th style={{ padding: '0.75rem 1rem' }}>Package / Location</th>
              </tr>
            </thead>
            <tbody>
              {(graphData?.technologies ?? []).map((tech, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#f8fafc' }}>{tech.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>{tech.category}</td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#a78bfa' }}>{tech.version || 'Latest'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                    {tech.usedIn.map((pkg) => (
                      <span key={pkg} style={{ background: '#1e293b', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', marginRight: '0.35rem' }}>
                        {pkg}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
