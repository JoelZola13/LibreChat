/**
 * Auth module exports for StreetBot.
 */
export { AuthProvider, useSupabaseAuth } from "./AuthProvider";
export { useAuth } from "./useAuth";
export { useFeatureAccess, Features } from "./useFeatureAccess";
export { useUserRole } from "./useUserRole";
export type { UserRole } from "./useUserRole";
export {
  auth0Config,
  isAuth0Configured,
  supabaseConfig,
  isSupabaseConfigured,
  isAuthConfigured,
  getAuthProvider,
  Scopes,
  FeaturePermissions,
} from "./config";
export { createAuthFetch, addAuthHeader } from "./api";
export type { ScopeValue, FeaturePermissionValue, AuthProvider as AuthProviderType } from "./config";
export type { AuthUser, UseAuthResult } from "./useAuth";
export type { FeatureKey, UseFeatureAccessResult } from "./useFeatureAccess";
