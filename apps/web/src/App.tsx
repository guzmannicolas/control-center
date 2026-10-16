import { useQuery } from '@tanstack/react-query';
import { api, isUnauthorized } from './api.ts';
import { Dashboard } from './components/Dashboard.tsx';
import { Login } from './components/Login.tsx';

export function App() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });

  if (me.isPending) return <p className="p-8 text-muted">Loading…</p>;
  if (me.error && isUnauthorized(me.error)) return <Login />;
  if (me.error) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-lg font-semibold">Control Center</h1>
        <p className="mt-2 text-ink-2">{me.error.message}. Try again in a moment.</p>
        <button className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm" onClick={() => void me.refetch()}>
          Retry
        </button>
      </main>
    );
  }
  return <Dashboard user={me.data.user} />;
}
