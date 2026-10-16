import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api.ts';

function loginError(err: unknown) {
  if (err instanceof ApiError && err.status === 429) return 'Too many attempts. Wait 15 minutes and try again.';
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function Login() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => queryClient.setQueryData(['me'], data),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Control Center</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in to see the state of everything.</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">Email</label>
        <input
          id="email" type="email" autoComplete="username" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 outline-none focus:border-series"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 outline-none focus:border-series"
        />

        {login.error && (
          <p role="alert" className="mt-4 text-sm text-critical">{loginError(login.error)}</p>
        )}
        <button
          type="submit" disabled={login.isPending}
          className="mt-6 w-full rounded-md bg-ink px-3 py-2 font-medium text-page disabled:opacity-60"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
