import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './styles.css';
import { App } from './App';

registerSW({ immediate: true });
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: 0 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
