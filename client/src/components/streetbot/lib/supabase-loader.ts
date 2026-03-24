/**
 * Isolated Supabase loader with HMR error recovery and session caching.
 *
 * This module handles the dynamic loading of @supabase/supabase-js
 * and automatically triggers a page reload if HMR invalidates the module.
 *
 * Session caching prevents re-authentication on every page navigation.
 */

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// Module state
let clientInstance: any = null;
let loadPromise: Promise<any> | null = null;
let loadFailed = false;

// Session cache - prevents re-fetching on every page navigation
let cachedSession: any = null;
let cachedUser: any = null;
let sessionInitialized = false;
let sessionInitPromise: Promise<void> | null = null;

// Storage key for session initialization flag
const SESSION_INIT_KEY = "streetbot-session-initialized";

/**
 * Load and return the Supabase client.
 * Handles HMR errors by triggering page reload.
 */
export async function loadSupabaseClient(): Promise<any> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (clientInstance) {
    return clientInstance;
  }

  if (loadFailed) {
    return null;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // Use Function constructor to create a truly dynamic import
      // that Turbopack can't statically analyze
      const importFn = new Function(
        'return import("@supabase/supabase-js")'
      ) as () => Promise<any>;

      const mod = await importFn();

      clientInstance = mod.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "streetbot-auth",
        },
      });

      return clientInstance;
    } catch (error: any) {
      // Check if this is an HMR module factory error
      if (error?.message?.includes("module factory is not available")) {
        console.warn("[Supabase] HMR invalidated module, reloading page...");
        loadFailed = true;

        // Only reload in browser, and only once
        if (typeof window !== "undefined" && !window.__supabaseHmrReloading) {
          (window as any).__supabaseHmrReloading = true;
          window.location.reload();
        }
        return null;
      }

      console.error("[Supabase] Failed to load client:", error);
      loadFailed = true;
      loadPromise = null;
      return null;
    }
  })();

  return loadPromise;
}

/**
 * Get the cached client (sync, may be null).
 */
export function getSupabaseClient(): any {
  return clientInstance;
}

/**
 * Get cached session (sync, returns immediately).
 * Returns null if session hasn't been initialized yet.
 */
export function getCachedSession(): any {
  return cachedSession;
}

/**
 * Get cached user (sync, returns immediately).
 * Returns null if session hasn't been initialized yet.
 */
export function getCachedUser(): any {
  return cachedUser;
}

/**
 * Check if session has been initialized (fetched at least once).
 * Also checks localStorage to survive module reloads.
 */
export function isSessionInitialized(): boolean {
  if (sessionInitialized) return true;

  // Check localStorage as fallback (survives module reloads)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(SESSION_INIT_KEY);
      if (stored === "true") {
        // Restore from Supabase's localStorage cache
        const authData = localStorage.getItem("streetbot-auth");
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            cachedSession = parsed;
            cachedUser = parsed?.user ?? null;
            sessionInitialized = true;
            console.log("[Supabase] Restored session from localStorage");
            return true;
          } catch {
            // Invalid JSON, ignore
          }
        }
      }
    } catch {
      // Storage not available
    }
  }

  return false;
}

/**
 * Initialize session (fetch once, then cache).
 * Safe to call multiple times - only fetches on first call.
 */
export async function initializeSession(): Promise<{ session: any; user: any }> {
  // Already initialized - return cached values
  if (sessionInitialized) {
    return { session: cachedSession, user: cachedUser };
  }

  // Already initializing - wait for it
  if (sessionInitPromise) {
    await sessionInitPromise;
    return { session: cachedSession, user: cachedUser };
  }

  // Start initialization
  sessionInitPromise = (async () => {
    const client = await loadSupabaseClient();
    if (!client) {
      sessionInitialized = true;
      return;
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      cachedSession = session;
      cachedUser = session?.user ?? null;
      sessionInitialized = true;

      // Mark as initialized in sessionStorage (survives module reloads)
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(SESSION_INIT_KEY, "true");
        } catch {
          // Storage not available
        }
      }

      console.log("[Supabase] Session initialized, user:", session?.user?.email ?? "none");

      // Set up auth state change listener (only once)
      client.auth.onAuthStateChange((_event: string, session: any) => {
        cachedSession = session;
        cachedUser = session?.user ?? null;
      });
    } catch (error) {
      console.warn("[Supabase] Failed to get session:", error);
      sessionInitialized = true;
    }
  })();

  await sessionInitPromise;
  return { session: cachedSession, user: cachedUser };
}

/**
 * Update cached session (called from auth state changes).
 */
export function updateCachedSession(session: any): void {
  cachedSession = session;
  cachedUser = session?.user ?? null;
  sessionInitialized = true;
}

/**
 * Reset the loader state (for testing or logout).
 */
export function resetLoader(): void {
  clientInstance = null;
  loadPromise = null;
  loadFailed = false;
  cachedSession = null;
  cachedUser = null;
  sessionInitialized = false;
  sessionInitPromise = null;

  // Clear sessionStorage flag
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_INIT_KEY);
    } catch {
      // Storage not available
    }
  }
}

// Type declarations for window
declare global {
  interface Window {
    __supabaseHmrReloading?: boolean;
  }
}
