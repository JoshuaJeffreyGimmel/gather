import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RouterProvider } from './router';
import { SessionProvider } from './session';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <RouterProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </RouterProvider>
  </StrictMode>
);

// The service worker is a production concern only — in dev it would just serve
// stale bundles back to us.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
  });
}
