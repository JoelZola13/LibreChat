import { useEffect } from 'react';
import { trackEvent } from './posthog';

export function useTrackPageView(page: string) {
  useEffect(() => {
    trackEvent('page_view', { page });
  }, [page]);
}
