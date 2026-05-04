// Public types for the Local 3180 analytics client.

export type AppVariant   = 'streetbot' | 'directory';
export type Environment  = 'local' | 'staging' | 'production';
export type ConsentState = 'full' | 'essential' | 'none';
export type AuthState    = 'anonymous' | 'authenticated';
export type DeviceType   = 'desktop' | 'tablet' | 'mobile';
export type ViewportBucket = 'sm' | 'md' | 'lg' | 'xl';

export type UserRole =
  | 'admin'
  | 'designer'
  | 'media'
  | 'service_user'
  | 'user'
  | 'unknown';

export type ProductArea =
  | 'street_profile'
  | 'home'
  | 'ai'
  | 'directory'
  | 'gallery'
  | 'jobs'
  | 'academy'
  | 'messages'
  | 'groups'
  | 'tasks'
  | 'calendar'
  | 'documents'
  | 'case_management'
  | 'news'
  | 'social_media'
  | 'storage'
  | 'data'
  | 'grantwriter'
  | 'agents'
  | 'admin'
  | 'platform'
  | 'auth'
  | '_global';

export type EntryPoint =
  | 'home_card'
  | 'sidebar'
  | 'direct_url'
  | 'notification'
  | 'search'
  | 'profile'
  | 'chat'
  | 'deep_link'
  | 'unknown';

export type StreetProfileRole =
  | 'artist'
  | 'job_seeker'
  | 'learner'
  | 'provider'
  | 'employer'
  | 'staff'
  | 'admin'
  | 'service_user'
  | 'unknown';

export interface StreetProfileContext {
  street_profile_id: string;
  street_profile_username?: string | null;
  street_profile_role: StreetProfileRole;
  street_profile_completeness: number; // 0..1
  has_avatar: boolean;
  has_banner: boolean;
  has_portfolio: boolean;
  has_services: boolean;
  has_resume: boolean;
  is_profile_owner?: boolean;
}

export interface IdentifyProperties {
  user_role?: UserRole;
  street_profile_id?: string;
  created_at?: string;
  first_activated_product_area?: ProductArea;
  analytics_opt_in?: boolean;
}

export interface AnalyticsConfig {
  posthogKey?: string;
  posthogHost?: string;
  collectorUrl: string;          // e.g. http://localhost:18790/api/analytics
  appVariant: AppVariant;
  appVersion?: string;
  environment: Environment;
  defaultConsent?: ConsentState; // 'essential' for unauthenticated
  flushIntervalMs?: number;      // default 5000
  batchSize?: number;            // default 20
  engagementTickMs?: number;     // default 20000
  idleAfterMs?: number;          // default 30000
  debug?: boolean;
}

export type EventProperties = Record<string, unknown>;

export interface CapturedEvent {
  event_id:           string;
  event_name:         string;
  product_area:       ProductArea;
  session_id:         string | null;
  distinct_id:        string;
  user_id:            string | null;
  street_profile_id:  string | null;
  route:              string;
  route_pattern:      string;
  page_title:         string | null;
  entry_point:        EntryPoint;
  auth_state:         AuthState;
  user_role:          UserRole;
  device_type:        DeviceType;
  viewport_bucket:    ViewportBucket;
  environment:        Environment;
  app_variant:        AppVariant;
  app_version:        string | null;
  feature_flags:      string[];
  consent_state:      ConsentState;
  timestamp:          string;
  properties:         EventProperties;
  context:            EventContext;
}

export interface EventContext {
  user_agent_family?:    string;
  os_family?:            string;
  referrer_route_pattern?: string;
  utm_source?:           string;
  utm_medium?:           string;
  utm_campaign?:         string;
  language?:             string;
  is_returning_session?: boolean;
}

export interface RoutePatternResolver {
  /** Convert the current `location.pathname` into a stable pattern.
   *  E.g. `/creatives/joelm` → `/creatives/:username`. */
  (pathname: string): { route_pattern: string; product_area: ProductArea };
}

export interface AnalyticsClientOptions extends AnalyticsConfig {
  routePatternResolver?: RoutePatternResolver;
}
