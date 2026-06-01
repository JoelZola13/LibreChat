import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

function designerFrameSrc(pathname: string, search: string, hash: string) {
  const nested = pathname.replace(/^\/designer\/?/, '');
  const framePath = nested ? `/designer-app/${nested}` : '/designer-app/';
  return `${framePath}${search}${hash}`;
}

export default function DesignerPage() {
  const { pathname, search, hash } = useLocation();
  const src = useMemo(() => designerFrameSrc(pathname, search, hash), [hash, pathname, search]);

  return (
    <div className="flex h-full min-h-0 w-full bg-surface-primary">
      <iframe
        title="Designer"
        src={src}
        className="h-full min-h-0 w-full flex-1 border-0 bg-surface-primary"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
