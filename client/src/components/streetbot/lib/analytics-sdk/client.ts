// AnalyticsClient — the unified facade. Replaces both posthog.ts and
// analytics.ts in the LibreChat client.
//
// Responsibilities:
//   - Identity (anonymous_id, user_id, session_id, distinct_id)
//   - Page lifecycle (page_entered / page_engagement_tick / page_exited)
//   - Click tracking (element_clicked / cta_clicked / dead / rage)
//   - Privacy filter on every outgoing event
//   - Dual write: PostHog + collector
//   - Replay capture toggling on sensitive routes
//   - Consent gating

import {
  AnalyticsClientOptions,
  AnalyticsConfig,
  AppVariant,
  AuthState,
  CapturedEvent,
  ConsentState,
  DeviceType,
  EntryPoint,
  Environment,
  EventContext,
  EventProperties,
  IdentifyProperties,
  ProductArea,
  StreetProfileContext,
  UserRole,
  ViewportBucket,
} from './types';
import { IdentityStore, createUuid } from './identity';
import { defaultRoutePatternResolver } from './routePatterns';
import { scrubProperties } from './privacy';
import { deviceTypeFromUserAgent, viewportBucket } from './buckets';
import {
  ensurePostHog,
  postHogIdentify,
  postHogReset,
  postHogCapture,
  postHogFeatureFlags,
  syncReplayCaptureForRoute,
} from './posthogBinding';
import { ClickTracker } from './clickTracker';
import { PageTracker } from './pageTracker';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_MS   = 5000;

export interface CaptureOptions {
  /** Override the auto-detected product_area for this event. */
  product_area?: ProductArea;
  /** Override the entry_point. */
  entry_point?: EntryPoint;
  /** Skip PostHog dual-write — useful for backend-mirrored events captured client-side
   *  for live tab purposes only. */
  skip_posthog?: boolean;
}

export class AnalyticsClient {
  readonly config: Required<Omit<AnalyticsConfig, 'posthogKey' | 'posthogHost' | 'appVersion' | 'defaultConsent'>> & {
    posthogKey?: string;
    posthogHost?: string;
    appVersion?: string;
    defaultConsent: ConsentState;
  };
  private identity = new IdentityStore();
  private queue: CapturedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private booted = false;

  private userRole:    UserRole = 'unknown';
  private appVersion:  string | null = null;
  private profileCtx:  StreetProfileContext | null = null;
  private currentEntryPoint: EntryPoint = 'direct_url';
  private currentRoute = { pathname: '/', route_pattern: '/', product_area: '_global' as ProductArea };
  private consent:     ConsentState;
  private debug:       boolean;
  private pageTracker: PageTracker | null = null;
  private clickTracker: ClickTracker | null = null;

  constructor(opts: AnalyticsClientOptions) {
    this.config = {
      collectorUrl:     opts.collectorUrl,
      appVariant:       opts.appVariant,
      environment:      opts.environment,
      flushIntervalMs:  opts.flushIntervalMs ?? DEFAULT_FLUSH_MS,
      batchSize:        opts.batchSize ?? DEFAULT_BATCH_SIZE,
      engagementTickMs: opts.engagementTickMs ?? 20_000,
      idleAfterMs:      opts.idleAfterMs ?? 30_000,
      debug:            opts.debug ?? false,
      posthogKey:       opts.posthogKey,
      posthogHost:      opts.posthogHost,
      appVersion:       opts.appVersion,
      defaultConsent:   opts.defaultConsent ?? 'full',
    };
    this.appVersion = opts.appVersion ?? null;
    this.consent    = this.config.defaultConsent;
    this.debug      = this.config.debug;

    this.pageTracker = new PageTracker({
      resolver:         opts.routePatternResolver ?? defaultRoutePatternResolver,
      engagementTickMs: this.config.engagementTickMs,
      idleAfterMs:      this.config.idleAfterMs,
      emit: (eventName, props) => this.captureSystem(eventName, props),
      onRouteChange: (info) => {
        this.currentRoute = info;
        if (typeof location !== 'undefined') {
          syncReplayCaptureForRoute(location.pathname + location.search);
        }
      },
      onHardExit: () => { this.flush(true); },
    });
  }

  // -- lifecycle -----------------------------------------------------------

