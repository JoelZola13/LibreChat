/**
 * Central API configuration for StreetBot
 * Uses /sbapi proxy which forwards to the StreetBot backend
 */

// In LibreChat, we use the /sbapi proxy to reach the StreetBot backend
export const API_BASE = '/sbapi';

// Helper to build API URLs
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE}/${cleanPath}`;
}
