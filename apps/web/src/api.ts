import type { DomainView, IncidentView, Overview, ResultPoint, User } from '@cc/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4101';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // credentials: 'include' sends the session cookie to the API (a different subdomain).
    res = await fetch(BASE + path, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
      // A request that never answers must not leave the screen on "Loading…" forever.
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new ApiError(0, timedOut ? 'The API took too long to answer' : 'The API cannot be reached');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;
export const isNetworkError = (err: unknown) => err instanceof ApiError && err.status === 0;

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  overview: () => request<Overview>('/api/overview'),
  incidents: () => request<IncidentView[]>('/api/incidents?limit=20'),
  domains: () => request<DomainView[]>('/api/domains'),
  results: (monitorId: string, hours: number) => request<ResultPoint[]>(`/api/monitors/${monitorId}/results?hours=${hours}`),
};
