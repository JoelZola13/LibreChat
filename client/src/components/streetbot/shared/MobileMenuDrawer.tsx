import { memo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../app/providers/theme-provider';

interface MobileMenuDrawerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenuDrawer = memo(({ children, isOpen, onClose }: MobileMenuDrawerProps) => {
  const { theme } = useTheme();
  const dark = theme !== 'light';

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 300,
          zIndex: 9999,
          background: dark
            ? 'rgba(20, 21, 29, 0.98)'
            : 'rgba(255, 255, 255, 0.97)',
          borderLeft: dark
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(0,0,0,0.06)',
          boxShadow: dark
            ? '-8px 0 32px rgba(0,0,0,0.4)'
            : '-4px 0 24px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          overflowY: 'auto',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 16px 8px' }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              color: dark ? '#E6E7F2' : '#374151',
              transition: 'background 0.15s',
            }}
            aria-label="Close menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 32px' }}>{children}</div>
      </div>
    </>,
    document.body,
  );
});

MobileMenuDrawer.displayName = 'MobileMenuDrawer';

export default MobileMenuDrawer;

/* ── Theme-aware style getters ── */

export const getMobileNavLinkStyle = (dark: boolean): React.CSSProperties => ({
  display: 'block',
  padding: '14px 0',
  color: dark ? '#E6E7F2' : '#1f2937',
  fontSize: 16,
  fontWeight: 500,
  fontFamily: 'Rubik, sans-serif',
  textDecoration: 'none',
  borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
  letterSpacing: '0.01em',
});

export const getMobileDividerStyle = (dark: boolean): React.CSSProperties => ({
  height: 1,
  background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  margin: '20px 0',
});

export const getMobileSectionHeaderStyle = (dark: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginTop: 20,
  marginBottom: 8,
});

/* Hamburger icon button (36x36, matches existing icon buttons) */
export const HamburgerButton = memo(({ onClick, dark = true }: { onClick: () => void; dark?: boolean }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      background: 'transparent',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      color: dark ? '#E6E7F2' : '#374151',
      transition: 'background 0.15s',
    }}
    aria-label="Open menu"
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  </button>
));

HamburgerButton.displayName = 'HamburgerButton';
