// Public entry for @local3180/analytics-client.
// Vanilla (non-React) callers import from here. React callers should use
// `@local3180/analytics-client/react` for the provider + hooks.

export { AnalyticsClient } from './client';
export { buildEvents } from './events';
export { defaultRoutePatternResolver } from './routePatterns';
export { isSensitiveRoute } from './replayMasking';
export { classifyQuery } from './classifyQuery';
export {
  lengthBucket,
  fileSizeBucket,
  durationBucket,
  timeToReplyBucket,
  timeToCompleteBucket,
  unreadCountBucket,
  clampResultCount,
  scoreBucket,
  completenessBucket,
  rowCountBucket,
  priceBucket,
  radiusBucket,
} from './buckets';
export type {
  AnalyticsConfig,
  AnalyticsClientOptions,
  AppVariant,
  AuthState,
  CapturedEvent,
  ConsentState,
  DeviceType,
  EntryPoint,
  Environment,
  EventProperties,
  IdentifyProperties,
  ProductArea,
  StreetProfileContext,
  UserRole,
  ViewportBucket,
} from './types';

import { AnalyticsClient } from './client';
import { buildEvents, type EventNamespaces } from './events';
import type { AnalyticsClientOptions } from './types';

let _instance: (AnalyticsClient & { events: EventNamespaces }) | null = null;

/** Singleton — for app code that wants the most direct possible API.
 *  React hosts should still prefer the AnalyticsProvider + useAnalytics hook. */
export function createAnalytics(opts: AnalyticsClientOptions): AnalyticsClient & { events: EventNamespaces } {
  const client = new AnalyticsClient(opts);
  // Attach the event namespaces directly to the client for ergonomic access.
  Object.defineProperty(client, 'events', { value: buildEvents(client), enumerable: false });
  _instance = client as AnalyticsClient & { events: EventNamespaces };
  return _instance;
}

/** Lazy accessor — throws if `createAnalytics` hasn't been called yet. */
export function getAnalytics(): AnalyticsClient & { events: EventNamespaces } {
  if (!_instance) {
    throw new Error('Analytics not initialized — call createAnalytics() once at app boot.');
  }
  return _instance;
}

/** Convenience: returns the existing instance or null. Use when you might be
 *  called before init (e.g. server-rendered contexts). */
export function maybeAnalytics(): (AnalyticsClient & { events: EventNamespaces }) | null {
  return _instance;
}
