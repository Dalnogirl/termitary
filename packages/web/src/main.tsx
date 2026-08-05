import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lobby refreshes on focus; no need for aggressive polling. Cache for
      // 10s so navigating in and out of /lobby doesn't refetch every time.
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const root = document.querySelector<HTMLDivElement>('#root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
