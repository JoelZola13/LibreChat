// Stub PostHog binding for the local sandbox.
// posthog-js is intentionally NOT a dependency in this build — the SDK
// dual-writes only to the first-party collector. Replace this file with the
// full version (and `npm install posthog-js`) to enable replay/funnels via
// PostHog. Until then every binding is a no-op.

import { isSensitiveRoute } from './replayMasking';

interface InitOpts {
  apiKey: string;
  apiHost?: string;
  debug?: boolean;
}

export async function ensurePostHog(_opts: InitOpts | null): Promise<null> {
  return null;
}

export function getPostHog(): null {
  return null;
}

export function postHogIdentify(_userId: string, _properties: Record<string, unknown>): void {
  // no-op
}

export function postHogReset(): void {
  // no-op
}

export function postHogCapture(_eventName: string, _props: Record<string, unknown>): void {
  // no-op
}

export function syncReplayCaptureForRoute(pathname: string): void {
  // Reference isSensitiveRoute so static analysis keeps the import. No
  // recording in the stub — nothing to start/stop.
  void isSensitiveRoute(pathname);
}

export function postHogFeatureFlags(): string[] {
  return [];
}
