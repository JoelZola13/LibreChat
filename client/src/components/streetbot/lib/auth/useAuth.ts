"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useMemo } from "react";
import { useSupabaseAuth } from "./AuthProvider";
import {
  isSupabaseConfigured,
  isAuth0Configured,
  getAuthProvider,
  Scopes,
  ScopeValue,
} from "./config";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  roles?: string[];
  appMetadata?: Record<string, unknown>;
}

export interface UseAuthResult {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  user: AuthUser | null;
  error: Error | null;
  provider: "supabase" | "auth0" | "none";

  // Auth actions
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<{ error?: string }>;

  // Permissions
  hasScope: (scope: ScopeValue | string) => boolean;
  hasAnyScope: (...scopes: (ScopeValue | string)[]) => boolean;
  hasAllScopes: (...scopes: (ScopeValue | string)[]) => boolean;
  hasRole: (role: string) => boolean;

  // Tier checks
  isPro: boolean;
  isAdmin: boolean;
  isMaster: boolean;
  canUseAllAgents: boolean;
}

/**
 * Hook for authentication and authorization in StreetBot.
 *
 * Supports both Supabase (primary) and Auth0 (legacy fallback).
 * When neither is configured, returns an anonymous user with full access
 * for development purposes.
 */
export function useAuth(): UseAuthResult {
  const provider = getAuthProvider();
  const supabaseAuth = useSupabaseAuth();

  // Always call useAuth0 to maintain consistent hook order (Rules of Hooks)
  // We'll only USE the result if Auth0 is the active provider
  const auth0Result = useAuth0();
  const auth0 = provider === "auth0" ? auth0Result : null;

  // Build unified auth state
  const { isAuthenticated, isLoading, user, error, userScopes, userRoles } = useMemo(() => {
    // Supabase auth
    if (provider === "supabase") {
      const { user: supabaseUser, session, isLoading } = supabaseAuth;

      if (!supabaseUser || !session) {
        return {
          isAuthenticated: false,
          isLoading,
          user: null,
          error: null,
          userScopes: new Set<string>(),
          userRoles: [] as string[],
        };
      }

      // Extract roles and scopes from app_metadata
      const appMetadata = supabaseUser.app_metadata || {};
      const roles = appMetadata.roles || [];
      const scopes = new Set<string>(appMetadata.scopes || []);

      // Default scopes for authenticated users
      scopes.add(Scopes.USE_SOCIAL_WORK_AGENT);

      // Add admin scopes if admin role
      if (roles.includes("admin") || roles.includes("super_admin")) {
        scopes.add(Scopes.USE_ALL_AGENTS);
        scopes.add(Scopes.USE_PRO_FEATURES);
        scopes.add(Scopes.MANAGE_DIRECTORY);
        scopes.add(Scopes.MANAGE_ANALYTICS);
        scopes.add(Scopes.READ_USERS);
        scopes.add(Scopes.MANAGE_USERS);
        scopes.add(Scopes.MANAGE_SYSTEM_HEALTH);
      }

      const authUser: AuthUser = {
        id: supabaseUser.id,
        email: supabaseUser.email ?? undefined,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name,
        picture: supabaseUser.user_metadata?.avatar_url,
        emailVerified: !!supabaseUser.email_confirmed_at,
        roles,
        appMetadata,
      };

      return {
        isAuthenticated: true,
        isLoading,
        user: authUser,
        error: null,
        userScopes: scopes,
        userRoles: roles,
      };
    }

    // Auth0 auth (legacy)
    if (provider === "auth0" && auth0) {
      const { isAuthenticated, isLoading, user: auth0User, error } = auth0;

      if (!auth0User) {
        return {
          isAuthenticated: false,
          isLoading,
          user: null,
          error: error || null,
          userScopes: new Set<string>(),
          userRoles: [] as string[],
        };
      }

      // Extract roles from Auth0 (may be in custom namespace or app_metadata)
      const roles =
        ((auth0User as Record<string, unknown>)?.["https://streetbot.ai/roles"] as string[]) ||
        ((auth0User as Record<string, unknown>)?.["roles"] as string[]) ||
        [];

      // Build scopes based on role
      // Free users only get social_work_agent, Pro/Master users get all agents
      const scopes = new Set<string>();

      // All authenticated users get basic agent access
      scopes.add(Scopes.USE_SOCIAL_WORK_AGENT);

      // Check for Pro or Master roles (case-insensitive)
      const roleNames = roles.map(r => r.toLowerCase());
      const isPro = roleNames.some(r => r.includes("pro") || r.includes("master") || r.includes("admin"));

      if (isPro) {
        scopes.add(Scopes.USE_ALL_AGENTS);
        scopes.add(Scopes.USE_PRO_FEATURES);
      }

      // Admin/Master roles get management scopes
      const isAdmin = roleNames.some(r => r.includes("master") || r.includes("admin"));
      if (isAdmin) {
        scopes.add(Scopes.MANAGE_DIRECTORY);
        scopes.add(Scopes.MANAGE_ANALYTICS);
        scopes.add(Scopes.READ_USERS);
        scopes.add(Scopes.MANAGE_USERS);
        scopes.add(Scopes.MANAGE_SYSTEM_HEALTH);
      }

      const authUser: AuthUser = {
        id: auth0User.sub || "",
        email: auth0User.email,
        name: auth0User.name,
        picture: auth0User.picture,
        emailVerified: auth0User.email_verified,
        roles,
      };

      return {
        isAuthenticated,
        isLoading,
        user: authUser,
        error: error || null,
        userScopes: scopes,
        userRoles: roles,
      };
    }

    // No auth configured - dev mode with anonymous user
    return {
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: "anonymous",
        name: "Developer",
        email: "dev@streetbot.local",
        roles: ["super_admin"],
      },
      error: null,
      userScopes: new Set(Object.values(Scopes)),
      userRoles: ["super_admin"],
    };
  }, [provider, supabaseAuth, auth0]);

  // Scope checking
  const hasScope = useCallback(
    (scope: ScopeValue | string): boolean => {
      if (provider === "none") return true; // Dev mode
      return userScopes.has(scope);
    },
    [provider, userScopes]
  );

  const hasAnyScope = useCallback(
    (...scopes: (ScopeValue | string)[]): boolean => {
      if (provider === "none") return true;
      return scopes.some((s) => userScopes.has(s));
    },
    [provider, userScopes]
  );

  const hasAllScopes = useCallback(
    (...scopes: (ScopeValue | string)[]): boolean => {
      if (provider === "none") return true;
      return scopes.every((s) => userScopes.has(s));
    },
    [provider, userScopes]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (provider === "none") return true;
      return userRoles.includes(role);
    },
    [provider, userRoles]
  );

  // Login with redirect (for OAuth/social login)
  const login = useCallback(async () => {
    console.log("useAuth login() called, provider:", provider);

    if (provider === "supabase" && supabaseAuth.supabase) {
      // For Supabase, redirect to login page (or show modal)
      // This is typically handled by a login page component
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }

    if (provider === "auth0") {
      console.log("Auth0 provider detected, auth0 object:", !!auth0, "loginWithRedirect:", !!auth0?.loginWithRedirect);
      if (auth0?.loginWithRedirect) {
        console.log("Calling auth0.loginWithRedirect()...");
        await auth0.loginWithRedirect();
        return;
      } else {
        console.error("Auth0 loginWithRedirect not available. auth0:", auth0);
        throw new Error("Auth0 not properly initialized");
      }
    }

    console.error("No valid auth provider for login");
    throw new Error("No auth provider configured");
  }, [provider, supabaseAuth.supabase, auth0]);

  // Login with email/password (Supabase only)
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      if (provider !== "supabase" || !supabaseAuth.supabase) {
        return { error: "Email login not available" };
      }

      const { error } = await supabaseAuth.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    },
    [provider, supabaseAuth.supabase]
  );

  // Sign up with email/password (Supabase only)
  const signup = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>
    ): Promise<{ error?: string }> => {
      if (provider !== "supabase" || !supabaseAuth.supabase) {
        return { error: "Signup not available" };
      }

      const { error } = await supabaseAuth.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    },
    [provider, supabaseAuth.supabase]
  );

  // Logout
  const logout = useCallback(async () => {
    if (provider === "supabase" && supabaseAuth.supabase) {
      await supabaseAuth.supabase.auth.signOut();
      return;
    }

    if (provider === "auth0" && auth0?.logout) {
      auth0.logout({
        logoutParams: {
          returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      return;
    }
  }, [provider, supabaseAuth.supabase, auth0]);

  // Get access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (provider === "supabase" && supabaseAuth.session) {
      return supabaseAuth.session.access_token ?? null;
    }

    if (provider === "auth0" && auth0?.getAccessTokenSilently) {
      try {
        // Try to get token silently first
        return await auth0.getAccessTokenSilently({
          authorizationParams: {
            audience: "https://streetbot-api",
          },
        });
      } catch (err: unknown) {
        // If refresh token is missing, try without it (uses session cookie)
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("Missing Refresh Token") || errorMessage.includes("login_required")) {
          console.warn("Refresh token missing, trying with cache mode...");
          try {
            return await auth0.getAccessTokenSilently({
              authorizationParams: {
                audience: "https://streetbot-api",
              },
              cacheMode: "off", // Force fresh token from Auth0
            });
          } catch (retryErr) {
            console.error("Failed to get access token (retry):", retryErr);
            // Force re-login
            if (auth0.loginWithRedirect) {
              await auth0.loginWithRedirect();
            }
            return null;
          }
        }
        console.error("Failed to get access token:", err);
        return null;
      }
    }

    return null;
  }, [provider, supabaseAuth.session, auth0]);

  // Reset password (Supabase only)
  const resetPassword = useCallback(
    async (email: string): Promise<{ error?: string }> => {
      if (provider !== "supabase" || !supabaseAuth.supabase) {
        return { error: "Password reset not available" };
      }

      const { error } = await supabaseAuth.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    },
    [provider, supabaseAuth.supabase]
  );

  // Convenience tier checks
  const canUseAllAgents = hasScope(Scopes.USE_ALL_AGENTS);
  const isPro = hasScope(Scopes.USE_PRO_FEATURES);
  const isAdmin = hasScope(Scopes.MANAGE_ANALYTICS) || hasRole("admin") || hasRole("super_admin");
  const isMaster = hasScope(Scopes.MANAGE_SYSTEM_HEALTH) || hasRole("super_admin");

  return {
    isAuthenticated,
    isLoading,
    isConfigured: provider !== "none",
    user,
    error,
    provider,
    login,
    loginWithEmail,
    signup,
    logout,
    getAccessToken,
    resetPassword,
    hasScope,
    hasAnyScope,
    hasAllScopes,
    hasRole,
    isPro,
    isAdmin,
    isMaster,
    canUseAllAgents,
  };
}
