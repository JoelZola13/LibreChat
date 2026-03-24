"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import type { Auth0ProviderOptions } from "@auth0/auth0-react";
import { ReactNode, createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import type { SupabaseClient, SupabaseSession, SupabaseUser } from "./supabase-types";
import {
  auth0Config,
  isSupabaseConfigured,
  isAuth0Configured,
  getAuthProvider,
  AuthProvider as AuthProviderType,
} from "./config";
import {
  getSupabaseClient,
  getCachedSession,
  getCachedUser,
  isSessionInitialized,
  initializeSession,
  updateCachedSession,
} from "../supabase-loader";

// Supabase Auth Context
interface SupabaseAuthContextValue {
  supabase: SupabaseClient | null;
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  isLoading: boolean;
}

// Default reads from cache - prevents flash on navigation
const SupabaseAuthContext = createContext<SupabaseAuthContextValue>({
  supabase: null,
  user: null,
  session: null,
  // If session is already initialized, default to not loading
  get isLoading() {
    return !isSessionInitialized();
  },
} as SupabaseAuthContextValue);

export const useSupabaseAuth = () => useContext(SupabaseAuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Supabase Auth Provider component.
 * Uses isolated loader to survive HMR updates.
 * Session is cached to prevent re-authentication on page navigation.
 */
function SupabaseAuthProvider({ children }: AuthProviderProps) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(() => getSupabaseClient() as SupabaseClient | null);
  const [user, setUser] = useState<SupabaseUser | null>(() => getCachedUser() as SupabaseUser | null);
  const [session, setSession] = useState<SupabaseSession | null>(() => getCachedSession() as SupabaseSession | null);
  const [isLoading, setIsLoading] = useState(() => {
    // NEVER loading if we have cached data
    if (isSessionInitialized()) return false;
    if (getCachedSession() || getCachedUser()) return false;
    return true;
  });
  const listenerSetupRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    // Already initialized - no fetch needed
    if (isSessionInitialized()) {
      const client = getSupabaseClient();
      const sess = getCachedSession();
      const usr = getCachedUser();
      if (client) setSupabase(client as SupabaseClient);
      if (sess) setSession(sess);
      if (usr) setUser(usr);
      setIsLoading(false);
      return;
    }

    // First time - fetch session
    let isMounted = true;

    initializeSession().then(({ session: sess, user: usr }) => {
      if (!isMounted) return;
      const client = getSupabaseClient();
      if (client) setSupabase(client as SupabaseClient);
      setSession(sess);
      setUser(usr);
      setIsLoading(false);
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Auth state change listener
  useEffect(() => {
    if (!supabase || listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      updateCachedSession(newSession);
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      listenerSetupRef.current = false;
    };
  }, [supabase]);

  const value = useMemo(
    () => ({ supabase, user, session, isLoading }),
    [supabase, user, session, isLoading]
  );

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

/**
 * Auth0 Auth Provider component.
 * Uses real config when Auth0 is configured, or placeholder values
 * to ensure useAuth0() hook works (for consistent hook ordering).
 */
function Auth0AuthProvider({ children }: AuthProviderProps) {
  // Use placeholder values when Auth0 is not configured
  // This allows useAuth0() to be called without throwing
  const domain = auth0Config.domain || "placeholder.auth0.com";
  const clientId = auth0Config.clientId || "placeholder_client_id";

  const providerOptions: Auth0ProviderOptions = {
    domain,
    clientId,
    authorizationParams: {
      redirect_uri: auth0Config.redirectUri || (typeof window !== "undefined" ? window.location.origin : ""),
      audience: auth0Config.audience,
      scope: auth0Config.scope,
    },
    cacheLocation: "localstorage",
    useRefreshTokens: true,
    // Skip initialization when using placeholder values
    skipRedirectCallback: !isAuth0Configured(),
  };

  return <Auth0Provider {...providerOptions}>{children}</Auth0Provider>;
}

/**
 * Combined Auth Provider for StreetBot.
 *
 * Uses Auth0 if configured (primary), falls back to Supabase Auth.
 * Always wraps with Auth0Provider to ensure useAuth0() hook doesn't throw
 * (required for consistent hook ordering in useAuth).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const provider = useMemo(() => getAuthProvider(), []);

  // Always wrap with Auth0Provider to ensure useAuth0() hook works
  // (prevents "Rules of Hooks" errors from conditional hook calls)
  const wrappedChildren = (
    <Auth0AuthProvider>
      {provider === "supabase" ? (
        <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
      ) : (
        children
      )}
    </Auth0AuthProvider>
  );

  return wrappedChildren;
}
