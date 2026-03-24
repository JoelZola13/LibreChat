/**
 * Auth-aware fetch wrapper for Street Bot Pro API requests.
 *
 * Reads the JWT token from axios defaults (set by LibreChat's AuthContext)
 * and attaches it as an Authorization header on every /sbapi request.
 */
import axios from 'axios';
import { SB_API_BASE } from './apiConfig';

/** Read the current LibreChat JWT from axios defaults. */
function getAuthToken(): string | undefined {
  const header = axios.defaults.headers.common['Authorization'];
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header;
  }
  return undefined;
}

/**
 * Fetch wrapper that auto-attaches the LibreChat JWT.
 * Usage: `sbFetch('/messages/conversations')` → `fetch('/sbapi/messages/conversations', { headers: { Authorization: ... } })`
 *
 * @param path  Path relative to SB_API_BASE (e.g. '/messages/conversations')
 * @param init  Standard RequestInit options
 */
export async function sbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('/sbapi') ? path : `${SB_API_BASE}${path}`;
  const authHeader = getAuthToken();

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // Default Content-Type for JSON bodies
  if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add 15s timeout unless caller provided their own signal
  if (!init.signal) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    return fetch(url, { ...init, headers, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  }

  return fetch(url, { ...init, headers });
}

/** Convenience: GET + parse JSON */
export async function sbGet<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await sbFetch(`${path}${qs}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/** Convenience: POST + parse JSON */
export async function sbPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await sbFetch(path, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  // Handle 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Convenience: PATCH + parse JSON */
export async function sbPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await sbFetch(path, {
    method: 'PATCH',
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Convenience: DELETE */
export async function sbDelete(path: string): Promise<void> {
  const res = await sbFetch(path, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} failed: ${res.status}`);
}
