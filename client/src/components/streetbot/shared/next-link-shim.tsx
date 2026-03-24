/**
 * Shim for next/link - provides React Router Link equivalent
 */
import { Link as RouterLink } from 'react-router-dom';
import React from 'react';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  [key: string]: unknown;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, prefetch, scroll, ...props }, ref) => {
    return (
      <RouterLink to={href} ref={ref} {...props}>
        {children}
      </RouterLink>
    );
  }
);

Link.displayName = 'Link';

export default Link;
