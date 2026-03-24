import { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuthContext } from '~/hooks';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import { useResponsive } from '~/components/streetbot/hooks/useResponsive';
import { useTheme, isDarkTheme } from '~/components/streetbot/shared/theme-provider';
import { prefetchRoute } from '~/components/streetbot/shared/navPrefetch';
import MobileMenuDrawer, { getMobileNavLinkStyle, getMobileSectionHeaderStyle, getMobileDividerStyle, HamburgerButton } from '~/components/streetbot/shared/MobileMenuDrawer';

// Navigation items matching StreetBot Pro — navKey maps to ROLE_PAGES keys
const navItems = [
  { label: 'Street Profile', href: '/profile', navKey: 'profile' },
  { label: 'Street Gallery', href: '/gallery', navKey: 'gallery' },
  { label: 'Job Board', href: '/jobs', navKey: 'jobs' },
  { label: 'Academy', href: '/learning', navKey: 'learning' },
  { label: 'Directory', href: '/directory', navKey: 'directory' },
  { label: 'News', href: '/news', navKey: 'news' },
];

const productsDropdown = [
  { label: 'Street Voices', href: '/', navKey: null },
  { label: 'Word on the Street', href: '/forum', navKey: 'forum' },
  { label: 'Groups', href: '/groups', navKey: 'groups' },
  { label: 'Messages', href: '/messages', navKey: 'messages' },
  { label: 'Calendar', href: '/calendar', navKey: 'calendar' },
];

const pricingDropdown = [
  { label: 'Free Tier', href: '/pricing/free' },
  { label: 'Pro Plan', href: '/pricing/pro' },
  { label: 'Enterprise', href: '/pricing/enterprise' },
];

const DropdownMenu = memo(({
  label,
  items,
  isOpen,
  onToggle,
}: {
  label: string;
  items: { label: string; href: string }[];
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          color: '#E6E7F2',
          fontSize: 14,
          fontFamily: 'Rubik, sans-serif',
          cursor: 'pointer',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 180,
            background: 'rgba(30, 31, 42, 0.98)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '8px 0',
            zIndex: 1000,
          }}
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '10px 16px',
                color: '#E6E7F2',
                fontSize: 14,
                fontFamily: 'Rubik, sans-serif',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; prefetchRoute(item.href); }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
});

const ThemeToggle = memo(() => {
  return (
    <button
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
        color: '#E6E7F2',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      aria-label="Toggle theme"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    </button>
  );
});

const ProfileButton = memo(() => {
  const { user } = useAuthContext();

  return (
    <a
      href="/settings"
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
        color: '#E6E7F2',
        transition: 'background 0.15s',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      aria-label="Profile"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </a>
  );
});

const TopNav = memo(() => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { canAccess } = useUserRole();
  const visibleNavItems = useMemo(() => navItems.filter(item => canAccess(item.navKey)), [canAccess]);
  const visibleProducts = useMemo(() => productsDropdown.filter(item => item.navKey === null || canAccess(item.navKey)), [canAccess]);
  const { isMobile, isTablet } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const dark = isDarkTheme(theme);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 24px',
        height: 56,
        background: 'rgba(20, 21, 29, 0.98)',
        borderBottom: '1px solid rgba(188, 189, 208, 0.12)',
        fontFamily: 'Rubik, sans-serif',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img
            src="/images/streetbot/megaphone-icon.svg"
            alt="Street Voices"
            width={32}
            height={32}
            style={{ width: 32, height: 32 }}
          />
          <span
            style={{
              color: '#FFD60A',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            STREET VOICES<sup style={{ fontSize: 10, verticalAlign: 'super', marginLeft: 2 }}>TM</sup>
          </span>
        </a>
      </div>

      {!isMobile && !isTablet ? (
        <>
          {/* Main Navigation */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {visibleNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  padding: '8px 12px',
                  color: '#E6E7F2',
                  fontSize: 14,
                  fontFamily: 'Rubik, sans-serif',
                  textDecoration: 'none',
                  borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; prefetchRoute(item.href); }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </a>
            ))}

            {visibleProducts.length > 0 && <DropdownMenu
              label="Products"
              items={visibleProducts}
              isOpen={openDropdown === 'products'}
              onToggle={() => setOpenDropdown(openDropdown === 'products' ? null : 'products')}
            />}

            <DropdownMenu
              label="Pricing"
              items={pricingDropdown}
              isOpen={openDropdown === 'pricing'}
              onToggle={() => setOpenDropdown(openDropdown === 'pricing' ? null : 'pricing')}
            />
          </nav>

          {/* Right side actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href="/donate"
              style={{
                padding: '8px 16px',
                color: '#FFD60A',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'Rubik, sans-serif',
                textDecoration: 'none',
                borderRadius: 8,
                border: '1px solid #FFD60A',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FFD60A';
                e.currentTarget.style.color = '#14151D';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#FFD60A';
              }}
            >
              Donate
            </a>
            <ThemeToggle />
            <ProfileButton />
          </div>
        </>
      ) : (
        <>
          <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
          <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
            {/* Nav items */}
            {visibleNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={getMobileNavLinkStyle(dark)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}

            {/* Products section */}
            {visibleProducts.length > 0 && (
              <>
                <div style={getMobileSectionHeaderStyle(dark)}>Products</div>
                {visibleProducts.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    style={getMobileNavLinkStyle(dark)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
              </>
            )}

            {/* Pricing section */}
            <div style={getMobileSectionHeaderStyle(dark)}>Pricing</div>
            {pricingDropdown.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={getMobileNavLinkStyle(dark)}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}

            {/* Divider */}
            <div style={getMobileDividerStyle(dark)} />

            {/* Donate button (full width) */}
            <a
              href="/donate"
              style={{
                display: 'block',
                padding: '12px 16px',
                color: dark ? '#FFD60A' : '#000',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'Rubik, sans-serif',
                textDecoration: 'none',
                textAlign: 'center',
                borderRadius: 10,
                background: dark ? 'transparent' : '#FFD600',
                border: dark ? '1px solid #FFD60A' : '1px solid #FFD600',
                transition: 'all 0.15s',
                marginBottom: 16,
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Donate
            </a>

            {/* Theme toggle + Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <ThemeToggle />
              <ProfileButton />
            </div>
          </MobileMenuDrawer>
        </>
      )}
    </header>
  );
});

TopNav.displayName = 'TopNav';
DropdownMenu.displayName = 'DropdownMenu';
ThemeToggle.displayName = 'ThemeToggle';
ProfileButton.displayName = 'ProfileButton';

export default TopNav;
