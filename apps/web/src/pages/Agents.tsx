import { useState, useRef, useEffect } from 'react';

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
const SETTINGS_KEY = 'cc_agent_settings_v1';

interface ProviderSettings {
  provider: 'gemini' | 'openrouter';
  geminiApiKey: string;
  openrouterApiKey: string;
}

const FALLBACK_REPOS: RepoOption[] = [
  { name: 'control-center', fullName: 'guzmannicolas/control-center', description: 'Control Center', isPrivate: false, local: true },
  { name: 'minijuegos', fullName: 'guzmannicolas/minijuegos', description: 'Minijuegos', isPrivate: true, local: true },
  { name: 'nikipepperstattoo', fullName: 'guzmannicolas/nikipepperstattoo', description: 'Niki Peppers Tattoo', isPrivate: false, local: true },
  { name: 'resume.nicoguzmandev', fullName: 'guzmannicolas/resume.nicoguzmandev', description: 'CV Virtual', isPrivate: true, local: true },
  { name: 'susterart', fullName: 'guzmannicolas/susterart', description: 'Suster Art', isPrivate: true, local: true },
];

const GEMINI_MODELS = [
  { id: 'auto', name: '⚡ Auto (Smart Pool Anti-429 — Recommended)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Balanced)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Fast)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning)' },
];

const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (Meta)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Anthropic)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via OpenRouter)' },
];

const QUICK_PROMPTS = [
  {
    label: '🩺 Check VPS health & disk space',
    repo: GENERAL_CONTEXT,
    prompt: 'Check overall VPS status: RAM and swap usage (free -h), what consumes most disk space (df -h /host, docker system df and du in /home/adminnico), and which containers are running.',
  },
  {
    label: '📂 Git status of all repositories',
    repo: GENERAL_CONTEXT,
    prompt: 'Inspect all git repositories under /home/adminnico/repositories and tell me the current branch for each one and if any has uncommitted changes.',
  },
  {
    label: '🔍 Analyze Control Center architecture',
    repo: 'control-center',
    prompt: 'Inspect repository structure, read package.json, and provide a technical architecture summary and available scripts.',
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

function loadSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider === 'openrouter' ? 'openrouter' : 'gemini',
        geminiApiKey: parsed.geminiApiKey || '',
        openrouterApiKey: parsed.openrouterApiKey || '',
      };
    }
  } catch {
    // ignore
  }
  return {
    provider: 'gemini',
    geminiApiKey: '',
    openrouterApiKey: '',
  };
}

