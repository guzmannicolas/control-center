import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DirectoryListing, FileItem } from '@cc/shared';
import { api } from '../api.ts';

export function FilesPage() {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // New item modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'file' | 'directory'>('file');

  // Delete modal
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);

  // Query directory contents
  const { data: listing, isLoading, error, refetch } = useQuery<DirectoryListing>({
    queryKey: ['files', currentPath],
    queryFn: () => api.filesList(currentPath),
  });

  // Query file content when selected
  const fileQuery = useQuery({
    queryKey: ['fileContent', selectedFile],
    queryFn: () => (selectedFile ? api.filesRead(selectedFile) : null),
    enabled: !!selectedFile,
  });

  useEffect(() => {
    if (fileQuery.data) {
      setFileContent(fileQuery.data.content);
      setOriginalContent(fileQuery.data.content);
      setEditorError(null);
    }
  }, [fileQuery.data]);

  // Save file mutation
  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      api.filesWrite(path, content),
    onSuccess: () => {
      setOriginalContent(fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      void queryClient.invalidateQueries({ queryKey: ['files', currentPath] });
    },
    onError: (err: any) => {
      setEditorError(err.message || 'Failed to save file');
    },
  });

  // Create entry mutation
  const createMutation = useMutation({
    mutationFn: ({ path, name, type }: { path: string; name: string; type: 'file' | 'directory' }) =>
      api.filesCreate({ path, name, type }),
    onSuccess: () => {
      setCreateModalOpen(false);
      setNewItemName('');
      void refetch();
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: (path: string) => api.filesDelete(path),
    onSuccess: () => {
      setItemToDelete(null);
      void refetch();
    },
  });

  const handleSave = () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setEditorError(null);
    saveMutation.mutate(
      { path: selectedFile, content: fileContent },
      {
        onSettled: () => setIsSaving(false),
      },
    );
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && selectedFile) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, fileContent]);

  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  const getFileIcon = (item: FileItem) => {
    if (item.isDirectory) return '📁';
    if (item.name.startsWith('.env') || item.extension === 'env') return '⚙️';
    if (['json', 'yml', 'yaml', 'toml', 'conf'].includes(item.extension)) return '⚙️';
    if (['md', 'txt', 'log'].includes(item.extension)) return '📝';
    if (['ts', 'js', 'tsx', 'jsx', 'py', 'sh'].includes(item.extension)) return '💻';
    return '📄';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <span className="emoji-bw">📁</span> VPS File Manager
          </h1>
          <p className="text-xs text-ink-2 mt-0.5">
            Safely navigate, inspect, and edit server files and environment configs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewItemType('file');
              setCreateModalOpen(true);
            }}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">📄</span> New File
          </button>
          <button
            type="button"
            onClick={() => {
              setNewItemType('directory');
              setCreateModalOpen(true);
            }}
            className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="emoji-bw">📁</span> New Folder
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            className="btn btn-secondary text-xs px-2.5 py-1.5"
            title="Refresh directory"
          >
            <span className="emoji-bw">🔄</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Path Bar */}
      <div className="flex items-center gap-1.5 bg-card/60 border border-line px-3 py-2 rounded-lg text-xs overflow-x-auto scrollbar-none font-mono">
        <button
          type="button"
          onClick={() => setCurrentPath('')}
          className={`hover:text-series transition ${currentPath === '' ? 'text-ink font-semibold' : 'text-ink-2'}`}
        >
          {listing?.baseDir || '~'}
        </button>
        {breadcrumbs.map((segment, idx) => {
          const pathToHere = breadcrumbs.slice(0, idx + 1).join('/');
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <div key={pathToHere} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-muted">/</span>
              <button
                type="button"
                onClick={() => setCurrentPath(pathToHere)}
                className={`hover:text-series transition ${isLast ? 'text-ink font-semibold' : 'text-ink-2'}`}
              >
                {segment}
              </button>
            </div>
          );
        })}
      </div>

      {/* Directory Contents */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-ink-2">Loading directory listing...</div>
      ) : error ? (
        <div className="card p-4 border-danger/40 text-danger text-sm">
          Failed to load directory: {(error as any).message || 'Unknown error'}
        </div>
      ) : (
        <div className="card overflow-hidden border border-line">
          {/* Back button row if in subfolder */}
          {listing?.parentPath !== null && (
            <div
              onClick={() => setCurrentPath(listing?.parentPath ?? '')}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-subtle/40 border-b border-line hover:bg-subtle cursor-pointer text-xs font-mono text-ink-2 transition select-none"
            >
              <span className="emoji-bw">⤴️</span>
              <span>.. (Parent directory)</span>
            </div>
          )}

          {listing?.items.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-2">This folder is empty.</div>
          ) : (
            <div className="divide-y divide-line">
              {listing?.items.map((item) => (
                <div
                  key={item.path}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-subtle/50 transition group"
                >
                  {/* Left: Icon & Name */}
                  <div
                    onClick={() => {
                      if (item.isDirectory) {
                        setCurrentPath(item.path);
                      } else if (item.isEditable) {
                        setSelectedFile(item.path);
                      }
                    }}
                    className={`flex items-center gap-3 min-w-0 flex-1 select-none ${
                      item.isDirectory || item.isEditable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="emoji-bw text-sm flex-shrink-0">{getFileIcon(item)}</span>
                    <span
                      className={`truncate text-xs ${
                        item.isDirectory
                          ? 'font-medium text-ink hover:text-series'
                          : item.isEditable
                          ? 'text-ink hover:text-series'
                          : 'text-ink-2'
                      }`}
                    >
                      {item.name}
                    </span>
                    {!item.isDirectory && !item.isEditable && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-muted flex-shrink-0">
                        Binary / Large
                      </span>
                    )}
                  </div>

                  {/* Right: Meta & Actions */}
                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <span className="text-muted font-mono text-[11px] hidden sm:inline-block w-20 text-right">
                      {item.sizeHuman}
                    </span>
                    <span className="text-muted text-[11px] hidden md:inline-block w-28 text-right">
                      {item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString() : '--'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.isEditable && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(item.path)}
                          className="btn btn-secondary text-[11px] px-2 py-1"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1 hover:text-danger text-muted transition rounded"
                        title={`Delete ${item.name}`}
                      >
                        <span className="emoji-bw text-xs">🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Editor Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-subtle/30 flex-shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="emoji-bw">📝</span>
                  <h2 className="text-sm font-semibold truncate font-mono text-ink">
                    {selectedFile.split('/').pop()}
                  </h2>
                  {fileContent !== originalContent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
                      Unsaved
                    </span>
                  )}
                  {saveSuccess && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">
                      Saved ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted truncate font-mono mt-0.5">{selectedFile}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || fileContent === originalContent}
                  className="btn btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="btn btn-secondary text-xs px-2.5 py-1.5"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Editor Error */}
            {editorError && (
              <div className="bg-danger/10 border-b border-danger/30 px-4 py-2 text-danger text-xs flex-shrink-0">
                {editorError}
              </div>
            )}

            {/* Code / Text Area */}
            <div className="flex-1 min-h-[350px] relative bg-page p-2 sm:p-3 overflow-hidden flex flex-col">
              {fileQuery.isLoading ? (
                <div className="flex-1 flex items-center justify-center text-ink-2 text-xs">
                  Loading file content...
                </div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="flex-1 w-full h-full p-3 font-mono text-xs bg-card border border-line rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-series leading-relaxed text-ink"
                  spellCheck={false}
                  placeholder="Empty file..."
                />
              )}
            </div>

            {/* Footer with hint */}
            <div className="px-4 py-2 border-t border-line bg-subtle/20 flex items-center justify-between text-[11px] text-muted">
              <span>Lines: {fileContent.split('\n').length}</span>
              <span>Characters: {fileContent.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* New File / Folder Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <span className="emoji-bw">{newItemType === 'directory' ? '📁' : '📄'}</span>
              Create New {newItemType === 'directory' ? 'Folder' : 'File'}
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-ink-2">Name</label>
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={newItemType === 'directory' ? 'e.g. my-folder' : 'e.g. .env.staging'}
                className="input w-full text-xs font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemName.trim()) {
                    createMutation.mutate({
                      path: currentPath,
                      name: newItemName.trim(),
                      type: newItemType,
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newItemName.trim() || createMutation.isPending}
                onClick={() => {
                  createMutation.mutate({
                    path: currentPath,
                    name: newItemName.trim(),
                    type: newItemType,
                  });
                }}
                className="btn btn-primary text-xs px-3 py-1.5"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card border border-line rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-4">
            <h3 className="text-sm font-semibold text-danger flex items-center gap-2">
              <span className="emoji-bw">⚠️</span>
              Delete {itemToDelete.isDirectory ? 'Folder' : 'File'}
            </h3>

            <p className="text-xs text-ink-2">
              Are you sure you want to permanently delete{' '}
              <strong className="text-ink font-mono">{itemToDelete.name}</strong>?
              {itemToDelete.isDirectory && ' All files and folders inside it will also be deleted.'}
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
                onClick={() => deleteMutation.mutate(itemToDelete.path)}
                className="btn bg-danger text-white hover:bg-danger/90 text-xs px-3 py-1.5"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
