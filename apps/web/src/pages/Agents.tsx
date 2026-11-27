import { useState, useRef, useEffect, useMemo } from 'react';
import {
  AgentIcon,
  CheckIcon,
  ClipboardIcon,
  CloseIcon,
  EditIcon,
  FolderIcon,
  GearIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TerminalIcon,
  TrashIcon,
  VpsIcon,
} from '../components/Icons.tsx';

interface AgentEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
}

interface RepoOption {
  name: string;
  fullName: string;
  description: string;
  isPrivate: boolean;
  local: boolean;
  updatedAt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  contextLabel: string;
  events: AgentEvent[];
  status: 'streaming' | 'done' | 'error';
  createdAt?: string;
}

interface ChatSession {
  id: string;
  title: string;
  repo: string;
  provider?: 'gemini' | 'openrouter';
  model: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const GENERAL_CONTEXT = '__general__';
const STORAGE_KEY = 'cc_agent_sessions_v1';
const ACTIVE_SESSION_KEY = 'cc_agent_active_session_v1';
const LEGACY_SETTINGS_KEY = 'cc_agent_settings_v1';
const SIDEBAR_STATE_KEY = 'cc_agent_sidebar_open_v1';

interface AgentVaultConfig {
  defaultProvider: 'gemini' | 'openrouter';
  geminiConfigured: boolean;
  geminiMasked: string | null;
  openrouterConfigured: boolean;
  openrouterMasked: string | null;
}

const FALLBACK_REPOS: RepoOption[] = [
  { name: 'control-center', fullName: 'guzmannicolas/control-center', description: 'Control Center Monorepo', isPrivate: false, local: true },
  { name: 'minijuegos', fullName: 'guzmannicolas/minijuegos', description: 'Minijuegos Platform', isPrivate: true, local: true },
  { name: 'nikipepperstattoo', fullName: 'guzmannicolas/nikipepperstattoo', description: 'Niki Peppers Tattoo', isPrivate: false, local: true },
  { name: 'resume.nicoguzmandev', fullName: 'guzmannicolas/resume.nicoguzmandev', description: 'Interactive Resume', isPrivate: true, local: true },
  { name: 'susterart', fullName: 'guzmannicolas/susterart', description: 'Suster Art Portfolio', isPrivate: true, local: true },
];

const GEMINI_MODELS = [
  { id: 'auto', name: 'Auto Pool (Smart Failover)', badge: 'Recommended' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Balanced' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', badge: 'Fast' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', badge: 'Standard' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', badge: 'Reasoning' },
];

const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', badge: 'Meta' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', badge: 'Anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', badge: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', badge: 'Fast' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', badge: 'DeepSeek' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', badge: 'Reasoning' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'OpenRouter' },
];

const QUICK_PROMPTS = [
  {
    title: 'VPS Health & Disk Audit',
    subtitle: 'Inspect RAM, swap, disk usage, and active Docker containers',
    category: 'Infrastructure',
    repo: GENERAL_CONTEXT,
    icon: 'vps' as const,
    prompt:
      'Check overall VPS status: RAM and swap usage (free -h), what consumes most disk space (df -h /host, docker system df and du in /home/adminnico), and which containers are running.',
  },
  {
    title: 'Git Status Across Repositories',
    subtitle: 'Check active branches and uncommitted changes in all local repos',
    category: 'Git & Repos',
    repo: GENERAL_CONTEXT,
    icon: 'folder' as const,
    prompt:
      'Inspect all git repositories under /home/adminnico/repositories and tell me the current branch for each one and if any has uncommitted changes.',
  },
  {
    title: 'Control Center Architecture',
    subtitle: 'Review monorepo workspaces, scripts, and backend endpoints',
    category: 'Codebase',
    repo: 'control-center',
    icon: 'terminal' as const,
    prompt:
      'Inspect repository structure, read package.json, and provide a technical architecture summary and available scripts.',
  },
  {
    title: 'Container Logs & Diagnostics',
    subtitle: 'Verify recent logs and health status of API, Worker, and Caddy',
    category: 'Diagnostics',
    repo: GENERAL_CONTEXT,
    icon: 'agent' as const,
    prompt:
      'Check the last 25 log lines of control-center-api-1 and control-center-worker-1, and verify if there are any recent errors or warnings.',
  },
];

function loadLocalSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

