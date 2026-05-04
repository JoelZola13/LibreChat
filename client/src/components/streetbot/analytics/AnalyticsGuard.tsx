// AnalyticsGuard — admin-only gate for the hidden /analytics page.
//
// Uses LibreChat's own auth context (Mongo `role: 'ADMIN'`). On a hard refresh
// the auth provider hydrates async via the refresh-token flow — `user` starts
// null and `isAuthenticated` flips to true only after that round-trip
// completes. The guard waits during that window so we don't redirect a
// genuinely-logged-in admin to /login or /home before they've hydrated.
//
// Branch: local/analytics-platform.

import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';

interface Props {
  children: React.ReactNode;
}

const FullPageSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', color: '#999' }}>
    Loading…
  </div>
);

const HYDRATION_TIMEOUT_MS = 5000;

export function AnalyticsGuard({ children }: Props) {
  const auth = useAuthContext() as {
    user?: { role?: string } | null;
    isAuthenticated?: boolean;
    token?: string | null;
  };

  // Bounded-wait for the refresh-token + user fetch round-trip on hard reload.
  const [hydrationExpired, setHydrationExpired] = React.useState(false);
  React.useEffect(() => {
    if (auth.isAuthenticated || auth.user) return; // already hydrated
    const t = setTimeout(() => setHydrationExpired(true), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [auth.isAuthenticated, auth.user]);

  // Hydrated with role available — make the call.
  if (auth.user && auth.user.role) {
    const role = auth.user.role.toString().toUpperCase();
    if (role !== 'ADMIN') return <Navigate to="/home" replace />;
    return <>{children}</>;
  }

  // Authed flag flipped but user object hasn't fully landed yet — keep waiting.
  if (auth.isAuthenticated && !auth.user) return <FullPageSpinner />;

  // Still hydrating → spinner; after timeout, accept the user is logged out.
  if (!hydrationExpired) return <FullPageSpinner />;
  return <Navigate to="/login" replace />;
}
