/**
 * Authentication configuration for StreetBot.
 *
 * Primary: Auth0
 * Fallback: Supabase Auth
 *
 * Environment variables should be set in .env.local:
 *
 * For Auth0 (primary):
 * - NEXT_PUBLIC_AUTH0_DOMAIN
 * - NEXT_PUBLIC_AUTH0_CLIENT_ID
 * - NEXT_PUBLIC_AUTH0_AUDIENCE
 *
 * For Supabase (fallback):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

// Supabase configuration (fallback)
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
};

// Auth0 configuration (primary)
export const auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "",
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "",
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || "https://streetbot-api",
  redirectUri: typeof window !== "undefined" ? window.location.origin : "",

  // Scopes to request (offline_access for refresh tokens)
  scope: "openid profile email offline_access",
};

export const isAuth0Configured = (): boolean => {
  return Boolean(auth0Config.domain && auth0Config.clientId);
};

/**
 * Check if any auth provider is configured.
 * Auth0 is preferred if both are configured.
 */
export const isAuthConfigured = (): boolean => {
  return isAuth0Configured() || isSupabaseConfigured();
};

/**
 * Get the active auth provider.
 */
export type AuthProvider = "supabase" | "auth0" | "none";

export const getAuthProvider = (): AuthProvider => {
  if (isAuth0Configured()) return "auth0";
  if (isSupabaseConfigured()) return "supabase";
  return "none";
};

/**
 * StreetBot permission scopes (mirrors backend Scope enum).
 */
export const Scopes = {
  // Usage scopes
  USE_SOCIAL_WORK_AGENT: "use:social_work_agent",
  USE_ALL_AGENTS: "use:all_agents",
  USE_PRO_FEATURES: "use:streetbot_pro_features",

  // Management scopes
  MANAGE_DIRECTORY: "manage:directory",
  MANAGE_JOBS: "manage:jobs",
  MANAGE_ORG_SETTINGS: "manage:org_settings",
  MANAGE_ANALYTICS: "manage:analytics",

  // User management
  READ_USERS: "read:users",
  MANAGE_USERS: "manage:users",

  // Master-level
  MANAGE_BILLING: "manage:billing",
  MANAGE_API_KEYS: "manage:api_keys",
  MANAGE_MODEL_CONFIG: "manage:model_config",
  MANAGE_SYSTEM_HEALTH: "manage:system_health",
} as const;

export type ScopeValue = (typeof Scopes)[keyof typeof Scopes];

/**
 * Feature permissions for UI gating (mirrors backend Feature enum).
 * These control access to specific product features via Auth0 roles.
 */
export const FeaturePermissions = {
  // Core features
  STREET_PROFILE: "feature:street_profile",
  NEWS: "feature:news",
  CHAT: "feature:chat",

  // Media features
  STREET_GALLERY: "feature:street_gallery",
  MEDIA_UPLOAD: "feature:media_upload",
  CREATIVES: "feature:creatives",

  // Service features
  DIRECTORY: "feature:directory",
  DIRECTORY_PRO_FILTERS: "feature:directory_pro_filters",
  JOBS: "feature:jobs",
  JOBS_POST: "feature:jobs_post",
  LEARNING: "feature:learning",

  // Social features
  MESSAGING: "feature:messaging",
  GROUPS: "feature:groups",

  // Admin features
  ADMIN_PANEL: "feature:admin_panel",
  ANALYTICS: "feature:analytics",
  USER_MANAGEMENT: "feature:user_management",
} as const;

export type FeaturePermissionValue = (typeof FeaturePermissions)[keyof typeof FeaturePermissions];
