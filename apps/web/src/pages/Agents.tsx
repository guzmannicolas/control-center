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
  model: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const GENERAL_CONTEXT = '__general__';
const STORAGE_KEY = 'cc_agent_sessions_v1';
const ACTIVE_SESSION_KEY = 'cc_agent_active_session_v1';

const FALLBACK_REPOS: RepoOption[] = [
  { name: 'control-center', fullName: 'guzmannicolas/control-center', description: 'Control Center', isPrivate: false, local: true },
  { name: 'minijuegos', fullName: 'guzmannicolas/minijuegos', description: 'Minijuegos', isPrivate: true, local: true },
  { name: 'nikipepperstattoo', fullName: 'guzmannicolas/nikipepperstattoo', description: 'Niki Peppers Tattoo', isPrivate: false, local: true },
  { name: 'resume.nicoguzmandev', fullName: 'guzmannicolas/resume.nicoguzmandev', description: 'CV Virtual', isPrivate: true, local: true },
  { name: 'susterart', fullName: 'guzmannicolas/susterart', description: 'Suster Art', isPrivate: true, local: true },
];

const AVAILABLE_MODELS = [
  { id: 'auto', name: '⚡ Auto (Smart Pool Anti-429 — Recomendado)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Equilibrado)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (Ultra Rápido)' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest' },
];

const QUICK_PROMPTS = [
  {
    label: '🩺 Chequear salud y espacio del VPS',
    repo: GENERAL_CONTEXT,
    prompt: 'Chequeá el estado general del VPS: uso de RAM y swap (free -h), qué consume más espacio en disco (df -h /host, docker system df y du en /home/adminnico) y qué contenedores están corriendo.',
  },
  {
    label: '📂 Estado Git de todos los repos',
    repo: GENERAL_CONTEXT,
    prompt: 'Revisá todos los repositorios dentro de /home/adminnico/repositories y decime en qué rama está cada uno y si alguno tiene cambios sin commitear.',
  },
  {
    label: '🔍 Analizar arquitectura de Control Center',
    repo: 'control-center',
    prompt: 'Inspeccioná la estructura del repositorio, leé el package.json y haceme un resumen técnico de su arquitectura y scripts disponibles.',
  },
];

function loadLocalSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
  } catch {
    // Ignore storage quota errors
  }
}