  async init(): Promise<void> {
    if (this.booted) return;
    this.booted = true;

    if (this.config.posthogKey) {
      await ensurePostHog({
        apiKey:  this.config.posthogKey,
        apiHost: this.config.posthogHost,
        debug:   this.debug,
      });
    }

    // Open a session against the collector. If the collector is unreachable,
    // we fall back to a locally generated session_id so events still carry one.
    await this.openSession();

    this.pageTracker?.start();
    this.clickTracker = new ClickTracker(
      (name, props) => this.captureSystem(name, props),
      this.engagementForClicks(),
      {},
    );
    this.clickTracker.start();

    if (this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => this.flush(false), this.config.flushIntervalMs);
    }
  }

  destroy(): void {
    this.flush(true);
    this.pageTracker?.stop();
    this.clickTracker?.stop();
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.booted = false;
  }

  // -- identity -----------------------------------------------------------

  identify(userId: string, properties: IdentifyProperties = {}): void {
    this.identity.setUser(userId);
    if (properties.user_role) this.userRole = properties.user_role;
    postHogIdentify(userId, this.scrubForPostHog(properties));
  }

  reset(): void {
    postHogReset();
    this.identity.reset();
    this.userRole = 'unknown';
    this.profileCtx = null;
  }

  setStreetProfileContext(ctx: StreetProfileContext | null): void {
    this.profileCtx = ctx;
  }

  setEntryPoint(entry: EntryPoint): void {
    this.currentEntryPoint = entry;
  }

  setUserRole(role: UserRole): void {
    this.userRole = role;
  }

  setConsent(state: ConsentState): void {
    this.consent = state;
  }

  // -- capture ------------------------------------------------------------

  /** Capture a product event. Use the namespaced helpers in `events.ts`
   *  in real call sites — this is the lowest-level API. */
  capture(eventName: string, props: EventProperties = {}, opts: CaptureOptions = {}): void {
    if (!this.shouldCapture(eventName)) return;

    const { cleaned } = scrubProperties(props);
    const event = this.buildEvent(eventName, cleaned, opts);

    this.queue.push(event);
    if (!opts.skip_posthog) {
      postHogCapture(eventName, this.scrubForPostHog({ ...cleaned, ...event }));
    }
    if (this.queue.length >= this.config.batchSize) {
      this.flush(false);
    }
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[analytics]', eventName, event);
    }
  }

  /** System events (page_entered/exited/clicks) — same path as capture but
   *  always allowed even at consent='essential' when their privacy class
   *  permits it. */
  private captureSystem(eventName: string, props: Record<string, unknown>): void {
    if (this.consent === 'none') return;
    // page_engagement_tick is suppressed in 'essential' to keep volume low.
    if (this.consent === 'essential' && eventName === 'page_engagement_tick') return;

    const { cleaned } = scrubProperties(props as EventProperties);
    const event = this.buildEvent(eventName, cleaned, {});
    this.queue.push(event);
    postHogCapture(eventName, this.scrubForPostHog({ ...cleaned, ...event }));
    if (this.queue.length >= this.config.batchSize) this.flush(false);
  }

  private buildEvent(
    eventName: string,
    props: EventProperties,
    opts: CaptureOptions,
  ): CapturedEvent {
    const id = this.identity.snapshot();
    const productArea: ProductArea = opts.product_area ?? this.currentRoute.product_area;
    const ctx: EventContext = this.collectContext();
    return {
      event_id:           createUuid(),
      event_name:         eventName,
      product_area:       productArea,
      session_id:         id.session_id,
      distinct_id:        id.distinct_id,
      user_id:            id.user_id,
      street_profile_id:  this.profileCtx?.street_profile_id ?? null,
      route:              this.currentRoute.pathname,
      route_pattern:      this.currentRoute.route_pattern,
      page_title:         typeof document !== 'undefined' ? document.title : null,
      entry_point:        opts.entry_point ?? this.currentEntryPoint,
      auth_state:         id.user_id ? 'authenticated' : 'anonymous',
      user_role:          this.userRole,
      device_type:        this.detectDeviceType(),
      viewport_bucket:    this.detectViewportBucket(),
      environment:        this.config.environment,
      app_variant:        this.config.appVariant,
      app_version:        this.appVersion,
      feature_flags:      postHogFeatureFlags(),
      consent_state:      this.consent,
      timestamp:          new Date().toISOString(),
      properties:         { ...this.profileToFlatProps(), ...props },
      context:            ctx,
    };
  }

  private profileToFlatProps(): Record<string, unknown> {
    const p = this.profileCtx;
    if (!p) return {};
    return {
      street_profile_username:     p.street_profile_username ?? null,
      street_profile_role:         p.street_profile_role,
      street_profile_completeness: Math.round(p.street_profile_completeness * 100) / 100,
      has_avatar:    p.has_avatar,
      has_banner:    p.has_banner,
      has_portfolio: p.has_portfolio,
      has_services:  p.has_services,
      has_resume:    p.has_resume,
    };
  }

  private collectContext(): EventContext {
    if (typeof navigator === 'undefined') return {};
    const ua = navigator.userAgent ?? '';
    const ctx: EventContext = {
      user_agent_family: extractUaFamily(ua),
      os_family:         extractOsFamily(ua),
      language:          navigator.language,
    };
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const ref = new URL(document.referrer);
        ctx.referrer_route_pattern = ref.host === location.host ? ref.pathname : `external:${ref.host}`;
      } catch { /* ignore */ }
    }
    if (typeof location !== 'undefined') {
      const search = new URLSearchParams(location.search);
      const utm = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
      for (const k of utm) {
        const v = search.get(k);
        if (v) (ctx as Record<string, unknown>)[k] = v;
      }
    }
    return ctx;
  }

  private detectDeviceType(): DeviceType {
    if (typeof navigator === 'undefined') return 'desktop';
    return deviceTypeFromUserAgent(navigator.userAgent ?? '');
  }

  private detectViewportBucket(): ViewportBucket {
    if (typeof window === 'undefined') return 'lg';
    return viewportBucket(window.innerWidth);
  }

  // -- transport ----------------------------------------------------------

  async flush(sync: boolean): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    const payload = JSON.stringify({ events: batch });
    const url = `${this.config.collectorUrl.replace(/\/$/, '')}/events/batch`;
    try {
      if (sync && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }
      await fetch(url, {
        method:      'POST',
        headers:     { 'content-type': 'application/json' },
        body:        payload,
        credentials: 'include',
        keepalive:   sync,
      });
    } catch (err) {
      // Best-effort retry: requeue at the front so insertion order is preserved.
      this.queue.unshift(...batch);
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.warn('[analytics] flush failed:', err);
      }
    }
  }

  private async openSession(): Promise<void> {
    const id = this.identity.snapshot();
    if (id.session_id) return;
    const url = `${this.config.collectorUrl.replace(/\/$/, '')}/sessions`;
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body:    JSON.stringify({
          anonymous_id:     id.anonymous_id,
          user_id:          id.user_id,
          street_profile_id: this.profileCtx?.street_profile_id ?? null,
          app_variant:      this.config.appVariant,
          app_version:      this.appVersion,
          environment:      this.config.environment,
          consent_state:    this.consent,
          entry_route:      typeof location !== 'undefined' ? location.pathname : '/',
          referrer:         typeof document !== 'undefined' ? document.referrer : '',
          viewport_width:   typeof window !== 'undefined' ? window.innerWidth : 0,
          user_agent:       typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
      if (res.ok) {
        const json = await res.json() as { session_id?: string };
        if (json.session_id) {
          this.identity.setSessionId(json.session_id);
          return;
        }
      }
    } catch { /* fall through to local session */ }
    this.identity.setSessionId(createUuid());
  }

  // -- internal -----------------------------------------------------------

  private shouldCapture(_eventName: string): boolean {
    return this.consent !== 'none';
  }

  private engagementForClicks() {
    // Reach into the page tracker's engagement so click counts get recorded
    // against the current page's snapshot. The pageTracker doesn't expose
    // its engagement directly, so we proxy through a getter.
    type PTWithEng = { engagement: { recordClick: (rage: boolean) => void } };
    const pt = this.pageTracker as unknown as PTWithEng;
    return pt?.engagement ?? null;
  }

  /** PostHog event payloads are flatter than the collector's. We strip the
   *  envelope fields PostHog already tracks itself. */
  private scrubForPostHog(props: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (k === 'distinct_id' || k === 'context' || k === 'properties') continue;
      out[k] = v;
    }
    return out;
  }
}

function extractUaFamily(ua: string): string {
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

function extractOsFamily(ua: string): string {
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac OS/.test(ua)) return 'mac';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}
