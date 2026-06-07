export type CommerceNavItem = {
  label: string;
  href: string;
};

export const PRODUCT_NAV_ITEMS: CommerceNavItem[] = [
  { label: 'Overview', href: '/products' },
  { label: 'Street Profile', href: '/products/street-profile' },
  { label: 'Street Gallery', href: '/products/street-gallery' },
  { label: 'Street Voices Academy', href: '/products/academy' },
  { label: 'Job Board', href: '/products/job-board' },
  { label: 'Directory', href: '/directory' },
  { label: 'News Platform', href: '/products/news-platform' },
];

export const PRICING_NAV_ITEMS: CommerceNavItem[] = [
  { label: 'Overview', href: '/pricing' },
  { label: 'Free', href: '/pricing/free' },
  { label: 'Plus', href: '/pricing/plus' },
  { label: 'Enterprise', href: '/pricing/enterprise' },
];
