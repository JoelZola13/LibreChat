import { memo } from 'react';
import { useTheme } from '@/app/providers/theme-provider';

function SbpBackgroundOrbs() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: isDark
          ? 'radial-gradient(circle at 16% 68%, rgba(0,168,192,0.30), transparent 26%), radial-gradient(circle at 60% 22%, rgba(109,69,255,0.34), transparent 30%), radial-gradient(circle at 84% 68%, rgba(239,68,168,0.22), transparent 24%), radial-gradient(circle at 63% 84%, rgba(255,221,0,0.18), transparent 18%), #171923'
          : 'var(--sb-color-background)',
      }}
    />
  );
}

export default memo(SbpBackgroundOrbs);
