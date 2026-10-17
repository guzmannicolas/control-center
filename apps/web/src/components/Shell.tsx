import type { User } from '@cc/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { Link, usePath } from '../router.tsx';
import { SECTIONS } from '../sections.tsx';

function NotFound() {
  return (
    <div className="py-10">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-series hover:underline">Go to the overview</Link>
    </div>
  );
}

export function Shell({ user }: { user: User }) {
  const path = usePath();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: api.logout,
    // Reset (not clear) "who am I": it refetches, gets 401 and shows the login screen. Then drop the private data.
    onSettled: async () => {
      await queryClient.resetQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });
  // A section also owns the paths below it (/learning/docker belongs to /learning).
  const current = SECTIONS.find((s) => s.path === path) ?? SECTIONS.find((s) => s.path !== '/' && path.startsWith(`${s.path}/`));
  const Page = current?.Page ?? NotFound;

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Sections"
        className="sticky top-0 z-20 border-b border-line bg-page/95 backdrop-blur md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0"
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 md:px-5 md:pt-6 md:pb-4">
          <span aria-hidden className="size-2.5 rounded-full bg-good" />
          <span className="font-semibold">Control Center</span>
          <button onClick={() => logout.mutate()} className="ml-auto text-sm text-ink-2 hover:text-ink md:hidden">Sign out</button>
        </div>
        <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3">
          {SECTIONS.map(({ path: to, label, Icon }) => {
            const active = to === current?.path;
            return (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                    active ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-line' : 'text-ink-2 hover:bg-grid/50 hover:text-ink'
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto hidden border-t border-line px-5 py-4 text-sm md:block">
          <div className="truncate text-ink-2" title={user.email}>{user.email}</div>
          <button onClick={() => logout.mutate()} className="mt-1 text-ink-2 hover:text-ink hover:underline">Sign out</button>
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-4 pb-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Page />
        </div>
      </main>
    </div>
  );
}