export function AgentsPage() {
  const [repos, setRepos] = useState<RepoOption[]>(FALLBACK_REPOS);
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadLocalSessions());
  const [sessionId, setSessionId] = useState<string>(() => {
    const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
    const local = loadLocalSessions();
    if (savedActive && local.some((s) => s.id === savedActive)) return savedActive;
    return local[0]?.id ?? `session-${Date.now()}`;
  });

  const activeSession = sessions.find((s) => s.id === sessionId);

  const [repo, setRepo] = useState<string>(activeSession?.repo ?? GENERAL_CONTEXT);
  const [model, setModel] = useState<string>(activeSession?.model ?? 'auto');
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(activeSession?.messages ?? []);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

  // Fetch available repos (local + GitHub cloud) and saved server chat sessions
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

    const firstUserMsg = messages.find((m) => m.role === 'user')?.text ?? 'Conversación';
    const title = firstUserMsg.length > 55 ? `${firstUserMsg.slice(0, 55)}…` : firstUserMsg;
    const updatedSession: ChatSession = {
      id: sessionId,
      title,
      repo,
      model,
      updatedAt: new Date().toISOString(),
      messages,
    };

    setSessions((prev) => {
      const next = [updatedSession, ...prev.filter((s) => s.id !== sessionId)].slice(0, 30);
      saveLocalSessions(next);
      return next;
    });

    // Sync to server when not actively mid-stream (or when finished)
    const anyStreaming = messages.some((m) => m.status === 'streaming');
    if (!anyStreaming) {
      fetch(`${BASE}/api/agent/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatedSession),
      }).catch(() => {});
    }
  }, [messages, sessionId, repo, model, BASE]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const localRepos = repos.filter((r) => r.local);
  const cloudRepos = repos.filter((r) => !r.local);

  function toggleToolExpand(key: string) {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
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
      setMessages(found.messages);
      setRepo(found.repo || GENERAL_CONTEXT);
      setModel(found.model || 'auto');
      setExpandedTools({});
    }
  }

  function handleNewChat() {
    if (isRunning) handleStop();
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setExpandedTools({});
  }

  function handleDeleteCurrentSession() {
    if (isRunning) handleStop();
    const idToDelete = sessionId;
    const remaining = sessions.filter((s) => s.id !== idToDelete);
    setSessions(remaining);
    saveLocalSessions(remaining);
    fetch(`${BASE}/api/agent/sessions/${encodeURIComponent(idToDelete)}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => {});

    if (remaining[0]) {
      setSessionId(remaining[0].id);
      setMessages(remaining[0].messages);
      setRepo(remaining[0].repo || GENERAL_CONTEXT);
    } else {
      handleNewChat();
    }
  }

  async function sendPrompt(promptText: string, overrideRepo?: string) {
    const trimmed = promptText.trim();
    if (!trimmed || isRunning) return;

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

    try {
      const res = await fetch(`${BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          repo: targetRepo,
          instruction: trimmed,
          model,
          history,
        }),
      });

      if (!res.ok) {
        const errorText =
          res.status === 401
            ? 'Sesión expirada o no iniciada. Recargá la página para volver a autenticarte.'
            : `HTTP ${res.status}: ${await res.text()}`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, status: 'error', events: [...m.events, { type: 'error', content: errorText }] }
              : m
          )
        );
        setIsRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as AgentEvent;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const nextEvents = [...m.events, event];
                  const nextText = event.type === 'final' ? event.content : m.text;
                  const nextStatus =
                    event.type === 'error' ? 'error' : event.type === 'final' ? 'done' : m.status;
                  return { ...m, events: nextEvents, text: nextText, status: nextStatus };
                })
              );
            } catch {
              // Ignore malformed SSE chunk
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId && m.status === 'streaming' ? { ...m, status: 'done' } : m))
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, status: 'done', text: m.text || '⏹️ Ejecución detenida por el usuario.' }
              : m
          )
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: 'error',
                  events: [...m.events, { type: 'error', content: `Error de conexión: ${msg}` }],
                }
              : m
          )
        );
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-bg">
      {/* Top Bar: History, Context & Model Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-surface px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent font-bold text-xs">
            AI
          </div>
          <div>
            <h1 className="text-sm font-semibold text-ink leading-tight">Agent Harness</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Conversations Dropdown */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-1">
              <label htmlFor="agent-session-select" className="text-[11px] font-medium text-muted uppercase">
                Chat:
              </label>
              <select
                id="agent-session-select"
                value={sessions.some((s) => s.id === sessionId) ? sessionId : ''}
                onChange={(e) => {
                  if (e.target.value) handleSelectSession(e.target.value);
                }}
                disabled={isRunning}
                className="max-w-[200px] truncate rounded-lg border border-line bg-bg px-2 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
              >
                {!sessions.some((s) => s.id === sessionId) && <option value="">✨ Nueva conversación</option>}
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    💬 {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Context / Repository Dropdown */}
          <div className="flex items-center gap-1">
            <label htmlFor="agent-repo-select" className="text-[11px] font-medium text-muted uppercase">
              Contexto:
            </label>
            <select
              id="agent-repo-select"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={isRunning}
              className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value={GENERAL_CONTEXT}>🌐 General / Todo el VPS (Sin repo)</option>
              <optgroup label={`🖥️ En el VPS (${localRepos.length} locales)`}>
                {localRepos.map((r) => (
                  <option key={r.name} value={r.name}>
                    🖥️ {r.name}
                  </option>
                ))}
              </optgroup>
              {cloudRepos.length > 0 && (
                <optgroup label={`☁️ En GitHub (${cloudRepos.length} en la nube — auto-clone)`}>
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
              Modelo:
            </label>
            <select
              id="agent-model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent transition"
          >
            + Nuevo chat
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteCurrentSession}
              title="Borrar esta conversación"
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
              <h2 className="text-base font-semibold text-ink">¿En qué trabajamos hoy?</h2>
              <p className="mt-1 max-w-lg text-xs text-muted">
                Tus conversaciones quedan guardadas automáticamente. Podés consultar el estado y espacio del VPS en
                modo General, o elegir cualquier repositorio local o de GitHub.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => void sendPrompt(q.prompt, q.repo)}
                    className="rounded-xl border border-line bg-surface px-3.5 py-2 text-left text-xs text-ink hover:border-accent hover:bg-accent/5 transition shadow-2xs"
                  >
                    <span className="font-medium">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-2xl rounded-2xl rounded-br-xs bg-accent px-4 py-3 text-sm text-white shadow-xs">
                      <div className="mb-1 text-[10px] font-medium opacity-80">{msg.contextLabel}</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                    </div>
                  </div>
                );
              }

              const thoughts = msg.events.filter((e) => e.type === 'thought');
              const toolCalls = msg.events.filter((e) => e.type === 'tool_call');
              const toolResults = msg.events.filter((e) => e.type === 'tool_result');
              const errors = msg.events.filter((e) => e.type === 'error');

              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="w-full max-w-4xl rounded-2xl border border-line bg-surface p-4 shadow-xs">
                    <div className="mb-2 flex items-center justify-between border-b border-line/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">Agente</span>
                        <span className="rounded-md bg-bg px-2 py-0.5 text-[10px] font-medium text-muted">
                          {msg.contextLabel}
                        </span>
                      </div>
                      {msg.status === 'streaming' && (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-accent" />
                          Ejecutando...
                        </span>
                      )}
                    </div>

                    {(toolCalls.length > 0 || thoughts.length > 0) && (
                      <div className="mb-3 space-y-2">
                        {thoughts.map((t, idx) => (
                          <div key={`thought-${idx}`} className="text-xs text-muted italic whitespace-pre-wrap">
                            💭 {t.content}
                          </div>
                        ))}

                        {toolCalls.map((tc, idx) => {
                          const key = `${msg.id}-tool-${idx}`;
                          const isExpanded = !!expandedTools[key];
                          const matchingResult = toolResults[idx];
                          const argSummary =
                            tc.toolName === 'run_command'
                              ? String(tc.toolArgs?.command ?? '')
                              : String(tc.toolArgs?.path ?? JSON.stringify(tc.toolArgs ?? {}));

                          return (
                            <div
                              key={key}
                              className="overflow-hidden rounded-lg border border-line bg-[#0d1117] text-gray-200 font-mono text-xs"
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
                                  {matchingResult ? (isExpanded ? '▼ Ocultar salida' : '▶ Ver salida') : '⏳...'}
                                </span>
                              </button>

                              {isExpanded && matchingResult?.toolOutput && (
                                <pre className="max-h-96 overflow-auto border-t border-gray-800 bg-black/50 p-3 text-[11px] text-emerald-300/90 whitespace-pre-wrap">
                                  {matchingResult.toolOutput}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {msg.text && (
                      <div className="prose prose-sm max-w-none text-sm text-ink whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </div>
                    )}

                    {errors.map((err, idx) => (
                      <div
                        key={`err-${idx}`}
                        className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 whitespace-pre-wrap"
                      >
                        ✖ {err.content}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Chat Composer Bar */}
      <div className="border-t border-line bg-surface p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="mx-auto flex max-w-4xl items-end gap-2"
        >
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
              repo === GENERAL_CONTEXT
                ? 'Escribí un mensaje para el VPS en general (Enter para enviar, Shift+Enter para salto de línea)...'
                : `Escribí una tarea o consulta para ${repo} (Enter para enviar)...`
            }
            disabled={isRunning}
            className="flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />

          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500 transition shrink-0"
            >
              ⏹ Detener
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 transition shrink-0"
            >
              Enviar ↵
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
