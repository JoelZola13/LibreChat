import React from 'react';
import type { CSSProperties } from 'react';

interface Props {
  palette: Record<string, string>;
  isDark: boolean;
  isMobile: boolean;
  cardStyle: CSSProperties;
  buttonStyle: CSSProperties;
  navigate: (path: string) => void;
  userId: string;
}

/**
 * Full Tasks embed — loads the Mission Control dashboard in an iframe.
 */
export default function TasksSummary({ isDark, isMobile }: Props) {
  const theme = isDark ? 'dark' : 'light';
  const src = `/STR/dashboard?embed=true&theme=${theme}`;

  return (
    <div
      style={{
        width: '100%',
        height: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 180px)',
        borderRadius: 12,
        overflow: 'hidden',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <iframe
        src={src}
        title="Tasks"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: isDark ? '#171717' : '#ffffff',
        }}
      />
    </div>
  );
}
