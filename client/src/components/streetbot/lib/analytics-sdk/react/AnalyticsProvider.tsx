// AnalyticsProvider — drop into the LibreChat client root once.
//
//   <AnalyticsProvider
//     posthogKey={import.meta.env.VITE_POSTHOG_KEY}
//     posthogHost={import.meta.env.VITE_POSTHOG_HOST}
//     collectorUrl={import.meta.env.VITE_ANALYTICS_COLLECTOR_URL}
//     appVariant={import.meta.env.VITE_APP_VARIANT}
//     environment={import.meta.env.MODE === 'production' ? 'production' : 'local'}
//   >
//     <App />
//   </AnalyticsProvider>

import * as React from 'react';
import { AnalyticsClient } from '../client';
import { buildEvents, type EventNamespaces } from '../events';
import type {
  AnalyticsClientOptions,
  ConsentState,
  IdentifyProperties,
  StreetProfileContext,
  UserRole,
} from '../types';

interface ContextValue {
  client: AnalyticsClient;
  events: EventNamespaces;
}

const AnalyticsCtx = React.createContext<ContextValue | null>(null);

export interface AnalyticsProviderProps extends AnalyticsClientOptions {
  children?: React.ReactNode;
}

export function AnalyticsProvider({ children, ...config }: AnalyticsProviderProps) {
  const ctx = React.useMemo<ContextValue>(() => {
    const client = new AnalyticsClient(config);
    return { client, events: buildEvents(client) };
  }, [
    // Re-init only on env changes — never on every render.
    config.collectorUrl,
    config.posthogKey,
    config.posthogHost,
    config.appVariant,
    config.environment,
  ]);

  React.useEffect(() => {
    ctx.client.init();
    return () => ctx.client.destroy();
  }, [ctx.client]);

  return <AnalyticsCtx.Provider value={ctx}>{children}</AnalyticsCtx.Provider>;
}

export function useAnalytics(): ContextValue {
  const ctx = React.useContext(AnalyticsCtx);
  if (!ctx) throw new Error('useAnalytics must be used inside <AnalyticsProvider>.');
  return ctx;
}

/** Bind identity once per session. Call after the auth context resolves. */
export function useBindIdentity(opts: {
  userId:       string | null;
  userRole?:    UserRole;
  properties?:  IdentifyProperties;
  consentState?: ConsentState;
}) {
  const { client } = useAnalytics();
  const { userId, userRole, properties, consentState } = opts;
  React.useEffect(() => {
    if (consentState) client.setConsent(consentState);
  }, [client, consentState]);

  React.useEffect(() => {
    if (userId) {
      client.identify(userId, properties ?? {});
      if (userRole) client.setUserRole(userRole);
    } else {
      client.reset();
    }
    // identify is idempotent — calling on mount is fine.
  }, [client, userId, userRole, properties]);
}

/** Bind the user's Street Profile context. Call when the profile is loaded. */
export function useBindStreetProfile(profile: StreetProfileContext | null) {
  const { client } = useAnalytics();
  React.useEffect(() => {
    client.setStreetProfileContext(profile);
  }, [client, profile]);
}
