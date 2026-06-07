// Street Bot Pro API proxy base - proxied to localhost:8002 via Vite/server config.
export const SB_API_BASE = '/sbapi';

const DIRECTORY_READ_API_ORIGIN = 'https://streetbot-directory.pages.dev';
const STREETBOT_READ_API_ORIGIN = 'https://streetbot-directory.pages.dev';

declare global {
  interface Window {
    __streetBotReadProxy?: boolean;
  }
}

function isLocalStreetBotHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname, port } = window.location;
  return (
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') &&
    (port === '3180' || port === '')
  );
}

export function directoryApiPath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return isLocalStreetBotHost()
    ? `${DIRECTORY_READ_API_ORIGIN}${normalizedPath}`
    : normalizedPath;
}

export function streetBotReadApiPath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return isLocalStreetBotHost() ? `${STREETBOT_READ_API_ORIGIN}${normalizedPath}` : normalizedPath;
}

export function shouldUseLocalReadApiProxy(method = 'GET') {
  return isLocalStreetBotHost() && method.toUpperCase() === 'GET';
}

export function installLocalStreetBotReadProxy() {
  if (!isLocalStreetBotHost() || typeof window === 'undefined' || window.__streetBotReadProxy) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const readablePrefixes = ['/sbapi/', '/api/academy/', '/api/street-profiles/', '/api/directory'];

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
      return originalFetch(input, init);
    }

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    try {
      const parsed = new URL(url, window.location.origin);
      const isSameOrigin =
        !parsed.origin ||
        parsed.origin === window.location.origin ||
        parsed.hostname === window.location.hostname;
      const shouldRewrite =
        isSameOrigin && readablePrefixes.some((prefix) => parsed.pathname.startsWith(prefix));

      if (shouldRewrite) {
        parsed.protocol = new URL(STREETBOT_READ_API_ORIGIN).protocol;
        parsed.host = new URL(STREETBOT_READ_API_ORIGIN).host;
        if (typeof input === 'string' || input instanceof URL) {
          return originalFetch(parsed.toString(), init);
        }
        return originalFetch(new Request(parsed.toString(), input), init);
      }
    } catch {
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };

  window.__streetBotReadProxy = true;
}

export const DIRECTORY_SEARCH_API_URL = directoryApiPath('/api/directory/search');
export const DIRECTORY_SERVICES_API_URL = directoryApiPath('/sbapi/services');
export const DIRECTORY_SERVICES_SEARCH_API_URL = directoryApiPath('/api/directory/search');
export const STREETBOT_READ_API_BASE = streetBotReadApiPath('/sbapi');