function saveSettings(settings: ProviderSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function AgentsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadLocalSessions());
  const [repos, setRepos] = useState<RepoOption[]>(FALLBACK_REPOS);
  const [settings, setSettings] = useState<ProviderSettings>(() => loadSettings());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const [sessionId, setSessionId] = useState<string>(() => {
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    const local = loadLocalSessions();
    if (savedActive && local.some((s) => s.id === savedActive)) return savedActive;
    return local[0]?.id ?? `session-${Date.now()}`;
  });

  const activeSession = sessions.find((s) => s.id === sessionId);

  const [provider, setProvider] = useState<'gemini' | 'openrouter'>(
    activeSession?.provider ?? settings.provider
  );
  const [repo, setRepo] = useState<string>(activeSession?.repo ?? GENERAL_CONTEXT);
  const [model, setModel] = useState<string>(
    activeSession?.model ?? (provider === 'openrouter' ? 'meta-llama/llama-3.3-70b-instruct' : 'auto')
  );
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(activeSession?.messages ?? []);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  // Speech Recognition / Voice Dictation state
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

  // Fetch available repos and saved server chat sessions
  useEffect(() => {
    let active = true;
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
          const merged = Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
      ? firstUserMsg.text.length > 36
        ? firstUserMsg.text.slice(0, 36) + '...'
        : firstUserMsg.text
      : 'Nueva conversación';

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
      const next = idx >= 0 ? [...prev.slice(0, idx), updatedSession, ...prev.slice(idx + 1)] : [updatedSession, ...prev];
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
    const newSettings = { ...settings, provider: newProvider };
    setSettings(newSettings);
    saveSettings(newSettings);
  }

  function handleSaveSettings(newGeminiKey: string, newOpenRouterKey: string) {
    const updated: ProviderSettings = {
      provider,
      geminiApiKey: newGeminiKey.trim(),
      openrouterApiKey: newOpenRouterKey.trim(),
    };
    setSettings(updated);
    saveSettings(updated);
    setShowSettingsModal(false);
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
    }
  }

  function handleNewChat() {
    if (isRunning) handleStop();
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setInput('');
  }

  function handleDeleteCurrentSession() {
    if (isRunning) handleStop();
    const idToDelete = sessionId;
    const remaining = sessions.filter((s) => s.id !== idToDelete);
    setSessions(remaining);
    saveLocalSessions(remaining);

    fetch(`${BASE}/api/agent/sessions/${idToDelete}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});

    if (remaining.length > 0) {
      handleSelectSession(remaining[0]!.id);
    } else {
      handleNewChat();
    }
  }

  function toggleToolExpand(key: string) {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // --- Voice Dictation (Transcribes spoken words straight into the input textarea) ---
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
      alert('Tu navegador no soporta reconocimiento de voz nativo (Web Speech API). Podés usar Google Chrome o Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            transcript += res[0].transcript;
          }
        }

        if (transcript) {
          setInput((prev) => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            return `${prev}${separator}${transcript}`.trim();
          });
        }
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
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
        ? '🌐 General / VPS'
        : `${repos.find((r) => r.name === targetRepo)?.local === false ? '☁️' : '🖥️'} ${targetRepo}`;

    const history = messages
      .filter((m) => m.text.trim().length > 0)
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text,
      }));

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: trimmed,
      contextLabel,
      events: [],
      status: 'done',
    };

    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      text: '',
      contextLabel,
      events: [],
      status: 'streaming',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userApiKey = provider === 'openrouter' ? settings.openrouterApiKey : settings.geminiApiKey;

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
          apiKey: userApiKey || undefined,
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
        prev.map((m) => (m.id === assistantMsgId && m.status === 'streaming' ? { ...m, status: 'done' } : m))
      );
    }
  }

  const localRepos = repos.filter((r) => r.local);
  const cloudRepos = repos.filter((r) => !r.local);
  const currentModelList = provider === 'openrouter' ? OPENROUTER_MODELS : GEMINI_MODELS;

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                ⚙️ Configuración de Proveedor y API Keys
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-muted hover:text-ink text-sm p-1"
              >
                ✕
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
                <label className="block font-medium text-ink mb-1">
                  🌐 Proveedor Activo:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange('gemini')}
                    className={`rounded-lg border px-3 py-2 text-center font-medium transition ${
                      provider === 'gemini'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-line bg-bg text-muted hover:text-ink'
                    }`}
                  >
                    Google Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange('openrouter')}
                    className={`rounded-lg border px-3 py-2 text-center font-medium transition ${
                      provider === 'openrouter'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-line bg-bg text-muted hover:text-ink'
                    }`}
                  >
                    OpenRouter (Multi-LLM)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">
                  OpenRouter API Key:
                </label>
                <input
                  type="password"
                  name="openrouterKey"
                  defaultValue={settings.openrouterApiKey}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Enables Llama 3, Claude 3.5, GPT-4o, DeepSeek R1, etc. via OpenRouter.
                </span>
              </div>

              <div>
                <label className="block font-medium text-ink mb-1">
                  Gemini API Key (Optional):
                </label>
                <input
                  type="password"
                  name="geminiKey"
                  defaultValue={settings.geminiApiKey}
                  placeholder="Leave empty to use server environment key"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  If left blank, the API will use the <code>GEMINI_API_KEY</code> variable configured on the VPS.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line mt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-lg border border-line bg-bg px-3 py-1.5 text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-white hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h1 className="text-sm font-bold text-ink">Dev Agent</h1>
            <p className="text-[11px] text-muted">
              {provider === 'openrouter' ? '🔌 OpenRouter API' : '⚡ Google Gemini'}: Live access to VPS, Docker, and GitHub
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Chat Sessions Dropdown */}
          <div className="flex items-center gap-1">
            <label htmlFor="agent-session-select" className="text-[11px] font-medium text-muted uppercase">
              History:
            </label>
            <select
              id="agent-session-select"
              value={sessionId}
              onChange={(e) => handleSelectSession(e.target.value)}
              className="max-w-[170px] truncate rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              {sessions.length === 0 ? (
                <option value={sessionId}>Current chat</option>
              ) : (
                sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Repo selector */}
          <div className="flex items-center gap-1">
            <label htmlFor="agent-repo-select" className="text-[11px] font-medium text-muted uppercase">
              Context:
            </label>
            <select
              id="agent-repo-select"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={isRunning}
              className="max-w-[180px] rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value={GENERAL_CONTEXT}>🌐 General (Full VPS / Docker / Host)</option>
              <optgroup label={`🖥️ On VPS (${localRepos.length} repos)`}>
                {localRepos.map((r) => (
                  <option key={r.name} value={r.name}>
                    🖥️ {r.name}
                  </option>
                ))}
              </optgroup>
              {cloudRepos.length > 0 && (
                <optgroup label={`☁️ On GitHub (${cloudRepos.length} in cloud — auto-clone)`}>
                  {cloudRepos.map((r) => (
                    <option key={r.name} value={r.name}>
                      ☁️ {r.name} {r.isPrivate ? '🔒' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Model Dropdown */}
          <div className="flex items-center gap-1">
            <label htmlFor="agent-model-select" className="text-[11px] font-medium text-muted uppercase">
              Model:
            </label>
            <select
              id="agent-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="max-w-[190px] truncate rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              {currentModelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Provider / API Key Settings button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            title="API Key and Provider Settings"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent transition"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">
              {provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent transition"
          >
            + New chat
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteCurrentSession}
              title="Delete this chat session"
              className="rounded-lg border border-line bg-bg px-2 py-1.5 text-xs text-muted hover:text-red-400 hover:border-red-400/40 transition"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {messages.length === 0 ? (
            <div className="my-12 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-xl shadow-xs">
                🤖
              </div>
              <h2 className="text-base font-semibold text-ink">What are we building today?</h2>
              <p className="mt-1 max-w-lg text-xs text-muted">
                Your chats are saved automatically. Type or dictate your request by voice to check VPS health,
                manage Docker containers, or run tasks against any local or remote repository.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => void sendPrompt(q.prompt, q.repo)}
                    className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink shadow-xs hover:border-accent hover:text-accent transition"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const toolCalls = m.events.filter((e) => e.type === 'tool_call');
              const toolResults = m.events.filter((e) => e.type === 'tool_result');
              const thoughts = m.events.filter((e) => e.type === 'thought');

              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span className="font-semibold text-ink">
                      {m.role === 'user' ? 'You' : 'Agent'}
                    </span>
                    <span>•</span>
                    <span>{m.contextLabel}</span>
                  </div>

                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-xs">
                      {m.text}
                    </div>
                  ) : (
                    <div className="flex max-w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-xs text-ink shadow-xs">
                      {/* Thought process preview */}
                      {thoughts.length > 0 && (
                        <div className="flex flex-col gap-1 border-l-2 border-accent/40 pl-3 text-muted">
                          {thoughts.map((t, idx) => (
                            <div key={idx} className="italic whitespace-pre-wrap">
                              {t.content}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tool Call timeline */}
                      {toolCalls.length > 0 && (
                        <div className="flex flex-col gap-1.5">
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
                                className="overflow-hidden rounded-xl border border-line bg-bg font-mono text-[11px]"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleToolExpand(key)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-amber-400 font-semibold">⚡ {tc.toolName}</span>
                                    <span className="truncate text-gray-400">{argSummary}</span>
                                  </div>
                                  <span className="ml-2 shrink-0 text-[10px] text-gray-400">
                                    {matchingResult ? (isExpanded ? '▼ Hide output' : '▶ View output') : '⏳...'}
                                  </span>
                                </button>

                                {isExpanded && matchingResult && (
                                  <pre className="max-h-60 overflow-x-auto border-t border-line bg-black/40 p-3 text-[10px] text-gray-300 whitespace-pre-wrap">
                                    {matchingResult.toolOutput}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Final response or error message */}
                      {m.text && (
                        <div
                          className={`whitespace-pre-wrap text-sm leading-relaxed ${
                            m.status === 'error' ? 'text-red-400 font-medium' : 'text-ink'
                          }`}
                        >
                          {m.text}
                        </div>
                      )}

                      {m.status === 'streaming' && (
                        <div className="flex items-center gap-2 text-xs text-accent">
                          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-accent" />
                          <span>The agent is working...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Form with Voice Dictation */}
      <div className="border-t border-line bg-surface/80 p-4 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="mx-auto flex max-w-4xl items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendPrompt(input);
                }
              }}
              placeholder={
                isListening
                  ? 'Listening to your voice... (speak and it will be transcribed here)'
                  : repo === GENERAL_CONTEXT
                  ? 'Type an instruction or dictate by voice for the VPS (Enter to send)...'
                  : `Type a task or question for ${repo} (Enter to send)...`
              }
              disabled={isRunning}
              className={`w-full resize-none rounded-xl border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none transition ${
                isListening
                  ? 'border-red-500 shadow-sm ring-1 ring-red-500/50'
                  : 'border-line focus:border-accent'
              }`}
            />
            {isListening && (
              <div className="absolute right-3 top-2 flex items-center gap-1.5 text-[10px] font-semibold text-red-400">
                <span className="h-2 w-2 animate-ping rounded-full bg-red-500" />
                <span>Dictating...</span>
              </div>
            )}
          </div>

          {/* Microphone Dictate Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isRunning}
            title={isListening ? 'Stop voice dictation' : 'Dictate with voice (speech to text)'}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base transition shrink-0 ${
              isListening
                ? 'border-red-500 bg-red-500/10 text-red-400 animate-pulse'
                : 'border-line bg-bg text-ink hover:border-accent hover:text-accent disabled:opacity-40'
            }`}
          >
            🎙️
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500 transition shrink-0 h-10"
            >
              ⏹ Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition shrink-0 h-10"
            >
              Send ↵
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
