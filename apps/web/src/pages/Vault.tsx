import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DiscoveredEnvFile,
  VaultAuditSummary,
  VaultCriticality,
  VaultDiffResult,
  VaultEnvironment,
  VaultFileAudit,
  VaultItem,
  VaultOverview,
  VaultProjectConfig,
} from '@cc/shared';
import { api } from '../api.ts';
import { useClipboard } from '../hooks/useClipboard.ts';

export function VaultPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'inventory' | 'secrets'>('inventory');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const { copiedId, copy } = useClipboard(2000);

  // Add / Edit Secret Modal
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formProject, setFormProject] = useState('control-center');
  const [formDescription, setFormDescription] = useState('');
  const [formIsSecret, setFormIsSecret] = useState(true);

  // Project Config Modal
  const [editingConfig, setEditingConfig] = useState<VaultProjectConfig | null>(null);
  const [cfgFilePath, setCfgFilePath] = useState('');
  const [cfgDockerService, setCfgDockerService] = useState('');
  const [cfgEnvironment, setCfgEnvironment] = useState<VaultEnvironment>('production');
  const [cfgCriticality, setCfgCriticality] = useState<VaultCriticality>('MEDIUM');

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProject, setImportProject] = useState('control-center');
  const [importText, setImportText] = useState('');

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProject, setExportProject] = useState('control-center');
  const [exportText, setExportText] = useState('');
  const [copiedExport, setCopiedExport] = useState(false);

  // Diff Modal
  const [diffProject, setDiffProject] = useState<string | null>(null);

  // Deploy / Push Modal
  const [deployProject, setDeployProject] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{ filePath: string; backupPath: string | null } | null>(null);

  // Discover Modal
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [customScanPath, setCustomScanPath] = useState('');
  const [importedFileSuccess, setImportedFileSuccess] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);

  // Main Query
  const { data: vault, isLoading, error, refetch, isFetching } = useQuery<VaultOverview>({
    queryKey: ['vault'],
    queryFn: api.vaultOverview,
  });

  // Diff Query
  const diffQuery = useQuery<VaultDiffResult>({
    queryKey: ['vaultDiff', diffProject],
    queryFn: () => (diffProject ? api.vaultDiff(diffProject) : Promise.reject('No project')),
    enabled: !!diffProject,
  });

  // Discover Query
  const discoverQuery = useQuery<DiscoveredEnvFile[]>({
    queryKey: ['vaultDiscover', customScanPath],
    queryFn: () => api.vaultDiscover(customScanPath || undefined),
    enabled: isDiscoverModalOpen,
  });

  // Import File Mutation
  const importFileMutation = useMutation({
    mutationFn: ({ filePath, project }: { filePath: string; project?: string }) =>
      api.vaultImportFile(filePath, project),
    onSuccess: (_, vars) => {
      setImportedFileSuccess(vars.filePath);
      setTimeout(() => setImportedFileSuccess(null), 3000);
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
      void queryClient.invalidateQueries({ queryKey: ['vaultDiscover'] });
    },
  });

  // Audit Mutation
  const auditMutation = useMutation({
    mutationFn: api.vaultAudit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Project Config Mutation
  const configMutation = useMutation({
    mutationFn: (cfg: VaultProjectConfig) => api.vaultUpdateProjectConfig(cfg),
    onSuccess: () => {
      setEditingConfig(null);
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Deploy to Disk Mutation
  const deployMutation = useMutation({
    mutationFn: (project: string) => api.vaultDeploy(project),
    onSuccess: (res) => {
      setDeployResult({ filePath: res.filePath, backupPath: res.backupPath });
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Upsert Secret Mutation
  const upsertMutation = useMutation({
    mutationFn: (payload: {
      id?: string;
      key: string;
      value: string;
      project: string;
      description?: string;
      isSecret?: boolean;
    }) => api.vaultUpsert(payload),
    onSuccess: () => {
      setIsAddModalOpen(false);
      setEditingItem(null);
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Delete Secret Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.vaultDelete(id),
    onSuccess: () => {
      setItemToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  // Import Mutation
  const importMutation = useMutation({
    mutationFn: ({ project, envText }: { project: string; envText: string }) =>
      api.vaultImport(project, envText),
    onSuccess: () => {
      setIsImportModalOpen(false);
      setImportText('');
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddModal = (projectPrefill = 'control-center') => {
    setEditingItem(null);
    setFormKey('');
    setFormValue('');
    setFormProject(selectedProject !== 'all' ? selectedProject : projectPrefill);
    setFormDescription('');
    setFormIsSecret(true);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: VaultItem) => {
    setEditingItem(item);
    setFormKey(item.key);
    setFormValue(item.value);
    setFormProject(item.project);
    setFormDescription(item.description);
    setFormIsSecret(item.isSecret);
    setIsAddModalOpen(true);
  };

  const openConfigModal = (cfg: VaultProjectConfig) => {
    setEditingConfig(cfg);
    setCfgFilePath(cfg.filePath);
    setCfgDockerService(cfg.dockerService || '');
    setCfgEnvironment(cfg.environment);
    setCfgCriticality(cfg.criticality);
  };

  const openExportModal = async (project: string) => {
    setExportProject(project);
    setCopiedExport(false);
    try {
      const res = await api.vaultExport(project);
      setExportText(res.envText);
      setIsExportModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadEnvFile = (project: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `.env.${project}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter items
  const filteredItems = (vault?.items ?? []).filter((item) => {
    if (selectedProject !== 'all' && item.project.toLowerCase() !== selectedProject.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.project.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const projects = vault?.projects ?? ['control-center'];
  const auditSummary = vault?.auditSummary;
  const projectConfigs = vault?.projectConfigs ?? {};

  const getCriticalityBadge = (crit: VaultCriticality) => {
    switch (crit) {
      case 'CRITICAL':
        return <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-danger/20 text-danger border border-danger/40">CRITICAL</span>;
      case 'HIGH':
        return <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">MEDIUM</span>;
      case 'LOW':
        return <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-subtle text-muted border border-line">LOW</span>;
    }
  };

  const getEnvBadge = (env: VaultEnvironment) => {
    switch (env) {
      case 'production':
        return <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Production</span>;
      case 'staging':
        return <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Staging</span>;
      case 'development':
        return <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-subtle text-muted">Dev</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span className="emoji-bw">ðŸ”‘</span> Env Vault & Security Auditor
          </h1>
          <p className="text-xs text-ink-2 mt-0.5">
            Centralized encrypted secrets vault, disk drifting detection, and VPS security auditor
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={auditMutation.isPending || isFetching}
            onClick={() => auditMutation.mutate()}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Scan VPS filesystem for drifting, permissions, and git exposure"
          >
            <span className="emoji-bw">{auditMutation.isPending ? 'â³' : 'ðŸ›¡ï¸'}</span>
            {auditMutation.isPending ? 'Auditing...' : 'Scan & Audit VPS'}
          </button>
          <button
            type="button"
            onClick={() => setIsDiscoverModalOpen(true)}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">ðŸ”</span> Discover .env
          </button>
          <button
            type="button"
            onClick={() => openAddModal()}
            className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">âž•</span> Add Secret
          </button>
          <button
            type="button"
            onClick={() => {
              setImportProject(selectedProject !== 'all' ? selectedProject : 'control-center');
              setIsImportModalOpen(true);
            }}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">ðŸ“¥</span> Import
          </button>
          <button
            type="button"
            onClick={() => openExportModal(selectedProject !== 'all' ? selectedProject : 'control-center')}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">ðŸ“¤</span> Export
          </button>
        </div>
      </div>

      {/* Security Metrics Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Secrets */}
        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Total Variables</span>
          <span className="text-xl font-bold text-ink mt-0.5 block">{auditSummary?.totalVariables ?? 0}</span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">Across {auditSummary?.totalProjects ?? 0} projects</span>
        </div>

        {/* Global Security Posture */}
        <div className={`card p-3 border ${
          auditSummary?.globalRiskLevel === 'CRITICAL'
            ? 'border-danger/60 bg-danger/10'
            : auditSummary?.globalRiskLevel === 'WARNING'
            ? 'border-amber-500/60 bg-amber-500/10'
            : 'border-emerald-500/40 bg-emerald-500/10'
        }`}>
          <span className="text-[11px] font-medium block text-muted">Global Risk Level</span>
          <span className={`text-xl font-bold mt-0.5 block ${
            auditSummary?.globalRiskLevel === 'CRITICAL'
              ? 'text-danger'
              : auditSummary?.globalRiskLevel === 'WARNING'
              ? 'text-amber-400'
              : 'text-emerald-400'
          }`}>
            {auditSummary?.globalRiskLevel ?? 'SAFE'}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">
            {auditSummary?.globalRiskLevel === 'CRITICAL'
              ? 'High-priority exposure detected'
              : auditSummary?.globalRiskLevel === 'WARNING'
              ? 'Drift or loose permissions'
              : 'All files strictly protected'}
          </span>
        </div>

        {/* Git Exposure Risk */}
        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Git Exposure Alerts</span>
          <span className={`text-xl font-bold mt-0.5 block ${
            (auditSummary?.criticalExposureCount ?? 0) > 0 ? 'text-danger' : 'text-ink'
          }`}>
            {auditSummary?.criticalExposureCount ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">
            {(auditSummary?.criticalExposureCount ?? 0) > 0
              ? 'ðŸš¨ Tracked in Git history!'
              : 'âœ“ None committed to Git'}
          </span>
        </div>

        {/* Secret Drifts */}
        <div className="card p-3 border border-line bg-card/60">
          <span className="text-[11px] text-muted font-medium block">Disk Secret Drifts</span>
          <span className={`text-xl font-bold mt-0.5 block ${
            (auditSummary?.driftCount ?? 0) > 0 ? 'text-amber-400' : 'text-ink'
          }`}>
            {auditSummary?.driftCount ?? 0}
          </span>
          <span className="text-[10px] text-ink-2 mt-0.5 block">
            {(auditSummary?.driftCount ?? 0) > 0 ? 'Mismatch with VPS disk' : 'âœ“ Synced with VPS disk'}
          </span>
        </div>
      </div>

      {/* Main Tabs (Inventory vs Variables) */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'bg-series text-white'
              : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          <span className="emoji-bw">ðŸ“‹</span> Projects Inventory & Audit ({auditSummary?.audits.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('secrets')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            activeTab === 'secrets'
              ? 'bg-series text-white'
              : 'text-ink-2 hover:text-ink hover:bg-subtle'
          }`}
        >
          <span className="emoji-bw">ðŸ”</span> Secret Variables ({vault?.items.length ?? 0})
        </button>
      </div>

      {/* =========================================================================
          TAB 1: PROJECTS INVENTORY & SECURITY AUDIT TABLE
          ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="card overflow-hidden border border-line divide-y divide-line">
            <div className="p-3 bg-subtle/40 hidden md:grid md:grid-cols-12 text-[11px] font-semibold text-muted uppercase tracking-wider">
              <span className="col-span-3">Project & Service</span>
              <span className="col-span-2">Criticality & Env</span>
              <span className="col-span-3">VPS Disk File</span>
              <span className="col-span-2">Security & Drift</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            {auditSummary?.audits.map((audit) => {
              const cfg = projectConfigs[audit.projectName] ?? {
                projectName: audit.projectName,
                filePath: audit.filePath,
                environment: 'production' as VaultEnvironment,
                criticality: 'MEDIUM' as VaultCriticality,
                lastSyncedAt: null,
              };

              const hasCriticalIssues = audit.issues.some((i) => i.severity === 'CRITICAL');
              const hasWarnings = audit.issues.some((i) => i.severity === 'WARNING');

              return (
                <div key={audit.projectName} className="p-4 md:grid md:grid-cols-12 gap-3 items-center hover:bg-subtle/30 transition">
                  {/* Col 1: Project & Service */}
                  <div className="col-span-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-ink">{audit.projectName}</span>
                      {cfg.dockerService && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-ink-2 font-mono border border-line truncate max-w-[140px]">
                          {cfg.dockerService}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted block font-mono">
                      {audit.vaultItemCount} vars in vault Â· {audit.diskItemCount} on disk
                    </span>
                  </div>

                  {/* Col 2: Criticality & Env */}
                  <div className="col-span-2 mt-2 md:mt-0 flex flex-wrap md:flex-col gap-1 items-start">
                    {getCriticalityBadge(cfg.criticality)}
                    {getEnvBadge(cfg.environment)}
                  </div>

                  {/* Col 3: File Path & Permissions */}
                  <div className="col-span-3 mt-2 md:mt-0 space-y-0.5">
                    <span className="text-xs font-mono text-ink block truncate" title={audit.filePath}>
                      {audit.filePath}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <span>Perms: <strong className="font-mono text-ink-2">{audit.permissionsOctal}</strong></span>
                      {audit.existsOnDisk ? (
                        <span className="text-emerald-400">â— On Disk</span>
                      ) : (
                        <span className="text-muted">â—‹ Missing</span>
                      )}
                    </div>
                  </div>

                  {/* Col 4: Security & Sync Status */}
                  <div className="col-span-2 mt-2 md:mt-0 space-y-1">
                    {audit.syncStatus === 'in_sync' ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        âœ“ In Sync
                      </span>
                    ) : audit.syncStatus === 'drift_detected' ? (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                        âš ï¸ Drift Detected
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted flex items-center gap-1">
                        Untracked on Disk
                      </span>
                    )}

                    {hasCriticalIssues ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/20 text-danger font-bold block w-fit">
                        ðŸš¨ Critical Risk
                      </span>
                    ) : hasWarnings ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold block w-fit">
                        âš ï¸ Review Needed
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 block">
                        ðŸ›¡ï¸ Protected
                      </span>
                    )}
                  </div>

                  {/* Col 5: Actions */}
                  <div className="col-span-2 mt-3 md:mt-0 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDiffProject(audit.projectName)}
                      className="btn btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                      title="Compare Vault values with Disk"
                    >
                      <span className="emoji-bw">ðŸ”</span> Diff
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeployProject(audit.projectName)}
                      className="btn btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                      title="Push Vault secrets to VPS disk file"
                    >
                      <span className="emoji-bw">ðŸš€</span> Deploy
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfigModal(cfg)}
                      className="btn btn-secondary text-xs px-2 py-1"
                      title="Edit project configuration"
                    >
                      <span className="emoji-bw">âš™ï¸</span>
                    </button>
                  </div>

                  {/* Issues expandable box if any */}
                  {audit.issues.length > 0 && (
                    <div className="col-span-12 mt-2 pt-2 border-t border-line/60 space-y-1">
                      {audit.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-2 rounded-md flex items-start justify-between gap-2 ${
                            issue.severity === 'CRITICAL'
                              ? 'bg-danger/15 text-danger border border-danger/30'
                              : issue.severity === 'WARNING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-subtle/50 text-ink-2'
                          }`}
                        >
                          <div>
                            <strong className="font-semibold block">{issue.title}</strong>
                            <p className="text-[11px] mt-0.5 opacity-90">{issue.description}</p>
                            {issue.recommendation && (
                              <p className="text-[10px] mt-1 font-mono opacity-80">
                                â†³ Fix: {issue.recommendation}
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/20 flex-shrink-0">
                            {issue.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SECRET VARIABLES DETAIL TABLE
          ========================================================================= */}
      {activeTab === 'secrets' && (
        <div className="space-y-4">
          {/* Project Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 border border-line p-2.5 rounded-lg">
            {/* Project Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedProject('all')}
                className={`px-2.5 py-1 rounded text-xs transition flex-shrink-0 ${
                  selectedProject === 'all'
                    ? 'bg-series text-white font-medium'
                    : 'text-ink-2 hover:text-ink hover:bg-subtle'
                }`}
              >
                All Projects ({vault?.items.length ?? 0})
              </button>
              {projects.map((p) => {
                const count = vault?.items.filter((i) => i.project === p).length ?? 0;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedProject(p)}
                    className={`px-2.5 py-1 rounded text-xs transition flex-shrink-0 ${
                      selectedProject === p
                        ? 'bg-series text-white font-medium'
                        : 'text-ink-2 hover:text-ink hover:bg-subtle'
                    }`}
                  >
                    {p} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Bar */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search secrets by key..."
                className="input w-full text-xs py-1"
              />
            </div>
          </div>

          {/* Variables List */}
          {filteredItems.length === 0 ? (
            <div className="card p-8 text-center space-y-2 border border-line">
              <div className="emoji-bw text-2xl">ðŸ”’</div>
              <p className="text-sm font-medium text-ink">No secrets found</p>
              <p className="text-xs text-ink-2 max-w-sm mx-auto">
                {searchQuery
                  ? 'No secrets matched your search query.'
                  : 'Add your first secret or import an existing .env file for this project.'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => openAddModal()}
                  className="btn btn-primary text-xs px-3 py-1.5 mt-2 inline-flex items-center gap-1.5"
                >
                  <span className="emoji-bw">âž•</span> Add First Secret
                </button>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden border border-line divide-y divide-line">
              {filteredItems.map((item) => {
                const isRevealed = revealedIds.has(item.id) || !item.isSecret;
                const isCopied = copiedId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-subtle/30 transition group"
                  >
                    {/* Left: Key, Project, Description */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-ink">{item.key}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-subtle text-ink-2 font-mono border border-line">
                          {item.project}
                        </span>
                        {!item.isSecret && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                            Public
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-muted truncate">{item.description}</p>
                      )}
                    </div>

                    {/* Center / Right: Value & Actions */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* Masked / Plain Value Display */}
                      <div className="flex items-center gap-2 bg-page px-3 py-1.5 rounded-md border border-line font-mono text-xs min-w-[200px] max-w-full sm:max-w-xs overflow-hidden">
                        <span className="truncate select-all text-ink">
                          {isRevealed ? item.value : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(item.id)}
                            className="btn btn-secondary text-xs px-2.5 py-1.5"
                            title={isRevealed ? 'Hide value' : 'Reveal value'}
                          >
                            <span className="emoji-bw">{isRevealed ? 'ðŸ™ˆ' : 'ðŸ‘ï¸'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => copy(item.id, item.value)}
                          className="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
                          title="Copy value"
                        >
                          <span className="emoji-bw">{isCopied ? 'âœ“' : 'ðŸ“‹'}</span>
                          <span className="text-[11px] hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="btn btn-secondary text-xs px-2.5 py-1.5"
                          title="Edit secret"
                        >
                          <span className="emoji-bw">âœï¸</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 text-muted hover:text-danger transition rounded"
                          title="Delete secret"
                        >
                          <span className="emoji-bw">ðŸ—‘ï¸</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          DIFF / COMPARE MODAL
          ========================================================================= */}
      {diffProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-subtle/30 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="emoji-bw">ðŸ”</span> Diff: {diffProject}
                </h3>
                <p className="text-[11px] text-muted font-mono mt-0.5 truncate">
                  {diffQuery.data?.filePath || 'Path not configured'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiffProject(null)}
                className="btn btn-secondary text-xs px-2.5 py-1.5"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {diffQuery.isLoading ? (
                <div className="p-8 text-center text-xs text-ink-2">Reading and comparing disk file...</div>
              ) : diffQuery.error ? (
                <div className="p-4 text-xs text-danger bg-danger/10 rounded-md">
                  Failed to compute diff: {(diffQuery.error as any).message || 'Error'}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span>Key-by-Key Comparison</span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400" /> Only in Vault</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400" /> Only on Disk</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-danger" /> Modified Value</span>
                    </div>
                  </div>

                  <div className="border border-line rounded-lg overflow-hidden divide-y divide-line font-mono text-xs">
                    {diffQuery.data?.differences.map((diff) => (
                      <div
                        key={diff.key}
                        className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          diff.status === 'only_in_vault'
                            ? 'bg-emerald-500/10'
                            : diff.status === 'only_on_disk'
                            ? 'bg-amber-500/10'
                            : diff.status === 'modified'
                            ? 'bg-danger/10'
                            : 'bg-page/40'
                        }`}
                      >
                        <div className="font-semibold text-ink flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                            diff.status === 'only_in_vault'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : diff.status === 'only_on_disk'
                              ? 'bg-amber-500/20 text-amber-400'
                              : diff.status === 'modified'
                              ? 'bg-danger/20 text-danger'
                              : 'bg-subtle text-muted'
                          }`}>
                            {diff.status.replace(/_/g, ' ')}
                          </span>
                          <span>{diff.key}</span>
                        </div>

                        <div className="text-[11px] space-y-0.5 text-right sm:max-w-md truncate">
                          {diff.status === 'modified' ? (
                            <>
                              <div className="text-danger truncate">Disk: {diff.diskValue}</div>
                              <div className="text-emerald-400 truncate">Vault: {diff.vaultValue}</div>
                            </>
                          ) : (
                            <span className="text-ink-2 truncate">
                              {diff.vaultValue ?? diff.diskValue}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-line bg-subtle/20 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  const p = diffProject;
                  setDiffProject(null);
                  setDeployProject(p);
                }}
                className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <span className="emoji-bw">ðŸš€</span> Push Vault to Disk
              </button>

              <button
                type="button"
                onClick={() => setDiffProject(null)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPLOY TO DISK CONFIRMATION MODAL
          ========================================================================= */}
      {deployProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">ðŸš€</span> Deploy Secrets to VPS Disk
            </h3>

            {deployResult ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
                  âœ“ Successfully deployed variables to VPS disk with chmod 600 permissions!
                </div>
                {deployResult.backupPath && (
                  <p className="text-[11px] text-muted font-mono">
                    Previous file backed up to: {deployResult.backupPath}
                  </p>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeployProject(null);
                      setDeployResult(null);
                    }}
                    className="btn btn-primary text-xs px-3 py-1.5"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-2 leading-relaxed">
                  You are about to overwrite the <span className="font-mono text-ink">.env</span> file for{' '}
                  <strong className="text-ink">{deployProject}</strong> at:
                </p>
                <p className="text-xs font-mono p-2 bg-page border border-line rounded text-ink truncate">
                  {projectConfigs[deployProject]?.filePath || `/home/adminnico/repositories/${deployProject}/.env`}
                </p>
                <p className="text-[11px] text-muted">
                  A timestamped backup of the current file will automatically be created on the VPS before overwriting.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setDeployProject(null)}
                    className="btn btn-secondary text-xs px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deployMutation.isPending}
                    onClick={() => deployMutation.mutate(deployProject)}
                    className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    {deployMutation.isPending ? 'Deploying...' : 'Confirm & Deploy'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          DISCOVER VPS .ENV FILES MODAL
          ========================================================================= */}
      {isDiscoverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-subtle/30 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="emoji-bw">ðŸ”</span> Discovered .env Files on VPS
                </h3>
                <p className="text-[11px] text-muted">
                  Auto-detect environment configs across repositories and import them into the Vault in 1 click
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscoverModalOpen(false)}
                className="btn btn-secondary text-xs px-2.5 py-1.5"
              >
                Close
              </button>
            </div>

            {/* Custom Scan Path Input */}
            <div className="p-3 bg-subtle/20 border-b border-line flex items-center gap-2">
              <input
                type="text"
                value={customScanPath}
                onChange={(e) => setCustomScanPath(e.target.value)}
                placeholder="Scan custom path (e.g. /home/adminnico/repositories or ~)"
                className="input flex-1 text-xs font-mono py-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void discoverQuery.refetch();
                }}
              />
              <button
                type="button"
                disabled={discoverQuery.isFetching}
                onClick={() => void discoverQuery.refetch()}
                className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1.5"
              >
                <span className="emoji-bw">ðŸ”„</span>
                {discoverQuery.isFetching ? 'Scanning...' : 'Scan Path'}
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {discoverQuery.isLoading ? (
                <div className="p-8 text-center text-xs text-ink-2">Scanning VPS filesystem...</div>
              ) : discoverQuery.data?.length === 0 ? (
                <div className="p-6 text-center space-y-2 border border-line/60 rounded-lg bg-page/50">
                  <span className="emoji-bw text-xl block">ðŸ“‚</span>
                  <p className="text-xs font-medium text-ink">No .env files found in current scan path</p>
                  <p className="text-[11px] text-muted max-w-md mx-auto leading-relaxed">
                    This is completely normal if repositories keep their <code>.env</code> files gitignored or if files are in a different directory. You can specify a custom VPS path above (e.g. <code>/home/adminnico/repositories</code>) or manually paste your variables using <strong>Import .env</strong>.
                  </p>
                </div>
              ) : (
                discoverQuery.data?.map((file) => {
                  const wasImported = importedFileSuccess === file.path;

                  return (
                    <div
                      key={file.path}
                      className="p-3 bg-page border border-line rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-ink font-semibold">{file.projectName}</strong>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-muted font-mono">
                            {file.variableCount} variables
                          </span>
                          {file.alreadyConfigured && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                              Configured
                            </span>
                          )}
                          {wasImported && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              âœ“ Imported into Vault
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted font-mono truncate">{file.path}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={importFileMutation.isPending}
                          onClick={() => {
                            importFileMutation.mutate({
                              filePath: file.path,
                              project: file.projectName,
                            });
                          }}
                          className="btn btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1"
                          title="Read this file and encrypt all its variables into the Vault"
                        >
                          <span className="emoji-bw">ðŸ“¥</span> Import into Vault
                        </button>

                        {!file.alreadyConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              configMutation.mutate({
                                projectName: file.projectName,
                                filePath: file.path,
                                environment: 'production',
                                criticality: 'MEDIUM',
                                lastSyncedAt: null,
                              });
                            }}
                            className="btn btn-secondary text-xs px-2.5 py-1.5"
                          >
                            Add to Inventory
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT PROJECT CONFIG MODAL
          ========================================================================= */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">âš™ï¸</span> Configure {editingConfig.projectName}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-ink-2 block mb-1">Absolute File Path on VPS</label>
                <input
                  type="text"
                  value={cfgFilePath}
                  onChange={(e) => setCfgFilePath(e.target.value)}
                  placeholder="/home/adminnico/repositories/.../.env"
                  className="input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-ink-2 block mb-1">Docker Compose Service</label>
                <input
                  type="text"
                  value={cfgDockerService}
                  onChange={(e) => setCfgDockerService(e.target.value)}
                  placeholder="e.g. api,worker"
                  className="input w-full font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-ink-2 block mb-1">Environment</label>
                  <select
                    value={cfgEnvironment}
                    onChange={(e) => setCfgEnvironment(e.target.value as VaultEnvironment)}
                    className="input w-full text-xs"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-ink-2 block mb-1">Criticality</label>
                  <select
                    value={cfgCriticality}
                    onChange={(e) => setCfgCriticality(e.target.value as VaultCriticality)}
                    className="input w-full text-xs"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingConfig(null)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={configMutation.isPending || !cfgFilePath.trim()}
                onClick={() => {
                  configMutation.mutate({
                    projectName: editingConfig.projectName,
                    filePath: cfgFilePath.trim(),
                    dockerService: cfgDockerService.trim() || undefined,
                    environment: cfgEnvironment,
                    criticality: cfgCriticality,
                    lastSyncedAt: editingConfig.lastSyncedAt,
                  });
                }}
                className="btn btn-primary text-xs px-3 py-1.5"
              >
                {configMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Secret Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">{editingItem ? 'âœï¸' : 'âž•'}</span>
              {editingItem ? 'Edit Secret' : 'Add New Secret'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Key Name</label>
                <input
                  type="text"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toUpperCase())}
                  placeholder="e.g. POSTGRES_PASSWORD"
                  className="input w-full text-xs font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Project Name</label>
                <input
                  type="text"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  placeholder="control-center"
                  className="input w-full text-xs font-mono"
                  list="project-list"
                />
                <datalist id="project-list">
                  {projects.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Secret Value</label>
                <textarea
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="Enter token, password, connection string..."
                  rows={3}
                  className="input w-full text-xs font-mono resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Production Supabase pooler URL"
                  className="input w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isSecretCheck"
                  checked={formIsSecret}
                  onChange={(e) => setFormIsSecret(e.target.checked)}
                  className="rounded border-line"
                />
                <label htmlFor="isSecretCheck" className="text-xs text-ink select-none cursor-pointer">
                  Mask value in UI by default (sensitive credential)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!formKey.trim() || upsertMutation.isPending}
                onClick={() => {
                  upsertMutation.mutate({
                    id: editingItem?.id,
                    key: formKey.trim(),
                    value: formValue,
                    project: formProject.trim() || 'control-center',
                    description: formDescription.trim(),
                    isSecret: formIsSecret,
                  });
                }}
                className="btn btn-primary text-xs px-3 py-1.5"
              >
                {upsertMutation.isPending ? 'Saving...' : 'Save Secret'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import .env Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-lg p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">ðŸ“¥</span> Import from .env File
            </h3>
            <p className="text-xs text-ink-2">
              Paste raw contents of a <span className="font-mono">.env</span> file. Each line will be securely encrypted into the vault.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Target Project</label>
                <input
                  type="text"
                  value={importProject}
                  onChange={(e) => setImportProject(e.target.value)}
                  placeholder="e.g. control-center"
                  className="input w-full text-xs font-mono"
                  list="import-project-list"
                />
                <datalist id="import-project-list">
                  {projects.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-2 block mb-1">Paste .env Content</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`DATABASE_URL="postgres://user:pass@host:5432/db"\nAPI_SECRET=my-super-secret-token\nPORT=3000`}
                  rows={8}
                  className="input w-full text-xs font-mono resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importText.trim() || importMutation.isPending}
                onClick={() => {
                  importMutation.mutate({
                    project: importProject.trim() || 'control-center',
                    envText: importText,
                  });
                }}
                className="btn btn-primary text-xs px-3 py-1.5"
              >
                {importMutation.isPending ? 'Importing...' : 'Import Variables'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export .env Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-lg p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">ðŸ“¤</span> Export .env ({exportProject})
            </h3>

            <div>
              <label className="text-xs font-medium text-ink-2 block mb-1">Project Variables</label>
              <textarea
                readOnly
                value={exportText}
                rows={9}
                className="input w-full text-xs font-mono resize-none leading-relaxed bg-page"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => downloadEnvFile(exportProject, exportText)}
                className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <span className="emoji-bw">ðŸ’¾</span> Download .env
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(exportText);
                    setCopiedExport(true);
                    setTimeout(() => setCopiedExport(false), 2000);
                  }}
                  className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  <span className="emoji-bw">{copiedExport ? 'âœ“' : 'ðŸ“‹'}</span>
                  {copiedExport ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-danger flex items-center gap-2">
              <span className="emoji-bw">âš ï¸</span> Delete Secret
            </h3>

            <p className="text-xs text-ink-2">
              Are you sure you want to delete secret <strong className="text-ink font-mono">{itemToDelete.key}</strong> from project <strong className="text-ink">{itemToDelete.project}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(itemToDelete.id)}
                className="btn bg-danger text-white hover:bg-danger/90 text-xs px-3 py-1.5"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
