type Primitive = string | number | boolean | null | undefined;
type EventProperties = Record<string, Primitive>;

export function trackEvent(eventName: string, properties?: EventProperties) {
  if (typeof window === 'undefined') return;
  const posthog = (window as any)?.posthog;
  if (posthog?.capture) {
    posthog.capture(eventName, properties ?? {});
  }
}
