import SiteFooter from '~/components/Chat/SiteFooter';
import { useCallback, useContext, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { Home } from 'lucide-react';
import NavDropdown from '../shared/NavDropdown';
import MobileMenuDrawer, {
  HamburgerButton,
  getMobileDividerStyle,
  getMobileNavLinkStyle,
  getMobileSectionHeaderStyle,
} from '../shared/MobileMenuDrawer';
import NotificationDropdown from '../notifications/NotificationDropdown';
import TopRightAccountMenu from '../shared/TopRightAccountMenu';
import { PRODUCT_NAV_ITEMS, PRICING_NAV_ITEMS } from '../shared/commerceNav';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useActiveUser } from '../shared/useActiveUser';
import { STREET_PROFILE_NAV_ITEMS } from '../shared/streetProfileNavItems';

type OutletContext = { navVisible?: boolean };

function AboutTopNav({ isMobile }: { isMobile: boolean }) {
  const { isDark } = useGlassStyles();
  const { activeUser } = useActiveUser();
  const { navVisible } = useOutletContext<OutletContext>() ?? { navVisible: false };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useContext(ThemeContext);
  const toggleTheme = useCallback(() => {
    setTheme(checkDark(theme) ? 'light' : 'dark');
  }, [setTheme, theme]);

  const sidebarMinimized =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('sidebarMinimized') ?? 'false')
      : false;
  const navLeft = isMobile ? 0 : navVisible ? (sidebarMinimized ? 80 : 260) : 0;
  const navTextColor = isDark ? '#F6F7FB' : '#171923';
  const topNavLinks = [
    { label: 'Street Gallery', href: '/gallery' },
    { label: 'Academy', href: '/academy' },
    { label: 'Job Board', href: '/jobs' },
    { label: 'Directory', href: '/directory' },
    { label: 'News', href: '/news' },
    { label: 'About Us', href: '/about' },
  ];
  const mobileMainMenuItems = STREET_PROFILE_NAV_ITEMS.filter((item) => item.href !== '/myprofile');

  if (isMobile) {
    return null;
  }

  return (
    <>
      {isMobile && (
        <style>{`
          .sv-about-mobile-theme-toggle {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        `}</style>
      )}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: navLeft,
          right: 0,
          zIndex: 80,
          height: isMobile ? 60 : 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-end' : 'space-between',
          gap: isMobile ? 8 : 18,
          padding: isMobile ? '0 10px' : '0 20px',
          background: isDark ? 'rgba(15, 16, 28, 0.92)' : 'rgba(255, 255, 255, 0.92)',
          borderBottom: isDark
            ? '1px solid rgba(255, 255, 255, 0.10)'
            : '1px solid rgba(17, 24, 39, 0.10)',
          backdropFilter: 'blur(22px) saturate(165%)',
          WebkitBackdropFilter: 'blur(22px) saturate(165%)',
          boxShadow: isDark
            ? '0 12px 34px rgba(0,0,0,0.16)'
            : '0 12px 26px rgba(17,24,39,0.08)',
          transition: 'left 0.2s ease-out',
        }}
      >
        <Link
          to="/home"
          aria-label="Street Voices home"
          style={{
            display: isMobile ? 'none' : 'inline-flex',
            color: '#FFD600',
            fontFamily: 'Rubik, sans-serif',
            fontSize: 18,
            fontWeight: 900,
            textDecoration: 'none',
            letterSpacing: 0,
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          STREET VOICES
          <sup style={{ fontSize: 8, marginLeft: 1, verticalAlign: 'super' }}>&trade;</sup>
        </Link>

      {!isMobile && (
        <nav
          aria-label="About page navigation"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            minWidth: 0,
            flex: '1 1 auto',
          }}
        >
          <NavDropdown
            label="Street Profile"
            href="/profiles"
            items={STREET_PROFILE_NAV_ITEMS}
            textColor={navTextColor}
            fontSize={14}
            buttonStyle={{ padding: '8px 0', fontWeight: 800 }}
            menuMinWidth={170}
          />
          {topNavLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              style={{
                color: item.href === '/about' ? (isDark ? '#FFFFFF' : '#111318') : navTextColor,
                fontFamily: 'Rubik, sans-serif',
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                padding: '8px 0',
              }}
            >
              {item.label}
            </Link>
          ))}
          <NavDropdown
            label="Products"
            href="/products"
            items={PRODUCT_NAV_ITEMS}
            textColor={navTextColor}
            fontSize={14}
            buttonStyle={{ padding: '8px 0', fontWeight: 800 }}
            menuMinWidth={200}
          />
          <NavDropdown
            label="Pricing"
            href="/pricing"
            items={PRICING_NAV_ITEMS}
            textColor={navTextColor}
            fontSize={14}
            buttonStyle={{ padding: '8px 0', fontWeight: 800 }}
            menuMinWidth={160}
          />
        </nav>
      )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: isMobile ? 8 : 8,
            flex: '0 0 auto',
            marginLeft: isMobile ? 'auto' : undefined,
            height: isMobile ? 36 : undefined,
          }}
        >
          <Link
            to="/home"
            aria-label="Go to home"
            title="Go to home"
            style={{
              display: isMobile ? 'none' : 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 12,
              border: isDark
                ? '1px solid rgba(255,255,255,0.16)'
                : '1px solid rgba(17,24,39,0.12)',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
              color: isDark ? '#E6E7F2' : '#374151',
              textDecoration: 'none',
              boxShadow: isDark
                ? '0 8px 24px rgba(0,0,0,0.16)'
                : '0 8px 20px rgba(17,24,39,0.08)',
            }}
          >
            <Home size={18} strokeWidth={2} />
          </Link>
          {activeUser && <NotificationDropdown dark={isDark} userId={activeUser.id} />}
          {isMobile && (
            <button
              type="button"
              className="sv-theme-toggle-button sv-about-mobile-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                border: 0,
                borderRadius: 8,
                background: 'transparent',
                color: isDark ? '#E6E7F2' : '#374151',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {checkDark(theme) ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          )}
          <Link
            to="/donate"
            className="sv-donate-nav-label"
            style={{
              display: isMobile ? 'none' : 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 38,
              padding: '0 18px',
              borderRadius: 999,
              border: isDark
                ? '2px solid rgba(255,255,255,0.16)'
                : '2px solid rgba(17,24,39,0.14)',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(229,231,235,0.96)',
              color: isDark ? '#fff' : '#111827',
              fontFamily: 'Rubik, sans-serif',
              fontSize: 14,
              fontWeight: 900,
              lineHeight: 1,
              textDecoration: 'none',
            }}
          >
            Donate
          </Link>
          <TopRightAccountMenu dark={isDark} size={28} />
          {isMobile && (
            <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={isDark} />
          )}
        </div>
      </header>

      {isMobile && (
        <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
          <Link
            to="/donate"
            className="sv-donate-nav-label"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 12,
              background: '#FFD600',
              border: '1px solid #FFD600',
              color: '#000',
              fontFamily: 'Rubik, sans-serif',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            Donate
          </Link>

          <div style={getMobileDividerStyle(isDark)} />

          {activeUser && (
            <a
              href="/myprofile"
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              My Profile
            </a>
          )}
          {activeUser && (
            <Link
              to="/notifications"
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              Notifications
            </Link>
          )}

          <div style={getMobileSectionHeaderStyle(isDark)}>Main Menu</div>
          {mobileMainMenuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              {item.label}
            </Link>
          ))}
          {topNavLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/products"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              ...getMobileSectionHeaderStyle(isDark),
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Products
          </Link>
          {PRODUCT_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              ...getMobileSectionHeaderStyle(isDark),
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Pricing
          </Link>
          {PRICING_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={getMobileNavLinkStyle(isDark)}
            >
              {item.label}
            </Link>
          ))}
        </MobileMenuDrawer>
      )}
    </>
  );
}

