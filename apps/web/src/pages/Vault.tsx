import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VaultItem, VaultOverview } from '@cc/shared';
import { api } from '../api.ts';

export function VaultPage() {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add / Edit Modal
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formProject, setFormProject] = useState('global');
  const [formDescription, setFormDescription] = useState('');
  const [formIsSecret, setFormIsSecret] = useState(true);

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProject, setImportProject] = useState('global');
  const [importText, setImportText] = useState('');

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProject, setExportProject] = useState('global');
  const [exportText, setExportText] = useState('');
  const [copiedExport, setCopiedExport] = useState(false);

  // Delete Modal
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);

  const { data: vault, isLoading, error, refetch } = useQuery<VaultOverview>({
    queryKey: ['vault'],
    queryFn: api.vaultOverview,
  });

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.vaultDelete(id),
    onSuccess: () => {
      setItemToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openAddModal = (projectPrefill = 'global') => {
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

  const projects = vault?.projects ?? ['global'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span className="emoji-bw">🔑</span> Env Vault & Secrets
          </h1>
          <p className="text-xs text-ink-2 mt-0.5">
            Centralized encrypted storage for API keys, database credentials, and project .env variables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAddModal()}
            className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">➕</span> Add Secret
          </button>
          <button
            type="button"
            onClick={() => {
              setImportProject(selectedProject !== 'all' ? selectedProject : 'global');
              setIsImportModalOpen(true);
            }}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">📥</span> Import .env
          </button>
          <button
            type="button"
            onClick={() => openExportModal(selectedProject !== 'all' ? selectedProject : 'global')}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">📤</span> Export
          </button>
        </div>
      </div>

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

      {/* Secrets List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-ink-2">Loading encrypted secrets...</div>
      ) : error ? (
        <div className="card p-4 border-danger/40 text-danger text-sm">
          Failed to load vault items: {(error as any).message || 'Unknown error'}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card p-8 text-center space-y-2 border border-line">
          <div className="emoji-bw text-2xl">🔒</div>
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
              <span className="emoji-bw">➕</span> Add First Secret
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
                      {isRevealed ? item.value : '••••••••••••••••'}
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
                        <span className="emoji-bw">{isRevealed ? '🙈' : '👁️'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.value, item.id)}
                      className="btn btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
                      title="Copy value"
                    >
                      <span className="emoji-bw">{isCopied ? '✓' : '📋'}</span>
                      <span className="text-[11px] hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="btn btn-secondary text-xs px-2.5 py-1.5"
                      title="Edit secret"
                    >
                      <span className="emoji-bw">✏️</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 text-muted hover:text-danger transition rounded"
                      title="Delete secret"
                    >
                      <span className="emoji-bw">🗑️</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Secret Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">{editingItem ? '✏️' : '➕'}</span>
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
                  placeholder="e.g. control-center, minijuegos, global"
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
                    project: formProject.trim() || 'global',
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
              <span className="emoji-bw">📥</span> Import from .env File
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
                    project: importProject.trim() || 'global',
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
              <span className="emoji-bw">📤</span> Export .env ({exportProject})
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
                <span className="emoji-bw">💾</span> Download .env
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
                  <span className="emoji-bw">{copiedExport ? '✓' : '📋'}</span>
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
              <span className="emoji-bw">⚠️</span> Delete Secret
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
