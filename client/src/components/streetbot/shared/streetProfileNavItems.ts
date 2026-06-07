import type { CommerceNavItem } from './commerceNav';

export const STREET_PROFILE_NAV_ITEMS: CommerceNavItem[] = [
  { label: 'Profiles', href: '/profiles' },
  { label: 'My Profile', href: '/myprofile' },
  { label: 'Word On The Street', href: '/word-on-the-street' },
  { label: 'Groups', href: '/groups' },
  { label: 'Messages', href: '/messages' },
];

export function isStreetProfileNavActive(pathname: string) {
  return (
    pathname === '/profiles' ||
    pathname.startsWith('/profiles/') ||
    pathname === '/myprofile' ||
    pathname === '/word-on-the-street' ||
    pathname.startsWith('/word-on-the-street/') ||
    pathname === '/groups' ||
    pathname.startsWith('/groups/') ||
    pathname === '/messages' ||
    pathname.startsWith('/messages/')
  );
}
