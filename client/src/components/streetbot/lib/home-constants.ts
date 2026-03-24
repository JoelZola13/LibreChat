/**
 * Constants for the Home/Chat interface
 * Extracted from home-client.tsx for better code organization
 */
import type { CSSProperties } from "react";
import type {
  StoredUserSettings,
  ThemeName,
  SettingsTab,
  FontSizeOption,
  ProfileFieldKey,
  HistoryEntryAction,
} from "@/types/home";

// Storage keys
export const LOCAL_STORAGE_KEY = "streetbot:sessions";
export const LOCATION_STORAGE_KEY = "streetbot:location";
export const THEME_STORAGE_KEY = "streetbot:theme";
export const SETTINGS_STORAGE_KEY = "streetbot:user-settings";
export const SIDEBAR_OPEN_STORAGE_KEY = "streetbot:sidebar-open";
export const SIDEBAR_MINIMIZED_STORAGE_KEY = "streetbot:sidebar-minimized";
export const LOCATION_PANEL_VISIBILITY_KEY = "streetbot:location-panel-visible";
export const ACTIVE_SESSION_STORAGE_KEY = "streetbot:active-session";
export const PENDING_CHAT_MESSAGE_KEY = "streetbot:pending-chat-message";
export const PENDING_CHAT_CONTEXT_KEY = "streetbot:pending-chat-context";

// Default values
export const DEFAULT_LOCATION_RADIUS_KM = 10;
export const LOCATION_RADIUS_OPTIONS = [5, 10, 25, 50, 100];
export const DEFAULT_THEME: ThemeName = "dark";

// Settings configuration
export const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "account", label: "Account" },
  { value: "appearance", label: "Appearance" },
  { value: "location", label: "Location" },
  { value: "workspace", label: "Workspace" },
  { value: "data", label: "Data controls" },
];

export const SETTINGS_TAB_DESCRIPTIONS: Record<SettingsTab, string> = {
  profile: "Update your identity, case lead details, and avatar.",
  account: "Review contact info, alerts, and login status.",
  appearance: "Tune how Street Voices looks and feels.",
  location: "Control how Street Voices gathers your location.",
  workspace: "Decide how cases and teammates stay in sync.",
  data: "Manage history, diagnostics, and export/delete actions.",
};

export const DEFAULT_USER_SETTINGS: StoredUserSettings = {
  profile: {
    name: "",
    title: "",
    organization: "",
    email: "",
    phone: "",
    location: "",
    pronouns: "",
    bio: "",
    timezone: "",
    avatarUrl: null,
  },
  notifications: {
    weeklySummary: true,
    escalationAlerts: true,
    productUpdates: false,
  },
  appearance: {
    compactUI: false,
    showTypingAnimation: true,
    fontSize: "normal",
    preferredTheme: DEFAULT_THEME,
  },
  data: {
    saveHistory: true,
    shareDiagnostics: false,
  },
  workspace: {
    autoAssignCases: true,
    shareStatusWithTeam: true,
    showAgentHandOffs: true,
  },
  location: {
    showHelperPanel: true,
    autoHideAfterSet: true,
    defaultCity: "Toronto, ON",
    ignoreRadiusFilter: true,
  },
};

// Color palettes
export const darkPalette = {
  background: "var(--sb-color-background)",
  surface: "var(--sb-color-surface)",
  surfaceMuted: "var(--sb-color-surface-muted)",
  surfaceElevated: "var(--sb-color-surface-elevated)",
  border: "rgba(188, 189, 208, 0.16)",
  textPrimary: "#E6E7F2",
  textSecondary: "#9C9DB5",
  accent: "#FFD600",
  accentText: "#FFD600",
  inputBg: "rgba(40, 41, 51, 0.55)",
  inputBorder: "rgba(188, 189, 208, 0.22)",
  overlayBg: "rgba(16, 17, 26, 0.98)",
  softBorder: "rgba(188, 189, 208, 0.18)",
  newsLabelBg: "#2C2D38",
  cardShadow: "0 24px 60px rgba(0, 0, 0, 0.32)",
} as const;

