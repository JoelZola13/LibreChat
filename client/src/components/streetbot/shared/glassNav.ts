import type { CSSProperties } from 'react';

export function getGlassNavBarStyle(dark: boolean): CSSProperties {
  return {
    background: dark ? 'rgba(15, 16, 28, 0.66)' : 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    borderBottom: dark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(17, 24, 39, 0.10)',
    boxShadow: dark ? '0 18px 42px rgba(0, 0, 0, 0.22)' : '0 18px 34px rgba(17, 24, 39, 0.08)',
  };
}

export function getGlassNavPillStyle(dark: boolean): CSSProperties {
  return {
    background: dark ? 'rgba(15, 16, 28, 0.58)' : 'rgba(255, 255, 255, 0.70)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    border: dark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(17, 24, 39, 0.10)',
    boxShadow: dark ? '0 14px 34px rgba(0, 0, 0, 0.22)' : '0 14px 28px rgba(17, 24, 39, 0.08)',
  };
}

export function getSeamlessNavBarStyle(dark: boolean, isScrolled: boolean): CSSProperties {
  if (isScrolled) {
    return getGlassNavBarStyle(dark);
  }

  return {
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    borderBottom: '1px solid transparent',
    boxShadow: 'none',
  };
}
