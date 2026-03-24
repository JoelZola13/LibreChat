/**
 * Shim for next/navigation - provides React Router equivalents
 */
import { useNavigate, useLocation, useSearchParams as useSearchParamsRR } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
    prefetch: () => {}, // no-op
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

// Next.js useSearchParams returns URLSearchParams directly
// React Router returns [URLSearchParams, setSearchParams]
export function useSearchParams() {
  const [searchParams] = useSearchParamsRR();
  return searchParams;
}
