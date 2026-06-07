import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { CommerceNavItem } from './commerceNav';

type NavDropdownProps = {
  label: string;
  items: CommerceNavItem[];
  href?: string;
  textColor?: string;
  fontSize?: number | string;
  buttonStyle?: CSSProperties;
  menuMinWidth?: number;
  onItemHover?: (href: string) => void;
};

export default function NavDropdown({
  label,
  items,
  href,
  textColor = '#FFFFFF',
  fontSize = 14,
  buttonStyle,
  menuMinWidth = 200,
  onItemHover,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerStyle: CSSProperties = {
    color: textColor,
    fontSize,
    fontFamily: 'Rubik, sans-serif',
    fontWeight: 400,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    ...buttonStyle,
  };

  return (
    <div
      translate="no"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', zIndex: 1300 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {href ? (
        <Link to={href} aria-haspopup="menu" aria-expanded={open} translate="no" style={triggerStyle}>
          {label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Link>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          translate="no"
          onClick={() => setOpen((value) => !value)}
          style={triggerStyle}
        >
          {label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {open && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              height: 8,
              zIndex: 1300,
            }}
          />
          <div
            role="menu"
            translate="no"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              background: '#1e2027',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              border: '1px solid #3A3C46',
              minWidth: menuMinWidth,
              overflow: 'hidden',
              zIndex: 1300,
            }}
          >
            {items.map((item) => {
              const itemStyle: CSSProperties = {
                display: 'block',
                padding: '12px 16px',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: 14,
                fontFamily: 'Rubik, sans-serif',
                transition: 'background 0.2s ease',
                whiteSpace: 'nowrap',
              };

              return item.href.startsWith('http') ? (
                <a
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  translate="no"
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => onItemHover?.(item.href)}
                  style={itemStyle}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  role="menuitem"
                  translate="no"
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => onItemHover?.(item.href)}
                  style={itemStyle}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
