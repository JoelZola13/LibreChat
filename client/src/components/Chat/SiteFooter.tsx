import { memo, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { prefetchRoute } from '~/components/streetbot/shared/navPrefetch';

const footerLinks = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Contact Us', href: '/about' },
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];

/** Shared site-wide footer matching streetvoices.ca.
 *  Pass `position="absolute"` for overlay on landing pages,
 *  or `position="static"` (default) for normal document flow. */
function SiteFooter({ position = 'static' }: { position?: 'absolute' | 'static' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const bg = dark ? '#1A1B23' : '#ffffff';
  const border = dark ? '1px solid rgba(188, 189, 208, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)';
  const labelColor = dark ? '#9C9DB5' : '#6b7280';
  const accentColor = dark ? '#FDD30B' : '#1a1c24';
  const linkColor = dark ? '#9C9DB5' : '#6b7280';
  const linkHover = dark ? '#E6E7F2' : '#1a1c24';
  const iconBg = dark ? '#3A3C46' : '#e5e7eb';
  const iconFill = dark ? '#FFFFFF' : '#374151';
  const copyrightColor = dark ? '#BCBDD0' : '#9ca3af';
  const addListingBorder = dark ? '#FFD600' : '#1a1c24';
  const addListingColor = dark ? '#FFD600' : '#1a1c24';

  return (
    <div
      className={position === 'absolute' ? 'lg:absolute lg:bottom-0 lg:left-0 lg:right-0 z-20' : ''}
      style={{
        backgroundColor: bg,
        borderTop: border,
        marginTop: position === 'static' ? 'auto' : undefined,
      }}
    >
      <div
        className="flex flex-col items-center justify-between gap-3 px-[15px] py-[10px] lg:flex-row lg:gap-0 lg:px-4 lg:py-3"
      >
        {/* Language — far left */}
        <div className="flex items-center gap-2">
          <span
            style={{
              color: labelColor,
              fontSize: 14,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            Language:
          </span>
          <a
            href="#"
            style={{
              color: accentColor,
              fontSize: 14,
              fontFamily: 'Rubik, sans-serif',
              textDecoration: 'none',
            }}
          >
            English
          </a>
        </div>

        {/* Center group: nav + social + add listing */}
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-4">
          <nav className="flex flex-wrap items-center justify-center gap-3 lg:flex-nowrap lg:justify-start lg:gap-4">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  color: linkColor,
                  fontSize: 14,
                  fontFamily: 'Rubik, sans-serif',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = linkHover;
                  prefetchRoute(link.href);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = linkColor;
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/StreetVoicesTO/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
              style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: iconBg }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={iconFill}>
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a
              href="https://twitter.com/StreetVoicesTO"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
              style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: iconBg }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={iconFill}>
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/streetvoicesto/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center"
              style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: iconBg }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconFill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>

          {/* + Add listing */}
          <button
            onClick={() =>
              navigate(`/directory/add?returnTo=${encodeURIComponent(currentPath)}`, {
                state: { returnTo: currentPath },
              })
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 16px',
              borderRadius: 9999,
              border: `1px solid ${addListingBorder}`,
              background: 'transparent',
              color: addListingColor,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
            }}
          >
            + Add listing
          </button>
        </div>

        {/* Copyright — far right */}
        <span
          style={{
            color: copyrightColor,
            fontSize: 14,
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          © StreetVoices {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}

export default memo(SiteFooter);
