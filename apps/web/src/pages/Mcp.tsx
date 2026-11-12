import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  McpServerLiveView,
  McpServerRecord,
  McpTransportType,
  McpToolSchema,
} from '@cc/shared';
import { api } from '../api.ts';
import {
  McpIcon,
  SearchIcon,
  PlusIcon,
  RefreshIcon,
  PlayIcon,
  ClipboardIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  LockIcon,
  ObservabilityIcon,
} from '../components/Icons.tsx';
import { useClipboard } from '../hooks/useClipboard.ts';

export function McpPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'servers' | 'playground' | 'telemetry' | 'clients'>('servers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [expandedServerIds, setExpandedServerIds] = useState<Set<string>>(new Set(['builtin-control-center']));
  const { copiedId, copy } = useClipboard(2500);

  // Modal State for Add / Edit Server
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<McpTransportType>('http-jsonrpc');
  const [formUrl, setFormUrl] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formAuthHeader, setFormAuthHeader] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);

  // Interactive Playground State
  const [playgroundServerId, setPlaygroundServerId] = useState<string>('builtin-control-center');
  const [playgroundToolName, setPlaygroundToolName] = useState<string>('');
  const [playgroundArgsJson, setPlaygroundArgsJson] = useState<string>('{}');
  const [playgroundOutput, setPlaygroundOutput] = useState<{
    ok: boolean;
    result?: unknown;
    error?: string;
    latencyMs?: number;
  } | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<'cursor' | 'claude' | 'antigravity' | 'vscode'>('cursor');

  // Queries
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['mcp-overview'],
    queryFn: () => api.mcpOverview(),
    refetchInterval: 30000,
  });

  const { data: clientConfigs } = useQuery({
    queryKey: ['mcp-configs'],
    queryFn: () => api.mcpConfigs(),
  });

  const servers = overview?.servers || [];
  const summary = overview?.summary;

  // Set default playground server if none selected
  useMemo(() => {
    if (servers.length > 0 && !servers.some((s) => s.id === playgroundServerId)) {
      const first = servers[0];
      if (first) setPlaygroundServerId(first.id);
    }
  }, [servers, playgroundServerId]);

  const activePlaygroundServer = servers.find((s) => s.id === playgroundServerId) || servers[0];
  const availableTools: McpToolSchema[] = activePlaygroundServer?.tools || [];

  // Update default tool when server changes
  const handlePlaygroundServerChange = (serverId: string) => {
    setPlaygroundServerId(serverId);
    const target = servers.find((s) => s.id === serverId);
    if (target && target.tools && target.tools.length > 0 && target.tools[0]) {
      const firstTool = target.tools[0];
      setPlaygroundToolName(firstTool.name);
      setPlaygroundArgsJson(getDefaultArgsTemplate(firstTool));
    } else {
      setPlaygroundToolName('');
      setPlaygroundArgsJson('{}');
    }
  };

  const handlePlaygroundToolChange = (toolName: string) => {
    setPlaygroundToolName(toolName);
    const tool = availableTools.find((t) => t.name === toolName);
    if (tool) {
      setPlaygroundArgsJson(getDefaultArgsTemplate(tool));
    }
  };

  function getDefaultArgsTemplate(tool: McpToolSchema): string {
    const props = tool.inputSchema?.properties || {};
    const template: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(props)) {
      if (prop.type === 'string') template[key] = '';
      else if (prop.type === 'array') template[key] = [];
      else if (prop.type === 'boolean') template[key] = true;
      else if (prop.type === 'number') template[key] = 0;
      else template[key] = null;
    }
    return JSON.stringify(template, null, 2);
  }

  // Mutations
  const pingMutation = useMutation({
    mutationFn: (id: string) => api.mcpPingServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-overview'] });
    },
  });

  const callToolMutation = useMutation({
    mutationFn: (payload: { serverId: string; toolName: string; arguments?: Record<string, unknown> }) =>
      api.mcpCallTool(payload.serverId, { toolName: payload.toolName, arguments: payload.arguments }),
    onSuccess: (data) => {
      setPlaygroundOutput(data);
      queryClient.invalidateQueries({ queryKey: ['mcp-overview'] });
    },
    onError: (err: unknown) => {
      setPlaygroundOutput({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const saveServerMutation = useMutation({
    mutationFn: (payload: Partial<McpServerRecord>) => {
      if (editingServer) {
        return api.mcpUpdateServer(editingServer.id, payload);
      }
      return api.mcpCreateServer(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
      setIsModalOpen(false);
      setEditingServer(null);
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: (id: string) => api.mcpDeleteServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-configs'] });
    },
  });

  const handleOpenAdd = () => {
    setEditingServer(null);
    setFormName('');
    setFormDesc('');
    setFormType('http-jsonrpc');
    setFormUrl('');
    setFormCommand('');
    setFormArgs('');
    setFormAuthHeader('');
    setFormEnabled(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: McpServerLiveView) => {
    setEditingServer(s);
    setFormName(s.name);
    setFormDesc(s.description);
    setFormType(s.type);
    setFormUrl(s.url || '');
    setFormCommand(s.command || '');
    setFormArgs((s.args || []).join(' '));
    setFormAuthHeader(s.headers?.Authorization || '');
    setFormEnabled(s.enabled);
    setIsModalOpen(true);
  };

  const handleSubmitServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const headers: Record<string, string> = {};
    if (formAuthHeader.trim()) {
      headers.Authorization = formAuthHeader.trim();
    }

    const args = formArgs.trim() ? formArgs.split(' ').map((a) => a.trim()).filter(Boolean) : [];

    saveServerMutation.mutate({
      name: formName,
      description: formDesc,
      type: formType,
      url: formUrl || undefined,
      command: formCommand || undefined,
      args,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      enabled: formEnabled,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.url && s.url.toLowerCase().includes(q)) ||
        s.tools.some((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    );
  }, [servers, searchQuery]);

  const executePlayground = () => {
    if (!playgroundToolName) return;
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(playgroundArgsJson || '{}');
    } catch {
      alert('Invalid JSON in arguments field');
      return;
    }

    callToolMutation.mutate({
      serverId: playgroundServerId,
      toolName: playgroundToolName,
      arguments: parsedArgs,
    });
  };

  const openInPlayground = (serverId: string, toolName: string) => {
    handlePlaygroundServerChange(serverId);
    handlePlaygroundToolChange(toolName);
    setActiveTab('playground');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-series/20 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <McpIcon size={24} className="text-series" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Model Context Protocol (MCP) Hub</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            CRUD, live observability, health monitoring, and tool testing for AI agents connected to your VPS.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700 hover:text-white disabled:opacity-50"
          >
            <RefreshIcon size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Probe All</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-lg bg-series px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-series/90 shadow-sm"
          >
            <PlusIcon size={14} />
            <span>Add MCP Server</span>
          </button>
        </div>
      </div>

      {/* Observability KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium text-neutral-400">Total Servers</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{summary?.totalServers ?? 0}</span>
            <span className="text-xs text-emerald-400 font-medium">({summary?.activeServers ?? 0} online)</span>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium text-neutral-400">Exposed Tools</div>
          <div className="mt-2 text-2xl font-semibold text-white">{summary?.totalTools ?? 0}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium text-neutral-400">Avg Probe Latency</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{summary?.avgLatencyMs ?? 0}</span>
            <span className="text-xs text-neutral-400">ms</span>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="text-xs font-medium text-neutral-400">Recent Invocations</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{summary?.totalCalls ?? 0}</span>
            <span className="text-xs text-neutral-400 font-medium">
              ({summary?.errorRatePercent ?? 0}% errors)
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex border-b border-neutral-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 pb-3 font-medium transition ${
            activeTab === 'servers'
              ? 'border-b-2 border-series text-series'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <McpIcon size={16} />
          <span>Server Registry & Tools ({servers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center gap-2 pb-3 font-medium transition ${
            activeTab === 'playground'
              ? 'border-b-2 border-series text-series'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <PlayIcon size={16} />
          <span>Interactive Playground</span>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 pb-3 font-medium transition ${
            activeTab === 'telemetry'
              ? 'border-b-2 border-series text-series'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <ObservabilityIcon size={16} />
          <span>Telemetry & Audit Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 pb-3 font-medium transition ${
            activeTab === 'clients'
              ? 'border-b-2 border-series text-series'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <ClipboardIcon size={16} />
          <span>AI Client Configs</span>
        </button>
      </div>

      {/* TAB 1: SERVER REGISTRY & TOOLS */}
      {activeTab === 'servers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search MCP servers or tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 py-2 pl-9 pr-4 text-xs text-white placeholder-neutral-500 focus:border-series focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredServers.map((server) => {
              const isExpanded = expandedServerIds.has(server.id);
              const isPingLoading = pingMutation.isPending && pingMutation.variables === server.id;

              return (
                <div
                  key={server.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden transition"
                >
                  <div className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${
                            server.status === 'online'
                              ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                              : server.status === 'degraded'
                              ? 'bg-amber-500 ring-4 ring-amber-500/20'
                              : 'bg-rose-500 ring-4 ring-rose-500/20'
                          }`}
                          title={`Status: ${server.status}`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-white">{server.name}</h3>
                          {server.isBuiltIn && (
                            <span className="rounded bg-series/20 px-2 py-0.5 text-[10px] font-semibold text-series">
                              BUILT-IN
                            </span>
                          )}
                          <span className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] uppercase font-mono text-neutral-300">
                            {server.type}
                          </span>
                          {server.latencyMs !== null && (
                            <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                              {server.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">{server.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-500">
                          {server.url && (
                            <div>
                              <span className="text-neutral-400 font-sans">URL: </span>
                              <span className="text-neutral-300">{server.url}</span>
                            </div>
                          )}
                          {server.command && (
                            <div>
                              <span className="text-neutral-400 font-sans">Command: </span>
                              <span className="text-neutral-300">
                                {server.command} {(server.args || []).join(' ')}
                              </span>
                            </div>
                          )}
                          {server.serverInfo && (
                            <div>
                              <span className="text-neutral-400 font-sans">Server Info: </span>
                              <span className="text-neutral-300">
                                {server.serverInfo.name} v{server.serverInfo.version}
                              </span>
                            </div>
                          )}
                        </div>
                        {server.errorMessage && (
                          <div className="mt-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded px-2.5 py-1">
                            Error: {server.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Server Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => pingMutation.mutate(server.id)}
                        disabled={isPingLoading}
                        title="Run health probe"
                        className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-50"
                      >
                        <RefreshIcon size={12} className={isPingLoading ? 'animate-spin' : ''} />
                        <span>Probe</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(server)}
                        title="Edit server"
                        className="rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
                      >
                        <EditIcon size={14} />
                      </button>
                      {!server.isBuiltIn && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete MCP server "${server.name}"?`)) {
                              deleteServerMutation.mutate(server.id);
                            }
                          }}
                          title="Delete server"
                          className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-1.5 text-rose-400 transition hover:bg-rose-900/50"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleExpand(server.id)}
                        className="ml-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700"
                      >
                        {isExpanded ? 'Hide Tools' : `View Tools (${server.tools.length})`}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Tools & Resources */}
                  {isExpanded && (
                    <div className="border-t border-neutral-800 bg-neutral-950/50 p-5 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            Exposed Tools ({server.tools.length})
                          </h4>
                        </div>
                        {server.tools.length === 0 ? (
                          <div className="text-xs text-neutral-500 py-3 text-center border border-dashed border-neutral-800 rounded-lg">
                            No tools reported by this MCP server.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {server.tools.map((tool) => (
                              <div
                                key={tool.name}
                                className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3.5 flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-series">{tool.name}</span>
                                    <button
                                      onClick={() => openInPlayground(server.id, tool.name)}
                                      className="flex items-center gap-1 rounded bg-series/20 px-2 py-0.5 text-[11px] font-medium text-series hover:bg-series/30 transition"
                                    >
                                      <PlayIcon size={10} />
                                      <span>Test</span>
                                    </button>
                                  </div>
                                  <p className="mt-1 text-xs text-neutral-400 line-clamp-2">{tool.description}</p>
                                </div>
                                {tool.inputSchema?.properties && (
                                  <div className="mt-3 pt-2 border-t border-neutral-800 text-[11px] font-mono text-neutral-500">
                                    Params:{' '}
                                    <span className="text-neutral-400">
                                      {Object.keys(tool.inputSchema.properties).join(', ') || 'none'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {server.resources.length > 0 && (
                        <div className="pt-3 border-t border-neutral-850">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                            Exposed Resources ({server.resources.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {server.resources.map((res) => (
                              <div
                                key={res.uri}
                                className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 flex items-center justify-between"
                              >
                                <div className="truncate">
                                  <div className="text-xs font-medium text-white truncate">{res.name}</div>
                                  <div className="text-[11px] font-mono text-neutral-500 truncate">{res.uri}</div>
                                </div>
                                <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 font-mono">
                                  {res.mimeType || 'text'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Tool Selection & Request Arguments */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <PlayIcon size={18} className="text-series" />
                <span>Execute Tool</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Target MCP Server</label>
                  <select
                    value={playgroundServerId}
                    onChange={(e) => handlePlaygroundServerChange(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Tool Name</label>
                  {availableTools.length > 0 ? (
                    <select
                      value={playgroundToolName}
                      onChange={(e) => handlePlaygroundToolChange(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none"
                    >
                      {availableTools.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} — {t.description.slice(0, 50)}...
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. get_system_context"
                      value={playgroundToolName}
                      onChange={(e) => setPlaygroundToolName(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none"
                    />
                  )}
                </div>

                {availableTools.find((t) => t.name === playgroundToolName) && (
                  <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800/80">
                    <p className="text-xs text-neutral-300">
                      {availableTools.find((t) => t.name === playgroundToolName)?.description}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-400">Arguments (JSON)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const tool = availableTools.find((t) => t.name === playgroundToolName);
                        if (tool) setPlaygroundArgsJson(getDefaultArgsTemplate(tool));
                      }}
                      className="text-[11px] text-series hover:underline"
                    >
                      Reset schema template
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={playgroundArgsJson}
                    onChange={(e) => setPlaygroundArgsJson(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-200 focus:border-series focus:outline-none"
                  />
                </div>

                <button
                  onClick={executePlayground}
                  disabled={callToolMutation.isPending || !playgroundToolName}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-series py-2.5 text-xs font-semibold text-white transition hover:bg-series/90 disabled:opacity-50"
                >
                  <PlayIcon size={14} className={callToolMutation.isPending ? 'animate-spin' : ''} />
                  <span>{callToolMutation.isPending ? 'Invoking MCP Server...' : 'Run Tool'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Execution Output */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-3 min-h-[420px] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">Execution Result</h3>
                  {playgroundOutput && (
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        playgroundOutput.ok
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {playgroundOutput.ok ? 'SUCCESS' : 'ERROR'}
                    </span>
                  )}
                  {playgroundOutput?.latencyMs !== undefined && (
                    <span className="text-xs text-neutral-400 font-mono">
                      {playgroundOutput.latencyMs}ms
                    </span>
                  )}
                </div>
                {playgroundOutput && (
                  <button
                    onClick={() => copy('playground-res', JSON.stringify(playgroundOutput, null, 2))}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition"
                  >
                    {copiedId === 'playground-res' ? <CheckIcon size={14} className="text-emerald-400" /> : <ClipboardIcon size={14} />}
                    <span>{copiedId === 'playground-res' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1">
                {callToolMutation.isPending ? (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                    Executing JSON-RPC request on VPS...
                  </div>
                ) : playgroundOutput ? (
                  <pre className="h-full max-h-[500px] overflow-auto rounded-lg border border-neutral-850 bg-neutral-950 p-4 font-mono text-xs text-neutral-300">
                    {JSON.stringify(playgroundOutput.result || playgroundOutput.error, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                    <PlayIcon size={32} className="text-neutral-700" />
                    <p className="text-xs">Pick a server, select an exposed tool, and click Run Tool to test live.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEMETRY & AUDIT LOGS */}
      {activeTab === 'telemetry' && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Tool Execution History</h3>
              <p className="text-xs text-neutral-400">Live audit log of all MCP JSON-RPC tool calls and agent interactions.</p>
            </div>
          </div>

          {!summary?.recentCalls || summary.recentCalls.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No tool executions recorded yet. Run a tool in the Playground or connect an agent to see telemetry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/60 text-neutral-400 font-mono border-b border-neutral-800">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Server</th>
                    <th className="py-3 px-4">Tool</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300 font-mono">
                  {summary.recentCalls.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/20 transition">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                            log.isError
                              ? 'bg-rose-950 text-rose-400 border border-rose-900'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                          }`}
                        >
                          {log.isError ? 'ERR' : 'OK'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-white">{log.serverName}</td>
                      <td className="py-3 px-4 text-series">{log.toolName}</td>
                      <td className="py-3 px-4">{log.latencyMs}ms</td>
                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(log.calledAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            alert(
                              `Tool: ${log.toolName}\nArgs:\n${JSON.stringify(log.arguments, null, 2)}\n\nResponse Preview:\n${log.responsePreview}`
                            )
                          }
                          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:text-white"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AI CLIENT CONFIGURATIONS */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex border-b border-neutral-800 gap-4 text-xs font-mono">
            <button
              onClick={() => setActiveClientTab('cursor')}
              className={`pb-2.5 font-semibold transition ${
                activeClientTab === 'cursor' ? 'border-b-2 border-series text-series' : 'text-neutral-400'
              }`}
            >
              Cursor (.cursor/mcp.json)
            </button>
            <button
              onClick={() => setActiveClientTab('claude')}
              className={`pb-2.5 font-semibold transition ${
                activeClientTab === 'claude' ? 'border-b-2 border-series text-series' : 'text-neutral-400'
              }`}
            >
              Claude Desktop
            </button>
            <button
              onClick={() => setActiveClientTab('antigravity')}
              className={`pb-2.5 font-semibold transition ${
                activeClientTab === 'antigravity' ? 'border-b-2 border-series text-series' : 'text-neutral-400'
              }`}
            >
              Antigravity / Gemini CLI
            </button>
            <button
              onClick={() => setActiveClientTab('vscode')}
              className={`pb-2.5 font-semibold transition ${
                activeClientTab === 'vscode' ? 'border-b-2 border-series text-series' : 'text-neutral-400'
              }`}
            >
              VS Code / Cline
            </button>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                Copy and paste this snippet directly into your client's configuration file:
              </span>
              <button
                onClick={() => {
                  const conf = clientConfigs ? clientConfigs[activeClientTab] : {};
                  copy('client-cfg', JSON.stringify(conf, null, 2));
                }}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700"
              >
                {copiedId === 'client-cfg' ? <CheckIcon size={14} className="text-emerald-400" /> : <ClipboardIcon size={14} />}
                <span>{copiedId === 'client-cfg' ? 'Copied' : 'Copy JSON Configuration'}</span>
              </button>
            </div>

            <pre className="max-h-[420px] overflow-auto rounded-lg border border-neutral-850 bg-neutral-950 p-4 font-mono text-xs text-neutral-300">
              {JSON.stringify(clientConfigs ? clientConfigs[activeClientTab] : {}, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Server */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">
              {editingServer ? `Edit "${editingServer.name}"` : 'Add MCP Server'}
            </h2>
            <p className="text-xs text-neutral-400 mb-5">
              Register a Model Context Protocol server running on your VPS or remote network.
            </p>

            <form onSubmit={handleSubmitServer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Server Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Postgres DB MCP, Local Filesystem"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="What tools or data does this MCP server provide?"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Protocol / Transport</label>
                  <select
                    disabled={editingServer?.isBuiltIn}
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as McpTransportType)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-series focus:outline-none disabled:opacity-50"
                  >
                    <option value="http-jsonrpc">HTTP / JSON-RPC 2.0</option>
                    <option value="sse">SSE (Server-Sent Events)</option>
                    <option value="stdio">Stdio (Local Process)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Status</label>
                  <label className="flex items-center gap-2 mt-2 text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-950 text-series focus:ring-0"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              {formType !== 'stdio' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Endpoint URL</label>
                    <input
                      type="url"
                      placeholder="https://control-api.nicoguzmandev.com/api/mcp"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white font-mono focus:border-series focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Authorization Header (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Bearer <token>"
                      value={formAuthHeader}
                      onChange={(e) => setFormAuthHeader(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white font-mono focus:border-series focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Command</label>
                    <input
                      type="text"
                      placeholder="e.g. node, python3, npx"
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white font-mono focus:border-series focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Arguments (Space separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. scripts/mcp-server.mjs"
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white font-mono focus:border-series focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveServerMutation.isPending}
                  className="rounded-lg bg-series px-4 py-2 text-xs font-semibold text-white hover:bg-series/90 disabled:opacity-50"
                >
                  {saveServerMutation.isPending ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