function purgeLegacyLocalStorageSecrets() {
  try {
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch {
    // ignore
  }
}

// --- SVG Icons specific to Chat UI ---
function SidebarToggleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function SendArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function StopSquareIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function ChevronDownIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// --- Lightweight Markdown & Code Block Renderer ---
function renderInlineFormatting(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-series"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-[#0d0d0d] text-[#f0efec] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-mono text-neutral-400">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-white/10 hover:text-white transition"
        >
          {copied ? (
            <>
              <CheckIcon size={12} className="text-good" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <ClipboardIcon size={12} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const result: Array<{ type: 'text' | 'code'; lang?: string; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      result.push({ type: 'code', lang: match[1] || 'text', value: (match[2] || '').replace(/\n$/, '') });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < content.length) {
      result.push({ type: 'text', value: content.slice(lastIndex) });
    }
    return result;
  }, [content]);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink">
      {blocks.map((b, idx) => {
        if (b.type === 'code') {
          return <CodeBlock key={idx} language={b.lang || 'text'} code={b.value} />;
        }

        const lines = b.value.split('\n');
        return (
          <div key={idx} className="space-y-2">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lineIdx} className="h-1" />;

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lineIdx} className="pt-2 text-sm font-semibold text-ink">
                    {renderInlineFormatting(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lineIdx} className="pt-2 text-base font-semibold text-ink">
                    {renderInlineFormatting(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lineIdx} className="pt-2 text-lg font-bold text-ink">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </h2>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex items-start gap-2.5 pl-1">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-series" />
                    <span className="flex-1">{renderInlineFormatting(trimmed.slice(2))}</span>
                  </div>
                );
              }
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lineIdx} className="flex items-start gap-2 pl-1">
                    <span className="font-mono text-xs font-semibold text-muted mt-0.5">{numMatch[1]}.</span>
                    <span className="flex-1">{renderInlineFormatting(numMatch[2] || '')}</span>
                  </div>
                );
              }
              return (
                <p key={lineIdx} className="leading-relaxed">
                  {renderInlineFormatting(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AgentsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadLocalSessions());
  const [repos, setRepos] = useState<RepoOption[]>(FALLBACK_REPOS);
  const [vaultConfig, setVaultConfig] = useState<AgentVaultConfig>({
    defaultProvider: 'gemini',
    geminiConfigured: true,
    geminiMasked: null,
    openrouterConfigured: false,
    openrouterMasked: null,
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState<boolean>(false);
  const [sessionSearch, setSessionSearch] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string>(() => {
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    const local = loadLocalSessions();
    if (savedActive && local.some((s) => s.id === savedActive)) return savedActive;
    return local[0]?.id ?? `session-${Date.now()}`;
  });

  const activeSession = sessions.find((s) => s.id === sessionId);

  const [provider, setProvider] = useState<'gemini' | 'openrouter'>(
    activeSession?.provider ?? 'gemini'
  );
  const [repo, setRepo] = useState<string>(activeSession?.repo ?? GENERAL_CONTEXT);
  const [model, setModel] = useState<string>(
    activeSession?.model ?? (provider === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct' : 'auto')
  );
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(activeSession?.messages ?? []);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // Speech Recognition / Voice Dictation state
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const baseInputBeforeListeningRef = useRef<string>('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(sidebarOpen));
    } catch {
      // ignore
    }
  }, [sidebarOpen]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // Purge legacy plain-text keys from localStorage and fetch Vault config, repos, and sessions
  useEffect(() => {
    purgeLegacyLocalStorageSecrets();
    let active = true;

    fetch(`${BASE}/api/agent/config`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: AgentVaultConfig | null) => {
        if (!active || !cfg) return;
        setVaultConfig(cfg);
        if (!activeSession?.provider) {
          setProvider(cfg.defaultProvider);
          if (cfg.defaultProvider === 'openrouter') {
            setModel((prev) =>
              OPENROUTER_MODELS.some((m) => m.id === prev) ? prev : 'meta-llama/llama-3.3-70b-instruct'
            );
          } else {
            setModel((prev) => (GEMINI_MODELS.some((m) => m.id === prev) ? prev : 'auto'));
          }
        }
      })
      .catch(() => {});

    fetch(`${BASE}/api/agent/repos`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { repos?: RepoOption[] } | null) => {
        if (active && data?.repos && data.repos.length > 0) {
          setRepos(data.repos);
        }
      })
      .catch(() => {});

    fetch(`${BASE}/api/agent/sessions`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { sessions?: ChatSession[] } | null) => {
        if (!active || !data?.sessions || data.sessions.length === 0) return;
        setSessions((prev) => {
          const map = new Map<string, ChatSession>();
          for (const s of data.sessions!) map.set(s.id, s);
          for (const s of prev) {
            const existing = map.get(s.id);
            if (!existing || s.messages.length >= existing.messages.length) {
              map.set(s.id, s);
            }
          }
          const merged = Array.from(map.values()).sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          );
          saveLocalSessions(merged);
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [BASE]);

  // Persist current session to localStorage & server whenever messages change
  useEffect(() => {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    if (messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.role === 'user');
    const autoTitle = firstUserMsg
      ? firstUserMsg.text.length > 42
        ? firstUserMsg.text.slice(0, 42) + '...'
        : firstUserMsg.text
      : 'New conversation';

    const updatedSession: ChatSession = {
      id: sessionId,
      title: activeSession?.title ?? autoTitle,
      repo,
      provider,
      model,
      updatedAt: new Date().toISOString(),
      messages,
    };

    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      const next =
        idx >= 0
          ? [...prev.slice(0, idx), updatedSession, ...prev.slice(idx + 1)]
          : [updatedSession, ...prev];
      const sorted = next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      saveLocalSessions(sorted);
      return sorted;
    });

    fetch(`${BASE}/api/agent/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updatedSession),
    }).catch(() => {});
  }, [messages, sessionId, repo, provider, model, BASE]);

  // Scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  function handleProviderChange(newProvider: 'gemini' | 'openrouter') {
    setProvider(newProvider);
    if (newProvider === 'openrouter') {
      if (!OPENROUTER_MODELS.some((m) => m.id === model)) {
        setModel('meta-llama/llama-3.3-70b-instruct');
      }
    } else {
      if (!GEMINI_MODELS.some((m) => m.id === model)) {
        setModel('auto');
      }
    }
    fetch(`${BASE}/api/agent/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: newProvider }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: AgentVaultConfig | null) => {
        if (cfg) setVaultConfig(cfg);
      })
      .catch(() => {});
  }

  async function handleSaveSettings(newGeminiKey: string, newOpenRouterKey: string) {
    setSavingSettings(true);
    try {
      const res = await fetch(`${BASE}/api/agent/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          geminiApiKey: newGeminiKey.trim() || undefined,
          openrouterApiKey: newOpenRouterKey.trim() || undefined,
        }),
      });
      if (res.ok) {
        const cfg = (await res.json()) as AgentVaultConfig;
        setVaultConfig(cfg);
      }
    } catch {
      // ignore
    } finally {
      setSavingSettings(false);
      setShowSettingsModal(false);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }

  function handleSelectSession(targetId: string) {
    if (isRunning) handleStop();
    const found = sessions.find((s) => s.id === targetId);
    if (found) {
      setSessionId(found.id);
      setRepo(found.repo || GENERAL_CONTEXT);
      if (found.provider) setProvider(found.provider);
      setModel(found.model || 'auto');
      setMessages(found.messages || []);
      setMobileHistoryOpen(false);
    }
  }

  function handleNewChat() {
    if (isRunning) handleStop();
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setInput('');
    setMobileHistoryOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleDeleteSession(idToDelete: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (isRunning && idToDelete === sessionId) handleStop();
    const remaining = sessions.filter((s) => s.id !== idToDelete);
    setSessions(remaining);
    saveLocalSessions(remaining);

    fetch(`${BASE}/api/agent/sessions/${idToDelete}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});

    if (idToDelete === sessionId) {
      if (remaining.length > 0 && remaining[0]) {
        handleSelectSession(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  }

  function handleRenameSession(targetId: string, newTitle: string) {
    const trimmed = newTitle.trim();
    setEditingSessionId(null);
    if (!trimmed) return;

    setSessions((prev) => {
      const next = prev.map((s) => (s.id === targetId ? { ...s, title: trimmed } : s));
      saveLocalSessions(next);
      const updated = next.find((s) => s.id === targetId);
      if (updated) {
        fetch(`${BASE}/api/agent/sessions/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updated),
        }).catch(() => {});
      }
      return next;
    });
  }

  function toggleActivityExpand(msgId: string) {
    setExpandedActivity((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  }

  function toggleToolExpand(key: string) {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function copyMessageText(msgId: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1800);
  }

  function toggleListening() {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support native voice dictation (Web Speech API). Please use Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-AR';
      recognition.continuous = false;
      recognition.interimResults = false;

      baseInputBeforeListeningRef.current = input;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0] && res[0].transcript) {
            transcript += res[0].transcript;
          }
        }

        const spoken = transcript.trim();
        if (spoken) {
          const base = baseInputBeforeListeningRef.current.trim();
          const separator = base.length > 0 ? ' ' : '';
          setInput(`${base}${separator}${spoken}`);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  async function sendPrompt(promptText: string, overrideRepo?: string) {
    const trimmed = promptText.trim();
    if (!trimmed || isRunning) return;

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const targetRepo = overrideRepo ?? repo;
    if (overrideRepo && overrideRepo !== repo) {
      setRepo(overrideRepo);
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const contextLabel =
      targetRepo === GENERAL_CONTEXT
        ? 'General / VPS'
        : `${targetRepo}`;

    const history = messages
      .filter((m) => m.text.trim().length > 0)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: trimmed,
      contextLabel,
      events: [],
      status: 'done',
      createdAt: nowIso,
    };

    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      contextLabel,
      events: [],
      status: 'streaming',
      createdAt: nowIso,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          repo: targetRepo,
          instruction: trimmed,
          provider,
          model,
          history,
        }),
      });

      if (!res.ok) {
        let errContent = `HTTP error ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errContent = errJson.error;
        } catch {
          // ignore
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, status: 'error', text: errContent } : m
          )
        );
        setIsRunning(false);
        return;
      }

      if (!res.body) {
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const block of lines) {
          const trimmedLine = block.trim();
          if (!trimmedLine.startsWith('data: ')) continue;
          const jsonStr = trimmedLine.replace('data: ', '').trim();
          if (!jsonStr) continue;

          try {
            const event: AgentEvent = JSON.parse(jsonStr);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;

                const nextEvents = [...m.events, event];
                let nextText = m.text;
                let nextStatus = m.status;

                if (event.type === 'final') {
                  nextText = event.content;
                  nextStatus = 'done';
                } else if (event.type === 'error') {
                  nextText = event.content;
                  nextStatus = 'error';
                }

                return {
                  ...m,
                  events: nextEvents,
                  text: nextText,
                  status: nextStatus,
                };
              })
            );
          } catch {
            // ignore JSON parse error in streaming chunks
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, status: 'error', text: `Error: ${errorMsg}` } : m
          )
        );
      }
    } finally {
      setIsRunning(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId && m.status === 'streaming' ? { ...m, status: 'done' } : m
        )
      );
    }
  }

  const localRepos = repos.filter((r) => r.local);
  const cloudRepos = repos.filter((r) => !r.local);
  const currentModelList = provider === 'openrouter' ? OPENROUTER_MODELS : GEMINI_MODELS;

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.repo && s.repo.toLowerCase().includes(q))
    );
  }, [sessions, sessionSearch]);

  // Group sessions into Today, Previous 7 Days, Older
  const groupedSessions = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 86_400_000;
    const sevenDaysMs = 7 * oneDayMs;

    const today: ChatSession[] = [];
    const week: ChatSession[] = [];
    const older: ChatSession[] = [];

    for (const s of filteredSessions) {
      const ts = new Date(s.updatedAt).getTime();
      const age = now - (Number.isNaN(ts) ? 0 : ts);
      if (age < oneDayMs) today.push(s);
      else if (age < sevenDaysMs) week.push(s);
      else older.push(s);
    }

    return [
      { label: 'Today', items: today },
      { label: 'Previous 7 Days', items: week },
      { label: 'Older', items: older },
    ].filter((g) => g.items.length > 0);
  }, [filteredSessions]);

  const HistorySidebarContent = (
    <div className="flex h-full flex-col bg-surface/50 text-ink select-none">
      {/* Sidebar Header: New Chat + Collapse */}
      <div className="flex items-center gap-2 p-3 border-b border-line">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-page px-3 py-2 text-xs font-semibold text-ink shadow-2xs hover:border-series/50 hover:bg-surface transition cursor-pointer"
        >
          <PlusIcon size={15} className="text-series" />
          <span>New chat</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            setMobileHistoryOpen(false);
          }}
          title="Hide sidebar"
          className="flex size-8 items-center justify-center rounded-xl border border-line bg-page text-muted hover:text-ink transition cursor-pointer"
        >
          <SidebarToggleIcon size={15} />
        </button>
      </div>

      {/* Filter Conversations */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="relative flex items-center">
          <SearchIcon size={13} className="absolute left-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-lg border border-line bg-page/80 pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-series focus:outline-none"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {groupedSessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted">
            {sessionSearch ? 'No matching chats found.' : 'No saved conversations yet.'}
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((s) => {
                  const isActive = s.id === sessionId;
                  const isEditing = editingSessionId === s.id;
                  const repoBadge = s.repo === GENERAL_CONTEXT ? 'VPS' : s.repo;

                  return (
                    <li key={s.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSession(s.id, editingTitle);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            onBlur={() => handleRenameSession(s.id, editingTitle)}
                            className="w-full rounded-md border border-series bg-page px-2 py-1 text-xs text-ink focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => handleSelectSession(s.id)}
                          className={`group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition cursor-pointer ${
                            isActive
                              ? 'bg-page font-semibold text-ink shadow-2xs ring-1 ring-line'
                              : 'text-ink-2 hover:bg-page/60 hover:text-ink'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate leading-snug">{s.title}</div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted font-normal">
                              <span className="truncate max-w-[110px] font-mono">{repoBadge}</span>
                              <span>·</span>
                              <span>{s.messages.length} msg</span>
                            </div>
                          </div>

                          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              title="Rename chat"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(s.id);
                                setEditingTitle(s.title);
                              }}
                              className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink"
                            >
                              <EditIcon size={12} />
                            </button>
                            <button
                              type="button"
                              title="Delete chat"
                              onClick={(e) => handleDeleteSession(s.id, e)}
                              className="rounded-md p-1 text-muted hover:bg-surface hover:text-critical"
                            >
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Bottom Provider Card */}
      <div className="border-t border-line p-3 bg-page/40">
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-page px-3 py-2 text-left text-xs hover:border-series/40 transition cursor-pointer"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <span className="size-2 rounded-full bg-good" />
              <span>{provider === 'openrouter' ? 'OpenRouter API' : 'Google Gemini'}</span>
            </div>
            <div className="text-[10.5px] text-muted truncate mt-0.5">
              {currentModelList.find((m) => m.id === model)?.name ?? model}
            </div>
          </div>
          <GearIcon size={15} className="text-muted shrink-0" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-1 h-full w-full overflow-hidden bg-page text-ink">
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <GearIcon size={18} className="text-series" />
                <h3 className="text-base font-semibold text-ink">Provider & API Key Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-page hover:text-ink transition"
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const geminiKey = (form.elements.namedItem('geminiKey') as HTMLInputElement).value;
                const openrouterKey = (form.elements.namedItem('openrouterKey') as HTMLInputElement).value;
                handleSaveSettings(geminiKey, openrouterKey);
              }}
              className="mt-4 flex flex-col gap-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-ink mb-1.5">Active AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange('gemini')}
                    className={`rounded-xl border px-3 py-2.5 text-center font-medium transition cursor-pointer ${
                      provider === 'gemini'
                        ? 'border-series bg-series/15 text-series font-semibold'
                        : 'border-line bg-page text-muted hover:text-ink'
                    }`}
                  >
                    Google Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange('openrouter')}
                    className={`rounded-xl border px-3 py-2.5 text-center font-medium transition cursor-pointer ${
                      provider === 'openrouter'
                        ? 'border-series bg-series/15 text-series font-semibold'
                        : 'border-line bg-page text-muted hover:text-ink'
                    }`}
                  >
                    OpenRouter (Multi-LLM)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-ink">OpenRouter API Key (VPS Vault)</label>
                  {vaultConfig.openrouterConfigured ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-good/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-good">
                      <CheckIcon size={11} />
                      <span>Vault: {vaultConfig.openrouterMasked}</span>
                    </span>
                  ) : (
                    <span className="rounded-md bg-line px-2 py-0.5 font-mono text-[10px] text-muted">
                      Not configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  name="openrouterKey"
                  defaultValue=""
                  placeholder={
                    vaultConfig.openrouterConfigured
                      ? 'Stored in VPS Vault — enter a new key only to replace it'
                      : 'sk-or-v1-...'
                  }
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-ink placeholder:text-muted focus:border-series focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Encrypted with AES-256-GCM in the VPS Vault and shared across all your devices (never saved in browser localStorage).
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-ink">Gemini API Key (VPS Vault)</label>
                  {vaultConfig.geminiConfigured ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-good/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-good">
                      <CheckIcon size={11} />
                      <span>Vault: {vaultConfig.geminiMasked}</span>
                    </span>
                  ) : (
                    <span className="rounded-md bg-line px-2 py-0.5 font-mono text-[10px] text-muted">
                      Not configured
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  name="geminiKey"
                  defaultValue=""
                  placeholder={
                    vaultConfig.geminiConfigured
                      ? 'Stored in VPS Vault — enter a new key only to replace it'
                      : 'AIzaSy...'
                  }
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-ink placeholder:text-muted focus:border-series focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Stored securely in the VPS Vault as <code>GEMINI_API_KEY</code>.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line mt-1">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-xl border border-line bg-page px-4 py-2 font-medium text-muted hover:text-ink transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="rounded-xl bg-series px-5 py-2 font-semibold text-white hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {savingSettings ? 'Saving to Vault...' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Slide-Over History Sidebar */}
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileHistoryOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] h-full border-r border-line bg-page shadow-2xl">
            {HistorySidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Left Collapsible History Sidebar */}
      <aside
        aria-label="Conversation History"
        className={`hidden md:flex md:flex-col md:shrink-0 border-r border-line transition-all duration-200 overflow-hidden ${
          sidebarOpen ? 'md:w-64' : 'md:w-0 md:border-r-0'
        }`}
      >
        {sidebarOpen && HistorySidebarContent}
      </aside>

      {/* Main Chat Column */}
      <div className="flex min-w-0 flex-1 flex-col h-full bg-page">
        {/* Sticky Top Header Bar (ChatGPT Style) */}
        <header className="sticky top-0 z-20 flex h-13 shrink-0 items-center justify-between border-b border-line bg-page/90 px-3 sm:px-5 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile history drawer button */}
            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              title="Open chat history"
              className="flex md:hidden size-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink transition"
            >
              <SidebarToggleIcon size={15} />
            </button>

            {/* Desktop expand sidebar button (when collapsed) */}
            {!sidebarOpen && (
              <div className="hidden md:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  title="Show chat history sidebar"
                  className="flex size-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink transition cursor-pointer"
                >
                  <SidebarToggleIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleNewChat}
                  title="New chat"
                  className="flex size-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:text-ink transition cursor-pointer"
                >
                  <PlusIcon size={15} />
                </button>
              </div>
            )}

            {/* Top Model Selector Pill */}
            <div className="relative flex items-center">
              <select
                aria-label="Select AI Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isRunning}
                className="appearance-none rounded-xl border border-line bg-surface pl-3 pr-7 py-1.5 text-xs font-semibold text-ink hover:border-series/50 focus:border-series focus:outline-none transition cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
              >
                {currentModelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
              <ChevronDownIcon size={13} className="pointer-events-none absolute right-2.5 text-muted" />
            </div>

            {/* Top Workspace / Repository Context Selector Pill */}
            <div className="relative flex items-center">
              <select
                aria-label="Select Target Context or Repository"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                disabled={isRunning}
                className="appearance-none rounded-xl border border-line bg-surface pl-3 pr-7 py-1.5 text-xs font-medium text-ink-2 hover:text-ink hover:border-series/50 focus:border-series focus:outline-none transition cursor-pointer max-w-[155px] sm:max-w-[210px] truncate"
              >
                <option value={GENERAL_CONTEXT}>General (VPS & Docker)</option>
                <optgroup label={`Local VPS Repositories (${localRepos.length})`}>
                  {localRepos.map((r) => (
                    <option key={r.name} value={r.name}>
                      VPS: {r.name}
                    </option>
                  ))}
                </optgroup>
                {cloudRepos.length > 0 && (
                  <optgroup label={`GitHub Cloud (${cloudRepos.length})`}>
                    {cloudRepos.map((r) => (
                      <option key={r.name} value={r.name}>
                        GitHub: {r.name} {r.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDownIcon size={13} className="pointer-events-none absolute right-2.5 text-muted" />
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                title="Start a new chat"
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:text-ink hover:border-series/40 transition cursor-pointer"
              >
                <PlusIcon size={13} />
                <span>New</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Provider & API Settings"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:text-ink hover:border-series/40 transition cursor-pointer"
            >
              <GearIcon size={14} />
              <span className="hidden sm:inline">{provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* ChatGPT-Style Empty State Hero */
            <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-series shadow-sm">
                <AgentIcon />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
                What can I help you inspect or build?
              </h1>
              <p className="mt-2 max-w-lg text-xs sm:text-sm text-muted leading-relaxed">
                Autonomous infrastructure & codebase agent connected to your Contabo VPS, Docker engine, and GitHub repositories.
              </p>

              {/* 2x2 Starter Prompt Cards */}
              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.title}
                    type="button"
                    onClick={() => void sendPrompt(q.prompt, q.repo)}
                    className="group flex flex-col justify-between rounded-2xl border border-line bg-surface/70 p-4 hover:border-series/50 hover:bg-surface shadow-2xs transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink group-hover:text-series transition">
                          {q.icon === 'vps' && <VpsIcon size={14} className="text-series" />}
                          {q.icon === 'folder' && <FolderIcon size={14} className="text-series" />}
                          {q.icon === 'terminal' && <TerminalIcon />}
                          {q.icon === 'agent' && <AgentIcon />}
                          <span>{q.title}</span>
                        </span>
                        <span className="rounded-md border border-line bg-page px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {q.category}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted leading-relaxed">
                        {q.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Conversation Thread */
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
              {messages.map((m) => {
                const toolCalls = m.events.filter((e) => e.type === 'tool_call');
                const toolResults = m.events.filter((e) => e.type === 'tool_result');
                const thoughts = m.events.filter((e) => e.type === 'thought');
                const hasActivity = thoughts.length > 0 || toolCalls.length > 0;
                const isActivityOpen =
                  expandedActivity[m.id] !== undefined
                    ? expandedActivity[m.id]
                    : m.status === 'streaming';

                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="group flex flex-col items-end gap-1.5">
                      <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-2xs whitespace-pre-wrap leading-relaxed">
                        {m.text}
                      </div>
                      <div className="flex items-center gap-2 px-1 text-[10.5px] text-muted opacity-0 group-hover:opacity-100 transition">
                        <span className="font-mono">{m.contextLabel}</span>
                        <button
                          type="button"
                          onClick={() => copyMessageText(m.id, m.text)}
                          className="flex items-center gap-1 hover:text-ink"
                        >
                          {copiedMsgId === m.id ? (
                            <>
                              <CheckIcon size={11} className="text-good" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <ClipboardIcon size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="group flex items-start gap-3.5">
                    {/* Agent Avatar */}
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-series shadow-2xs">
                      <AgentIcon />
                    </div>

                    {/* Assistant Content Column */}
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-ink">Control Center Agent</span>
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {m.contextLabel}
                        </span>
                      </div>

                      {/* Collapsible Reasoning & Tool Calls Block */}
                      {hasActivity && (
                        <div className="overflow-hidden rounded-xl border border-line bg-surface/60">
                          <button
                            type="button"
                            onClick={() => toggleActivityExpand(m.id)}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink transition cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {m.status === 'streaming' ? (
                                <span className="size-2 rounded-full bg-series animate-ping" />
                              ) : (
                                <CheckIcon size={13} className="text-good" />
                              )}
                              <span>
                                {m.status === 'streaming'
                                  ? `Executing agent steps (${toolCalls.length} tool call${toolCalls.length === 1 ? '' : 's'})...`
                                  : `Completed ${toolCalls.length} tool execution${toolCalls.length === 1 ? '' : 's'}${thoughts.length > 0 ? ` and ${thoughts.length} reasoning step${thoughts.length === 1 ? '' : 's'}` : ''}`}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted">
                              {isActivityOpen ? 'Hide steps' : 'Show steps'}
                            </span>
                          </button>

                          {isActivityOpen && (
                            <div className="border-t border-line bg-page/50 p-3 space-y-2.5">
                              {/* Thoughts */}
                              {thoughts.length > 0 && (
                                <div className="space-y-1.5 border-l-2 border-series/40 pl-3 text-xs text-muted">
                                  {thoughts.map((t, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                                      {t.content}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Tool Calls */}
                              {toolCalls.length > 0 && (
                                <div className="space-y-1.5">
                                  {toolCalls.map((tc, idx) => {
                                    const key = `${m.id}-tool-${idx}`;
                                    const isExpanded = !!expandedTools[key];
                                    const matchingResult = toolResults[idx];
                                    const argSummary =
                                      tc.toolName === 'run_command'
                                        ? String(tc.toolArgs?.command ?? '')
                                        : String(tc.toolArgs?.path ?? JSON.stringify(tc.toolArgs ?? {}));

                                    return (
                                      <div
                                        key={key}
                                        className="overflow-hidden rounded-lg border border-line bg-surface font-mono text-[11px]"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => toggleToolExpand(key)}
                                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-page/60 transition cursor-pointer"
                                        >
                                          <div className="flex items-center gap-2 truncate pr-3">
                                            <span className="rounded bg-series/15 px-1.5 py-0.5 text-[10px] font-semibold text-series">
                                              {tc.toolName}
                                            </span>
                                            <span className="truncate text-ink-2">{argSummary}</span>
                                          </div>
                                          <span className="shrink-0 text-[10px] text-muted">
                                            {matchingResult
                                              ? isExpanded
                                                ? 'Hide output'
                                                : 'View output'
                                              : 'Running...'}
                                          </span>
                                        </button>

                                        {isExpanded && matchingResult && (
                                          <pre className="max-h-64 overflow-x-auto border-t border-line bg-[#0d0d0d] p-3 text-[11px] text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                            {matchingResult.toolOutput}
                                          </pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Final Markdown Response or Error */}
                      {m.text && (
                        <div
                          className={
                            m.status === 'error'
                              ? 'rounded-xl border border-critical/40 bg-critical/10 p-3.5 text-xs font-medium text-critical whitespace-pre-wrap'
                              : ''
                          }
                        >
                          {m.status === 'error' ? m.text : <MarkdownMessage content={m.text} />}
                        </div>
                      )}

                      {/* Streaming Pulse Indicator when no text yet */}
                      {m.status === 'streaming' && !m.text && (
                        <div className="flex items-center gap-2 py-1 text-xs text-muted">
                          <span className="inline-block size-2 animate-ping rounded-full bg-series" />
                          <span>Generating response...</span>
                        </div>
                      )}

                      {/* Message Footer Actions */}
                      {m.status !== 'streaming' && m.text && (
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted">
                          <button
                            type="button"
                            onClick={() => copyMessageText(m.id, m.text)}
                            className="flex items-center gap-1 hover:text-ink transition cursor-pointer"
                          >
                            {copiedMsgId === m.id ? (
                              <>
                                <CheckIcon size={13} className="text-good" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <ClipboardIcon size={13} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Bottom Floating ChatGPT-Style Composer */}
        <div className="shrink-0 bg-gradient-to-t from-page via-page to-transparent px-3 sm:px-5 pb-3 pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendPrompt(input);
            }}
            className="mx-auto max-w-3xl"
          >
            <div
              className={`rounded-2xl border bg-surface p-2.5 shadow-md transition-all ${
                isListening
                  ? 'border-critical ring-2 ring-critical/20'
                  : 'border-line focus-within:border-series/70 focus-within:ring-2 focus-within:ring-series/15'
              }`}
            >
              {isListening && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-critical/10 px-3 py-1.5 text-xs font-medium text-critical">
                  <div className="flex items-center gap-2">
                    <span className="size-2 animate-ping rounded-full bg-critical" />
                    <span>Listening to voice dictation... Speak clearly, then pause to insert text.</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="underline font-semibold"
                  >
                    Stop
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendPrompt(input);
                  }
                }}
                placeholder={
                  repo === GENERAL_CONTEXT
                    ? 'Message Control Center Agent (inspect VPS, Docker, databases, or logs)...'
                    : `Ask anything or run tasks on repository "${repo}"...`
                }
                disabled={isRunning}
                className="max-h-44 min-h-[38px] w-full resize-none bg-transparent px-2 py-1 text-sm text-ink placeholder:text-muted focus:outline-none"
              />

              {/* Composer Bottom Toolbar */}
              <div className="mt-1.5 flex items-center justify-between gap-2 pt-1.5 border-t border-line/60">
                <div className="flex items-center gap-1.5 text-[11px] text-muted overflow-x-auto">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-page px-2 py-1 font-mono text-[10.5px] text-ink-2">
                    <GlobeIcon size={12} />
                    <span>{repo === GENERAL_CONTEXT ? 'VPS / Docker' : repo}</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-line bg-page px-2 py-1 font-mono text-[10.5px] text-muted">
                    {currentModelList.find((m) => m.id === model)?.name ?? model}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Voice Dictation Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isRunning}
                    title={isListening ? 'Stop voice dictation' : 'Voice dictation'}
                    className={`flex size-8 items-center justify-center rounded-full border transition cursor-pointer ${
                      isListening
                        ? 'border-critical bg-critical text-white animate-pulse'
                        : 'border-line bg-page text-ink-2 hover:border-series/50 hover:text-ink disabled:opacity-40'
                    }`}
                  >
                    <MicIcon size={15} />
                  </button>

                  {/* Send or Stop Button */}
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      title="Stop generating"
                      className="flex size-8 items-center justify-center rounded-full bg-critical text-white hover:opacity-90 transition cursor-pointer"
                    >
                      <StopSquareIcon size={13} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      title="Send message (Enter)"
                      className="flex size-8 items-center justify-center rounded-full bg-series text-white hover:opacity-90 disabled:bg-line disabled:text-muted transition cursor-pointer"
                    >
                      <SendArrowIcon size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between px-2 text-[10.5px] text-muted">
              <span>Agent can run commands on Contabo VPS and inspect repositories.</span>
              <span className="hidden sm:inline">Enter to send · Shift + Enter for new line</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
