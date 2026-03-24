/**
 * Supabase client singleton for StreetBot.
 *
 * This module provides a shared Supabase client instance for:
 * - Authentication (sign in, sign up, sign out)
 * - Database queries
 * - Realtime subscriptions
 * - Storage operations
 *
 * Uses the isolated loader to avoid HMR issues with Turbopack.
 */

import {
  loadSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
} from "./supabase-loader";

// Re-export configuration check
export { isSupabaseConfigured };

// Local type definitions to avoid importing from @supabase/supabase-js
export type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  email_confirmed_at?: string | null;
};

export type SupabaseSession = {
  access_token?: string;
  user?: SupabaseUser | null;
} | null;

export type AuthChangeEvent = string;

export type RealtimeChannel = {
  on: (type: string, filter: any, callback: (payload: any) => void) => RealtimeChannel;
  subscribe: (callback?: (status: string) => void) => RealtimeChannel;
  track: (payload: any) => Promise<void>;
  send: (payload: any) => void;
  presenceState: <T>() => Record<string, T[]>;
};

export type SupabaseClient = {
  auth: {
    getSession: () => Promise<{ data: { session: SupabaseSession | null }; error?: any }>;
    onAuthStateChange: (callback: (event: string, session: any) => void) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (args: { email: string; password: string }) => Promise<any>;
    signUp: (args: { email: string; password: string; options?: any }) => Promise<any>;
    signOut: () => Promise<any>;
    resetPasswordForEmail: (email: string, options?: any) => Promise<any>;
  };
  channel: (name: string, options?: { config?: { presence?: { key?: string } } }) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => void;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File, options?: any) => Promise<any>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

/**
 * Get the Supabase client singleton (async, lazy-loaded).
 * Returns null if Supabase is not configured.
 */
export async function getSupabaseAsync(): Promise<SupabaseClient | null> {
  return loadSupabaseClient() as Promise<SupabaseClient | null>;
}

/**
 * Get the Supabase client singleton (sync, returns cached instance).
 * Returns null if not yet loaded or not configured.
 * Use getSupabaseAsync() for guaranteed loading.
 * @deprecated Prefer getSupabaseAsync() for HMR compatibility
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  // Trigger async load if not started
  const cached = getSupabaseClient();
  if (!cached) {
    loadSupabaseClient();
  }

  return cached as SupabaseClient | null;
}

// Legacy: Direct export (may be null until loaded)
// Use getSupabaseAsync() instead for guaranteed access
export const supabase = null as SupabaseClient | null;
