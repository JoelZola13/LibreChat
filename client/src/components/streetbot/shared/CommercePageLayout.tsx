import type { ReactNode } from 'react';
import HomepageTopNav from '~/components/Chat/HomepageTopNav';

export function UnifiedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <HomepageTopNav />
      {children}
    </div>
  );
}
