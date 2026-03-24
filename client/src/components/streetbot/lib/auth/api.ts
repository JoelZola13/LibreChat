"use client";

/**
 * API utilities with Auth0 authentication.
 */

/**
 * Create a fetch wrapper that automatically adds the Authorization header.
 * 
 * Usage:
 * ```ts
 * const { getAccessToken } = useAuth();
 * const authFetch = createAuthFetch(getAccessToken);
 * const response = await authFetch("/api/chat", { method: "POST", body: ... });
 * ```
 */
export function createAuthFetch(
  getAccessToken: () => Promise<string | null>
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const token = await getAccessToken();

    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Auto-set Content-Type for JSON body if not already set
    if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

/**
 * Utility to add auth header to existing headers object.
 */
export function addAuthHeader(
  headers: Record<string, string>,
  token: string | null
): Record<string, string> {
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
