"use client";

export type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: (Record<string, unknown> & {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  }) | null;
  app_metadata?: (Record<string, unknown> & { roles?: string[]; scopes?: string[] }) | null;
  email_confirmed_at?: string | null;
};

export type SupabaseSession = {
  access_token?: string;
  user?: SupabaseUser | null;
} | null;

type SupabaseAuthSubscription = {
  unsubscribe: () => void;
};

type SupabaseAuthClient = {
  getSession: () => Promise<{ data: { session: SupabaseSession | null }; error?: { message: string } | null }>;
  onAuthStateChange: (
    callback: (event: string, session: SupabaseSession) => void,
  ) => { data: { subscription: SupabaseAuthSubscription } };
  signInWithPassword: (args: { email: string; password: string }) => Promise<{
    data?: { user?: SupabaseUser | null; session?: SupabaseSession | null };
    error?: { message: string } | null;
  }>;
  signUp: (args: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }) => Promise<{
    data?: { user?: SupabaseUser | null; session?: SupabaseSession | null };
    error?: { message: string } | null;
  }>;
  signOut: () => Promise<{ error?: { message: string } | null }>;
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ error?: { message: string } | null }>;
};

export type SupabaseClient = {
  auth: SupabaseAuthClient;
};