export const lightPalette = {
  background: "var(--sb-color-background)",
  surface: "var(--sb-color-surface)",
  surfaceMuted: "var(--sb-color-surface-muted)",
  surfaceElevated: "var(--sb-color-surface-elevated)",
  border: "rgba(17, 24, 39, 0.12)",
  textPrimary: "#1a1c24",
  textSecondary: "#4b4d59",
  accent: "#FFD600",
  accentText: "#000",
  inputBg: "rgba(255, 255, 255, 0.95)",
  inputBorder: "rgba(17, 24, 39, 0.14)",
  overlayBg: "rgba(255, 255, 255, 0.98)",
  softBorder: "rgba(17, 24, 39, 0.12)",
  newsLabelBg: "#eceef4",
  cardShadow: "0 24px 60px rgba(0, 0, 0, 0.08)",
} as const;

export type ColorPalette = typeof darkPalette | typeof lightPalette;

// Layout constants
export const layout = {
  pagePaddingTop: 12,
  pagePaddingRight: 72,
  pagePaddingBottom: 64,
  pagePaddingLeft: 32,
  sidebarWidth: 296,
  sidebarRadius: 0,
  compactSidebarWidth: 72,
  contentGap: 48,
  mainRadius: 36,
  mainPaddingX: 72,
  mainPaddingY: 48,
  topBarHeight: 72,
  heroVerticalOffset: 24,
  mainContentMaxWidth: 1320,
  promptMinWidth: 240,
  composerMaxWidth: 960,
  composerBottomOffset: 32,
  composerGap: 18,
  composerButtonSize: 42,
  composerStackHeight: 118,
  heroIllustrationWidth: 420,
  heroIllustrationHeight: 360,
  heroDescriptionMax: 560,
  heroDescriptionSpacing: 18,
  heroExamplesLabelSpacing: 28,
  promptSpacing: 18,
} as const;

// Version options
export const VERSION_OPTIONS = [
  { label: "Street Voices 0.5", value: "street-bot-0-5" },
  { label: "Street Voices Pro", value: "street-bot-pro" },
] as const;
export type VersionValue = (typeof VERSION_OPTIONS)[number]["value"];

// Calculated constants
export const LOCATION_PANEL_TOP_OFFSET_PX = layout.topBarHeight + 12;

// Options arrays
export const TIMEZONE_OPTIONS = [
  "America/Toronto (GMT-5)",
  "America/Chicago (GMT-6)",
  "America/Denver (GMT-7)",
  "America/Los_Angeles (GMT-8)",
  "UTC",
];
export const THEME_OPTIONS: ThemeName[] = ["dark", "light"];
export const FONT_SIZE_OPTIONS: FontSizeOption[] = ["normal", "large"];

export const PROFILE_TEXT_FIELDS: Array<{ key: ProfileFieldKey; label: string; placeholder: string; type?: string }> = [
  { key: "name", label: "Full name", placeholder: "Add your name" },
  { key: "title", label: "Role", placeholder: "Your title" },
  { key: "organization", label: "Organization", placeholder: "Where you work" },
  { key: "location", label: "Location", placeholder: "City or region" },
  { key: "pronouns", label: "Pronouns", placeholder: "e.g., She/Her" },
  { key: "email", label: "Email", placeholder: "name@example.com", type: "email" },
  { key: "phone", label: "Phone", placeholder: "(555) 000-1234", type: "tel" },
];

// History action labels
export const HISTORY_ENTRY_ACTION_LABELS: Record<HistoryEntryAction, string> = {
  rename: "Rename",
  share: "Share",
  archive: "Archive",
  unarchive: "Unarchive",
  delete: "Delete",
};

export const HISTORY_ENTRY_ICON_PATH = "/streetbot/history-bubble.svg";

// External URLs
export const PROFILE_APP_URL = process.env.NEXT_PUBLIC_PROFILE_URL || "http://localhost:5173";

// Common styles
export const whiteIconStyle: CSSProperties = {
  filter: "brightness(0) saturate(100%) invert(1)",
};
