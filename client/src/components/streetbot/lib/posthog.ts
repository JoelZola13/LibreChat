// Compat shim — delegates to the new analytics SDK.
// Branch: local/analytics-platform.
//
// Existing call sites import { trackEvent } from this module. The legacy
// implementation called window.posthog directly (which was never installed).
// The new SDK auto-routes through the AnalyticsProvider mounted at the
// router root, so we forward to it via the lazy accessor.

import { maybeAnalytics } from './analytics-sdk';

type Primitive = string | number | boolean | null | undefined;
type EventProperties = Record<string, Primitive>;

export function trackEvent(eventName: string, properties?: EventProperties) {
  if (typeof window === 'undefined') return;
  const a = maybeAnalytics();
  if (!a) {
    // Provider not mounted yet — defer one tick. If the provider is
    // disabled (VITE_ANALYTICS_ENABLED=false) this stays a silent no-op.
    queueMicrotask(() => maybeAnalytics()?.capture(eventName, (properties ?? {}) as Record<string, unknown>));
    return;
  }
  a.capture(eventName, (properties ?? {}) as Record<string, unknown>);
}
