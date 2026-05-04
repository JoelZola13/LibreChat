// Compat shim — the new analytics SDK auto-tracks page_entered /
// page_engagement_tick / page_exited via the page tracker mounted by
// AnalyticsProvider. So this hook becomes a no-op while existing call
// sites continue to compile.
//
// Branch: local/analytics-platform.

export function useTrackPageView(_page: string): void {
  // intentional no-op — page lifecycle is handled by the SDK now.
}
