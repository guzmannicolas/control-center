import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isUnauthorized } from './api.ts';
import { App } from './App.tsx';
import './styles.css';

const queryClient: QueryClient = new QueryClient({
  // A 401 anywhere means the session ended: re-check who we are, which shows the login screen.
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (isUnauthorized(err) && query.queryKey[0] !== 'me') void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  }),
  defaultOptions: {
    queries: { retry: (count, err) => !isUnauthorized(err) && count < 2, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
