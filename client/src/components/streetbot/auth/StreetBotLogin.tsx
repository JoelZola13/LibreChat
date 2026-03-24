import { lazy, Suspense } from 'react';
import { isStreetBot } from '~/config/appVariant';

/**
 * StreetBot-specific login page.
 *
 * Renders the AuthPopupModal full-screen (always open, no close)
 * instead of the standard LibreChat login form which has theme
 * rendering issues in the StreetBot variant.
 */
const AuthPopupModal = lazy(() => import('../shared/AuthPopupModal'));

export default function StreetBotLogin() {
  if (!isStreetBot) return null;

  return (
    <Suspense fallback={null}>
      <AuthPopupModal isOpen onClose={() => {}} initialTab="login" />
    </Suspense>
  );
}
