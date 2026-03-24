import { Link, useLocation, useParams } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';
import { getReturnLabel, resolveReturnPath } from './returnNavigation';

export default function EditListingPage() {
  const { serviceId } = useParams();
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();
  const { isDark, colors } = useGlassStyles();

  const locationState = location.state as { returnTo?: string } | null;
  const backLinkTarget = resolveReturnPath(
    locationState?.returnTo ?? null,
    new URLSearchParams(location.search).get('returnTo'),
  );
  const backLinkLabel = getReturnLabel(backLinkTarget);

  return (
    <main style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: isMobile ? '80px 16px 40px' : isTablet ? '90px 20px 40px' : '110px 20px 40px',
      color: colors.text,
    }}>
      <h1 style={{
        fontSize: isMobile ? 28 : isTablet ? 32 : 36,
        margin: '0 0 12px',
        fontFamily: 'Rubik, sans-serif',
      }}>
        Edit Listing
      </h1>
      <p style={{ color: colors.textSecondary, marginBottom: 18 }}>
        Editing for listing <strong>{serviceId ?? 'unknown'}</strong> is temporarily unavailable in this local environment.
      </p>
      <Link to={backLinkTarget} style={{ color: isDark ? '#f9d900' : '#b8960a', fontWeight: 600 }}>
        {backLinkLabel}
      </Link>
    </main>
  );
}
