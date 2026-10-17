import {
  IMPROVEMENT_AREAS, IMPROVEMENT_STATUSES, ImprovementInput, PRIORITIES, type ImprovementView,
} from '@cc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../api.ts';
import { PageHeader } from '../components/PageHeader.tsx';

type Status = ImprovementView['status'];
type Priority = ImprovementView['priority'];

const STATUS_LABEL: Record<Status, string> = { idea: 'Idea', planned: 'Planned', in_progress: 'In progress', done: 'Done' };
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const FILTERS = [
  { id: 'open', label: 'Open', test: (i: ImprovementView) => i.status !== 'done' },
  { id: 'done', label: 'Done', test: (i: ImprovementView) => i.status === 'done' },
  { id: 'all', label: 'All', test: () => true },
] as const;

const field = 'w-full rounded-md border border-line bg-page px-3 py-2 text-sm outline-none focus:border-series';

// Priority is not a health status, so it uses ink weight, not the reserved status colors.
function PriorityTag({ priority }: { priority: Priority }) {
  const style = priority === 'high' ? 'bg-ink text-page' : priority === 'medium' ? 'border border-line text-ink' : 'text-muted';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style}`}>{PRIORITY_LABEL[priority]}</span>;
}

function AddForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ title: string; details: string; area: ImprovementView['area']; priority: Priority }>(
    { title: '', details: '', area: 'infrastructure', priority: 'medium' },
  );
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: api.addImprovement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['improvements'] });
      onDone();
    },
    onError: (err) => setError(err.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The same schema the API uses: the rules live in one place.
    const parsed = ImprovementInput.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the form');
    setError(null);
    add.mutate(parsed.data);
  };

  return (
    <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border border-line bg-surface p-4">
      <div>
        <label htmlFor="imp-title" className="text-xs text-muted">What should improve?</label>
        <input id="imp-title" className={`${field} mt-1`} value={form.title} maxLength={200} autoFocus
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label htmlFor="imp-details" className="text-xs text-muted">Details (optional)</label>
        <textarea id="imp-details" className={`${field} mt-1`} rows={3} value={form.details} maxLength={2000}
          onChange={(e) => setForm({ ...form, details: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-muted">Area
          <select className={`${field} mt-1 block`} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as typeof form.area })}>
            {IMPROVEMENT_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Priority
          <select className={`${field} mt-1 block`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={add.isPending} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-page disabled:opacity-60">
          {add.isPending ? 'Adding…' : 'Add improvement'}
        </button>
        <button type="button" onClick={onDone} className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-grid/50">Cancel</button>
      </div>
    </form>
  );
}

function Item({ item }: { item: ImprovementView }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['improvements'] });
  const update = useMutation({ mutationFn: (status: Status) => api.updateImprovement(item.id, { status }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.deleteImprovement(item.id), onSuccess: refresh });
  const done = item.status === 'done';

  return (
    <li className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 ${update.isPending || remove.isPending ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityTag priority={item.priority} />
          <h3 className={`font-medium ${done ? 'text-ink-2 line-through decoration-muted' : ''}`}>{item.title}</h3>
        </div>
        {item.details && <p className="mt-1 text-sm text-ink-2">{item.details}</p>}
        <p className="mt-1 text-xs text-muted">
          {item.area} · added {new Date(item.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
          {item.doneAt && ` · done ${new Date(item.doneAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`status-${item.id}`}>Status of {item.title}</label>
        <select id={`status-${item.id}`} value={item.status} onChange={(e) => update.mutate(e.target.value as Status)}
          className="rounded-md border border-line bg-page px-2 py-1 text-sm">
          {IMPROVEMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button
          onClick={() => window.confirm(`Delete "${item.title}"?`) && remove.mutate()}
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-grid/50 hover:text-ink"
          aria-label={`Delete ${item.title}`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function ImprovementsPage() {
  const improvements = useQuery({ queryKey: ['improvements'], queryFn: api.improvements });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('open');
  const [area, setArea] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const all = improvements.data ?? [];
  const open = all.filter((i) => i.status !== 'done').length;
  const shown = all.filter(FILTERS.find((f) => f.id === filter)!.test).filter((i) => !area || i.area === area);
  const areas = [...new Set(all.map((i) => i.area))];

  return (
    <div>
      <PageHeader
        title="Improvements"
        subtitle={improvements.data ? `${open} open · ${all.length - open} done` : improvements.isError ? 'Could not load' : 'Loading…'}
      />
      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="mb-4 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-page">
          + Add improvement
        </button>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
            className={`rounded-md px-2.5 py-1 text-sm ${filter === f.id ? 'bg-ink text-page' : 'text-ink-2 hover:bg-grid/50'}`}>
            {f.label}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-line" aria-hidden />
        {areas.map((a) => (
          <button key={a} onClick={() => setArea(area === a ? null : a)} aria-pressed={area === a}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${area === a ? 'border-ink bg-ink text-page' : 'border-line text-ink-2 hover:bg-grid/50'}`}>
            {a}
          </button>
        ))}
      </div>

      {shown.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {shown.map((i) => <Item key={i.id} item={i} />)}
        </ul>
      ) : (
        improvements.data && <p className="text-sm text-muted">Nothing here.</p>
      )}
    </div>
  );
}
