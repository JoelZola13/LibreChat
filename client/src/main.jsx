import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';
import { installLocalStreetBotReadProxy } from './components/streetbot/shared/apiConfig';

const runtimeHost = window.location.hostname;
const runtimePort = window.location.port;
const runtimeForcesStreetBot =
  runtimePort === '3180' ||
  runtimeHost === 'streetbot-directory.pages.dev' ||
  runtimeHost.endsWith('.streetbot-directory.pages.dev');
const isStreetBotVariant =
  runtimeForcesStreetBot || (import.meta.env.VITE_APP_VARIANT || 'streetbot') === 'streetbot';

if (isStreetBotVariant) {
  installLocalStreetBotReadProxy();
  try {
    if (runtimeForcesStreetBot || !localStorage.getItem('color-theme')) {
      localStorage.setItem('color-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

if ('caches' in window) {
  caches
    .keys()
    .then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).catch(() => {});
      });
    })
    .catch(() => {});
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <ApiErrorBoundaryProvider>
    <App />
  </ApiErrorBoundaryProvider>,
);
