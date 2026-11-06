import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader.tsx';
import { StatusIcon } from '../components/Status.tsx';

interface AgentEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolOutput?: string;
}

const AVAILABLE_REPOS = [
  'control-center',
  'minijuegos',
  'nikipepperstattoo',
  'resume.nicoguzmandev',
  'susterart',
];

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Recommended for coding)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)' },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Configured via Anthropic API)' },
];

export function AgentsPage() {
  const [repo, setRepo] = useState('control-center');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [instruction, setInstruction] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  async function handleStart() {
    if (!instruction.trim() || isRunning) return;

    setIsRunning(true);
    setEvents([]);

    try {
      const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';
      const res = await fetch(`${BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repo, instruction, model }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        setEvents((prev) => [...prev, { type: 'error', content: `HTTP ${res.status}: ${errorText}` }]);
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
              setEvents((prev) => [...prev, event]);
            } catch {
              // Ignore invalid JSON lines
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEvents((prev) => [...prev, { type: 'error', content: `Network error: ${msg}` }]);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title="Agent Harness"
        subtitle="Autonomous pair-programming agent running on your VPS repositories"
      />

      {/* Input / Control Panel */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted uppercase">Repository</label>
            <select
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={isRunning}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
            >
              {AVAILABLE_REPOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted uppercase">Model / Provider</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted uppercase">Task Instruction</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. Inspect package.json and run the tests, or add a new healthcheck route..."
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleStart}
            disabled={isRunning || !instruction.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? 'Agent Working...' : 'Run Agent Task'}
          </button>
        </div>
      </div>

      {/* Realtime Event Stream Display */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto rounded-xl border border-line bg-black p-4 font-mono text-xs text-ink-2 shadow-inner"
      >
        {events.length === 0 ? (
          <p className="text-neutral-500">
            {isRunning ? 'Starting harness...' : 'No active task. Select a repository and write an instruction above.'}
          </p>
        ) : (
          events.map((e, idx) => (
            <div key={idx} className="mb-3">
              {e.type === 'thought' && (
                <div className="text-neutral-300 whitespace-pre-wrap">{e.content}</div>
              )}
              {e.type === 'tool_call' && (
                <div className="rounded border border-blue-900/60 bg-blue-950/40 p-2 text-blue-300">
                  <span className="font-bold">⚡ TOOL: {e.toolName}</span>
                  <pre className="mt-1 overflow-x-auto text-[11px] text-blue-200/80">
                    {JSON.stringify(e.toolArgs, null, 2)}
                  </pre>
                </div>
              )}
              {e.type === 'tool_result' && (
                <div className="mt-1 rounded border border-neutral-800 bg-neutral-900/50 p-2 text-neutral-400">
                  <div className="text-[10px] uppercase text-neutral-500">Output ({e.toolName}):</div>
                  <pre className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">
                    {e.toolOutput}
                  </pre>
                </div>
              )}
              {e.type === 'final' && (
                <div className="rounded border border-green-800/60 bg-green-950/40 p-3 text-green-300 whitespace-pre-wrap">
                  <span className="font-bold">✔ FINISHED:</span> {e.content}
                </div>
              )}
              {e.type === 'error' && (
                <div className="rounded border border-red-800/60 bg-red-950/40 p-3 text-red-300 whitespace-pre-wrap">
                  <span className="font-bold">✖ ERROR:</span> {e.content}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
