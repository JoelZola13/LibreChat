import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const LISTMONK_ORIGIN = import.meta.env.VITE_LISTMONK_ADMIN_ORIGIN || 'http://localhost:9001';

const emailRouteToListmonkPath: Record<string, string> = {
  '': '/admin',
  dashboard: '/admin',
  analytics: '/admin/campaigns',
  campaigns: '/admin/campaigns',
  lists: '/admin/lists',
  subscribers: '/admin/subscribers',
  templates: '/admin/templates',
  users: '/admin/users',
  settings: '/admin/settings',
};

function buildListmonkSrc(pathname: string, search: string, hash: string) {
  const suffix = pathname.replace(/^\/email\/?/, '').replace(/^\/+/, '');
  const [section, ...rest] = suffix.split('/').filter(Boolean);
  const basePath = emailRouteToListmonkPath[section ?? ''] ?? `/admin/${suffix}`;
  const nestedPath = rest.length > 0 && emailRouteToListmonkPath[section ?? '']
    ? `${basePath.replace(/\/$/, '')}/${rest.join('/')}`
    : basePath;

  return `${LISTMONK_ORIGIN}${nestedPath}${search}${hash}`;
}

export default function EmailPage() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const iframeSrc = useMemo(
    () => buildListmonkSrc(location.pathname, location.search, location.hash),
    [location.hash, location.pathname, location.search],
  );

  return (
    <main
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            display: 'grid',
            placeItems: 'center',
            background: '#ffffff',
            color: '#111827',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Loading Email...
        </div>
      )}
      <iframe
        src={iframeSrc}
        title="Email"
        onLoad={() => setIsLoading(false)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: '#ffffff',
        }}
      />
    </main>
  );
}
