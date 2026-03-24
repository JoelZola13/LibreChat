/**
 * App Variant System
 *
 * Controls which product version is running:
 * - "streetbot" (default) — Full AI chatbot platform
 * - "directory" — Service directory portal (Street Voices)
 *
 * Set via VITE_APP_VARIANT env var.
 */

export type AppVariant = 'streetbot' | 'directory';

export const APP_VARIANT: AppVariant =
  (import.meta.env.VITE_APP_VARIANT as AppVariant) || 'streetbot';

export const isDirectory = APP_VARIANT === 'directory';
export const isStreetBot = APP_VARIANT === 'streetbot';

interface LandingLogo {
  darkIcon: string;
  lightIcon: string;
  darkText: string;
  lightText: string;
  alt: string;
  iconWidth: number;
  textWidth: number;
}

interface TopNavItem {
  label: string;
  href: string;
  navKey: string | null;
}

interface VariantConfig {
  appName: string;
  landingLogo: LandingLogo;
  showSidebarBranding: boolean;
  showChatInput: boolean;
  showDirectorySearch: boolean;
  /** null = show all sidebar nav items */
  sidebarNavKeys: string[] | null;
  topNavItems: TopNavItem[];
}

const streetbotConfig: VariantConfig = {
  appName: 'Street Voices',
  landingLogo: {
    darkIcon: '/assets/streetbot-icon.svg',
    lightIcon: '/assets/streetbot-icon-light.svg',
    darkText: '/assets/streetbot-text.svg',
    lightText: '/assets/streetbot-text-light.svg',
    alt: 'Street Voices',
    iconWidth: 90,
    textWidth: 140,
  },
  showSidebarBranding: true,
  showChatInput: true,
  showDirectorySearch: false,
  sidebarNavKeys: null,
  topNavItems: [
    { label: 'Street Gallery', href: '/gallery', navKey: 'gallery' },
    { label: 'Job Board', href: '/jobs', navKey: 'jobs' },
    { label: 'Academy', href: '/learning', navKey: 'learning' },
    { label: 'Directory', href: '/directory', navKey: 'directory' },
    { label: 'Programs', href: 'https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw', navKey: null },
    { label: 'News', href: '/news', navKey: 'news' },
    { label: 'About Us', href: '#', navKey: null },
  ],
};

const directoryConfig: VariantConfig = {
  appName: 'Street Voices',
  landingLogo: {
    darkIcon: '',
    lightIcon: '',
    darkText: '/assets/streetvoices-text.svg',
    lightText: '/assets/streetvoices-text-dark.svg',
    alt: 'Street Voices',
    iconWidth: 0,
    textWidth: 300,
  },
  showSidebarBranding: false,
  showChatInput: false,
  showDirectorySearch: true,
  sidebarNavKeys: ['profile', 'directory', 'news', 'jobs', 'groups', 'notifications', 'settings'],
  topNavItems: [
    { label: 'Directory', href: '/directory', navKey: 'directory' },
    { label: 'News', href: '/news', navKey: 'news' },
    { label: 'About Us', href: '#', navKey: null },
    { label: 'Programs', href: 'https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw', navKey: null },
  ],
};

export const variantConfig: VariantConfig =
  APP_VARIANT === 'directory' ? directoryConfig : streetbotConfig;
