import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { StoreProvider } from './app/store';
import { initNativeShell, isNative } from './platform';
import './styles.css';
import { applyTheme } from './ui/theme';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

// Offline support. The service worker caches only the app's own static files.
void initNativeShell();

// The native apps bundle every file, so the service worker is for the web only.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* not available in this context; the app still works online */
    });
  });
}
