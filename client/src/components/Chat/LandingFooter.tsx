import { memo, useState } from 'react';

const footerLinks = [
  { label: 'About Us', href: '/about' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];

const socialLinks = [
  {
    label: 'Facebook',
    href: 'https://facebook.com/streetvoices',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: 'Twitter',
    href: 'https://twitter.com/streetvoices',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/streetvoices',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
];

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
];

const LanguageSelector = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState('en');

  const selectedLanguage = languages.find((l) => l.code === selected)?.label || 'English';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'transparent',
          border: 'none',
          color: '#9C9DB5',
          fontSize: 13,
          fontFamily: 'Rubik, sans-serif',
          cursor: 'pointer',
          borderRadius: 6,
        }}
      >
        <span style={{ color: '#6B7280' }}>Language:</span>
        <span style={{ color: '#FFD60A' }}>{selectedLanguage}</span>
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
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            minWidth: 120,
            background: 'rgba(30, 31, 42, 0.98)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
            padding: '4px 0',
            zIndex: 1000,
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setSelected(lang.code);
                setIsOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: selected === lang.code ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none',
                color: selected === lang.code ? '#FFD60A' : '#E6E7F2',
                fontSize: 13,
                fontFamily: 'Rubik, sans-serif',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const LandingFooter = memo(() => {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        width: '100%',
        padding: '20px 24px',
        background: 'rgba(20, 21, 29, 0.98)',
        borderTop: '1px solid rgba(188, 189, 208, 0.12)',
        fontFamily: 'Rubik, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Left: Language Selector */}
        <LanguageSelector />

        {/* Center: Navigation Links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {footerLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: '#9C9DB5',
                fontSize: 13,
                fontFamily: 'Rubik, sans-serif',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E6E7F2')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9C9DB5')}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: Social Icons + Copyright */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Social Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  color: '#9C9DB5',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#E6E7F2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = '#9C9DB5';
                }}
                aria-label={social.label}
              >
                {social.icon}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <span
            style={{
              color: '#6B7280',
              fontSize: 12,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            © StreetVoices {currentYear}
          </span>
        </div>
      </div>
    </footer>
  );
});

LandingFooter.displayName = 'LandingFooter';
LanguageSelector.displayName = 'LanguageSelector';

export default LandingFooter;
