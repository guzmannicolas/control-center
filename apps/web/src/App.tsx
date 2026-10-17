import { useQuery } from '@tanstack/react-query';
import { api, isNetworkError, isUnauthorized } from './api.ts';
import { Shell } from './components/Shell.tsx';
import { Login } from './components/Login.tsx';

export function App() {
  // Retry only network trouble (a hiccup, a hung connection); a 401 is a real answer.
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: (count, err) => isNetworkError(err) && count < 2 });

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
  return <Shell user={me.data.user} />;
}