export default function AboutPage() {
  const { isMobile, isTablet } = useResponsive();
  const { isDark, colors } = useGlassStyles();

  const accentColor = isDark ? '#FDD30B' : '#6B5A00';

  const sectionStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: isMobile ? '24px 18px' : '32px 36px',
    background: colors.cardBg,
    marginBottom: 28,
  };

  const h2 = {
    fontSize: isMobile ? 22 : 28,
    fontWeight: 700 as const,
    margin: '0 0 16px',
    color: colors.text,
    fontFamily: 'Rubik, sans-serif',
  };

  const pStyle = {
    opacity: 0.82,
    fontSize: 16,
    lineHeight: 1.7,
    margin: '0 0 14px',
    fontFamily: 'Rubik, sans-serif',
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}
    >
      <AboutTopNav isMobile={isMobile || isTablet} />
      <main
        style={{
          flex: 1,
          maxWidth: 980,
          margin: '0 auto',
          width: '100%',
          padding: isMobile ? '80px 16px 40px' : isTablet ? '90px 20px 40px' : '110px 20px 40px',
          color: colors.text,
        }}
      >
        {/* Header */}
        <h1
          style={{
            fontSize: isMobile ? 30 : isTablet ? 36 : 42,
            fontWeight: 700,
            margin: '0 0 12px',
            textAlign: 'center',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          About Street Voices
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: accentColor,
            fontSize: isMobile ? 16 : 18,
            margin: '0 0 40px',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Empowering marginalized voices through media, community, and connection.
        </p>

        {/* Our Story */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Story</h2>
          <p style={pStyle}>
            Street Voices was founded by Joel Zola in 2014 as a quarterly magazine created while
            experiencing homelessness in Toronto&apos;s shelter system. He felt like he didn&apos;t
            have a voice &mdash; so he created his own platform.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            While navigating homelessness, Joel published five issues of the Street Voices magazine,
            giving a platform to those whose stories are too often ignored. What began as a print
            publication has since evolved into a digital platform encompassing journalism, podcasts,
            visual content, and community resources.
          </p>
        </div>

        {/* Our Mission */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Mission</h2>
          <p style={pStyle}>
            Street Voices is a Black-led non-profit organization dedicated to empowering
            street-involved and at-risk Black youth. Through media, mentorship, and technology, we
            work to uplift communities that have been historically underserved.
          </p>
          <p style={pStyle}>
            In November 2021, we launched the Street Voices Directory &mdash; a comprehensive
            resource listing free and subsidized services across the Greater Toronto Area. The
            directory helps community members find shelters, health services, food programs, legal
            aid, employment support, and more.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We also provide media training workshops for Black youth, equipping the next generation
            with the skills to tell their own stories and amplify their voices.
          </p>
        </div>

        {/* Quote */}
        <div
          style={{
            borderLeft: `4px solid ${accentColor}`,
            padding: isMobile ? '20px 18px' : '24px 32px',
            marginBottom: 28,
            background: isDark ? 'rgba(253,211,11,0.04)' : 'rgba(253,211,11,0.06)',
            borderRadius: '0 12px 12px 0',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? 18 : 22,
              fontStyle: 'italic',
              color: colors.text,
              margin: '0 0 8px',
              lineHeight: 1.6,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            &ldquo;To have a platform where people are listening&hellip; it means everything.&rdquo;
          </p>
          <span
            style={{
              color: accentColor,
              fontSize: 15,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            &mdash; Joel Zola, Founder
          </span>
        </div>

        {/* Our Goal */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Goal</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Our ultimate goal is to uplift and empower marginalized voices, irrespective of
            background. We are actively working to expand the Street Voices Directory across Canada,
            making essential services accessible to anyone who needs them.
          </p>
        </div>

        {/* Contact Us */}
        <div style={sectionStyle}>
          <h2 style={h2}>Contact Us</h2>
          <p style={pStyle}>720 Bathurst St, Toronto, ON M5R 2S4</p>
          <p style={pStyle}>
            <a href="tel:14166976626" style={{ color: accentColor, textDecoration: 'none' }}>
              1-416-697-6626
            </a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            <a
              href="mailto:admin@streetvoices.ca"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              admin@streetvoices.ca
            </a>
          </p>
        </div>

        {/* Our Supporters */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Supporters</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices is made possible through the generous support of our community partners
            and funders. If you are interested in supporting our mission, please reach out at{' '}
            <a
              href="mailto:admin@streetvoices.ca"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              admin@streetvoices.ca
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
