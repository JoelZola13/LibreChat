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

const envVariant = import.meta.env.VITE_APP_VARIANT as AppVariant | undefined;
const runtimeHost = typeof window === 'undefined' ? '' : window.location.hostname;
const runtimePort = typeof window === 'undefined' ? '' : window.location.port;
const runtimeForcesStreetBot =
  runtimePort === '3180' ||
  runtimeHost === 'streetbot-directory.pages.dev' ||
  runtimeHost.endsWith('.streetbot-directory.pages.dev');

export const APP_VARIANT: AppVariant = runtimeForcesStreetBot
  ? 'streetbot'
  : envVariant === 'directory'
    ? 'directory'
    : 'streetbot';

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
    darkIcon: '/assets/streetbot-icon-home-dark-animated.svg',
    lightIcon: '/assets/streetbot-icon-home-light-animated.svg',
    darkText: '/assets/streetbot-text-home-dark-soft.svg',
    lightText: '/assets/streetbot-text-light.svg',
    alt: 'Street Voices',
    iconWidth: 104,
    textWidth: 132,
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
