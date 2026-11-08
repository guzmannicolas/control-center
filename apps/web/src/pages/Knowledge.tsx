import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { KnowledgeDocMeta, KnowledgeDocDetail } from '@cc/shared';
import { api } from '../api.ts';

// Markdown simple renderer for preview
function MarkdownRenderer({ content }: { content: string }) {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const copySnippet = (code: string, idx: number) => {
    void navigator.clipboard.writeText(code);
    setCopiedCodeIndex(idx);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Parse lines into tokens
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let codeBlockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeText = codeBlockLines.join('\n');
        const codeIdx = codeBlockCount++;
        elements.push(
          <div
            key={`code-${i}`}
            style={{
              margin: '0.8rem 0',
              background: '#050811',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.35rem 0.75rem',
                background: '#0f172a',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.74rem',
                color: '#94a3b8',
                fontWeight: 600,
              }}
            >
              <span>{codeBlockLang || 'Code'}</span>
              <button
                type="button"
                onClick={() => copySnippet(codeText, codeIdx)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copiedCodeIndex === codeIdx ? '#4ade80' : '#60a5fa',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copiedCodeIndex === codeIdx ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '0.75rem 0.85rem',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                color: '#e2e8f0',
                overflowX: 'auto',
                lineHeight: 1.5,
              }}
            >
              {codeText}
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} style={{ fontSize: '1.45rem', color: '#f8fafc', margin: '1.2rem 0 0.5rem', fontWeight: 700 }}>
          {line.slice(2)}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} style={{ fontSize: '1.2rem', color: '#38bdf8', margin: '1.1rem 0 0.45rem', fontWeight: 700 }}>
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} style={{ fontSize: '1.05rem', color: '#cbd5e1', margin: '0.9rem 0 0.4rem', fontWeight: 600 }}>
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${i}`} style={{ fontSize: '0.92rem', color: '#94a3b8', margin: '0.75rem 0 0.35rem', fontWeight: 600 }}>
          {line.slice(5)}
        </h4>
      );
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '1rem 0' }} />);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            margin: '0.5rem 0',
            paddingLeft: '0.85rem',
            borderLeft: '3px solid #3b82f6',
            color: '#94a3b8',
            fontSize: '0.84rem',
            lineHeight: 1.5,
          }}
        >
          {line.slice(2)}
        </blockquote>
      );
      continue;
    }

    // List item
    if (line.match(/^[-*]\s+/)) {
      elements.push(
        <li key={`li-${i}`} style={{ marginLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.6 }}>
          {line.replace(/^[-*]\s+/, '')}
        </li>
      );
      continue;
    }

    // Numbered list item
    if (line.match(/^\d+\.\s+/)) {
      elements.push(
        <li key={`nli-${i}`} style={{ marginLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.6 }}>
          {line.replace(/^\d+\.\s+/, '')}
        </li>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} style={{ height: '0.4rem' }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: '0.35rem 0', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.6 }}>
        {line}
      </p>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
}

export function KnowledgePage() {
  const queryClient = useQueryClient();
  const [activeSlug, setActiveSlug] = useState<string>('index');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview');
  const [editableContent, setEditableContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mcpModalOpen, setMcpModalOpen] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Load document metadata tree
  const { data: docs = [], isLoading: isListLoading } = useQuery<KnowledgeDocMeta[]>({
    queryKey: ['knowledgeList'],
    queryFn: () => api.knowledgeList(),
  });

  // Load active document details
  const { data: activeDoc, isLoading: isDocLoading } = useQuery<KnowledgeDocDetail>({
    queryKey: ['knowledgeDoc', activeSlug],
    queryFn: () => api.knowledgeGet(activeSlug),
    enabled: Boolean(activeSlug),
  });

  // Sync content into editor when doc loads
  useEffect(() => {
    if (activeDoc) {
      setEditableContent(activeDoc.content);
      setHasUnsavedChanges(false);
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [activeDoc]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: ({ slug, content }: { slug: string; content: string }) => api.knowledgeSave(slug, content),
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ['knowledgeList'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledgeDoc', activeSlug] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    },
  });

  const handleSave = () => {
    if (!activeSlug) return;
    saveMutation.mutate({ slug: activeSlug, content: editableContent });
  };

  const handleCopyLlmContext = async () => {
    try {
      const res = await api.agentContext('all');
      const text = typeof res === 'string' ? res : res.context;
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Full LLM Context Copied!');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      // Fallback to active document content
      if (editableContent) {
        await navigator.clipboard.writeText(editableContent);
        setCopyFeedback('Active Document Copied!');
        setTimeout(() => setCopyFeedback(null), 2500);
      }
    }
  };

  const handleCopyCurrentMarkdown = () => {
    if (editableContent) {
      void navigator.clipboard.writeText(editableContent);
      setCopyFeedback('Document Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  // Filter docs
  const filteredDocs = docs.filter((doc) => {
    if (activeCategory !== 'all' && doc.category !== activeCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.slug.toLowerCase().includes(q);
    }
    return true;
  });

  // Counts for metrics banner
  const countSkills = docs.filter((d) => d.category === 'skills').length;
  const countArch = docs.filter((d) => d.category === 'architecture' || d.category === 'database').length;
  const countPlaybooks = docs.filter((d) => d.category === 'playbooks').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Knowledge Base & Neural Hub
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
            Canonical repository of intelligence, agent skills, system architecture, operational SOPs, and MCP hub.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopyLlmContext}
            style={{
              background: '#1e3a8a',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
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
            {copyFeedback ? copyFeedback : 'Copy Context for LLM'}
          </button>

          <button
            type="button"
            onClick={() => setMcpModalOpen(true)}
            style={{
              background: '#064e3b',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Connect External Agents (MCP)
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Active Documents</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {docs.length} Canonical Docs
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>Agent Skills</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
            {countSkills} Extracted Skills
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Topologies & Schema</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
            {countArch} Architecture Nodes
          </div>
        </div>

        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ fontSize: '0.74rem', color: '#facc15', textTransform: 'uppercase', fontWeight: 600 }}>Operational SOPs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15', marginTop: '0.2rem' }}>
            {countPlaybooks} Recovery Playbooks
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Document Navigation & Filters */}
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'core', label: 'Core' },
              { id: 'architecture', label: 'Arch' },
              { id: 'skills', label: 'Skills' },
              { id: 'playbooks', label: 'SOPs' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  background: activeCategory === cat.id ? '#1e293b' : 'transparent',
                  border: `1px solid ${activeCategory === cat.id ? '#3b82f6' : '#334155'}`,
                  color: activeCategory === cat.id ? '#f8fafc' : '#94a3b8',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          {/* Document List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '580px', overflowY: 'auto' }}>
            {isListLoading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                Loading knowledge tree...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                No documents found.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = doc.slug === activeSlug;
                return (
                  <button
                    key={doc.slug}
                    type="button"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        const confirmLeave = window.confirm('You have unsaved changes. Switch document anyway?');
                        if (!confirmLeave) return;
                      }
                      setActiveSlug(doc.slug);
                    }}
                    style={{
                      textAlign: 'left',
                      background: isSelected ? '#1e293b' : 'transparent',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#1e293b'}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: isSelected ? '#f8fafc' : '#cbd5e1' }}>
                        {doc.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: doc.category === 'skills' ? '#064e3b' : doc.category === 'playbooks' ? '#450a0a' : '#1e3a8a',
                          color: doc.category === 'skills' ? '#6ee7b7' : doc.category === 'playbooks' ? '#fca5a5' : '#93c5fd',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        {doc.category}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {doc.relativePath}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Viewer & Editor */}
        <div style={{ background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Active Document Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                  {activeDoc?.meta.title || activeSlug}
                </h2>
                {hasUnsavedChanges && (
                  <span style={{ background: '#854d0e', color: '#fef08a', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                    Unsaved
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                knowledge/{activeSlug}.md · {activeDoc ? `${(activeDoc.meta.sizeBytes / 1024).toFixed(1)} KB` : ''} · Updated: {activeDoc?.meta.lastModified ? new Date(activeDoc.meta.lastModified).toLocaleString() : ''}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Mode Switcher */}
              <div style={{ display: 'flex', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setEditorMode('preview')}
                  style={{
                    background: editorMode === 'preview' ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: editorMode === 'preview' ? '#38bdf8' : '#94a3b8',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('edit')}
                  style={{
                    background: editorMode === 'edit' ? '#1e293b' : 'transparent',
                    border: 'none',
                    color: editorMode === 'edit' ? '#38bdf8' : '#94a3b8',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit Markdown
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCurrentMarkdown}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy Markdown
              </button>

              {editorMode === 'edit' && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !hasUnsavedChanges}
                  style={{
                    background: hasUnsavedChanges ? '#16a34a' : '#1e293b',
                    border: `1px solid ${hasUnsavedChanges ? '#22c55e' : '#334155'}`,
                    color: hasUnsavedChanges ? '#ffffff' : '#64748b',
                    borderRadius: '6px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: hasUnsavedChanges ? 'pointer' : 'default',
                  }}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save to Disk'}
                </button>
              )}
            </div>
          </div>

          {/* Feedback Alerts */}
          {saveSuccess && (
            <div style={{ background: '#052e16', border: '1px solid #166534', color: '#4ade80', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
              Document saved directly to disk on server.
            </div>
          )}
          {saveError && (
            <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
              Error saving document: {saveError}
            </div>
          )}

          {/* Editor / Viewer Body */}
          {isDocLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
              Reading document content from disk...
            </div>
          ) : editorMode === 'edit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Direct file edit: modifications are written directly to knowledge/{activeSlug}.md.
              </div>
              <textarea
                value={editableContent}
                onChange={(e) => {
                  setEditableContent(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                rows={24}
                style={{
                  width: '100%',
                  background: '#050811',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>
          ) : (
            <div style={{ minHeight: '380px' }}>
              <MarkdownRenderer content={editableContent || activeDoc?.content || ''} />
            </div>
          )}
        </div>
      </div>

      {/* MCP Connection Modal */}
      {mcpModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0b0f19',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc' }}>
                  Model Context Protocol (MCP) Setup
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Connect Cursor AI, Claude Desktop, Antigravity, or Roo Code directly to this Knowledge Base.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMcpModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                X
              </button>
            </div>

            {/* Stdio Configuration (Cursor & Claude Desktop) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                Cursor AI Setup (.cursor/mcp.json)
              </span>
              <pre
                style={{
                  background: '#050811',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontFamily: 'monospace',
                  fontSize: '0.76rem',
                  color: '#e2e8f0',
                  overflowX: 'auto',
                }}
              >
{`{
  "mcpServers": {
    "control-center-knowledge": {
      "command": "node",
      "args": ["scripts/mcp-server.mjs"]
    }
  }
}`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`{\n  "mcpServers": {\n    "control-center-knowledge": {\n      "command": "node",\n      "args": ["scripts/mcp-server.mjs"]\n    }\n  }\n}`);
                  setCopyFeedback('Cursor Config Copied!');
                  setTimeout(() => setCopyFeedback(null), 2000);
                }}
                style={{
                  alignSelf: 'flex-start',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Copy Cursor Config
              </button>
            </div>

            {/* Claude Desktop Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#a78bfa' }}>
                Claude Desktop Setup (claude_desktop_config.json)
              </span>
              <pre
                style={{
                  background: '#050811',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  fontFamily: 'monospace',
                  fontSize: '0.76rem',
                  color: '#e2e8f0',
                  overflowX: 'auto',
                }}
              >
{`{
  "mcpServers": {
    "control-center": {
      "command": "node",
      "args": ["C:/Users/User/.gemini/antigravity/scratch/control-center/scripts/mcp-server.mjs"]
    }
  }
}`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`{\n  "mcpServers": {\n    "control-center": {\n      "command": "node",\n      "args": ["C:/Users/User/.gemini/antigravity/scratch/control-center/scripts/mcp-server.mjs"]\n    }\n  }\n}`);
                  setCopyFeedback('Claude Desktop Config Copied!');
                  setTimeout(() => setCopyFeedback(null), 2000);
                }}
                style={{
                  alignSelf: 'flex-start',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Copy Claude Config
              </button>
            </div>

            {/* HTTP / Remote Agents Endpoint */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#34d399' }}>
                HTTP / Remote Endpoints for LLMs
              </span>
              <div style={{ background: '#050811', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem', fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                <div><strong>System Context:</strong> GET https://control-api.nicoguzmandev.com/api/agent/context?topic=all</div>
                <div><strong>Raw MCP JSON-RPC:</strong> POST https://control-api.nicoguzmandev.com/api/mcp</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setMcpModalOpen(false)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
