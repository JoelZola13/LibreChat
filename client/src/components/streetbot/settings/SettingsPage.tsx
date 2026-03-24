import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  General,
  Chat,
  Commands,
  Speech,
  Personalization,
  Data,
  Balance,
  Account,
} from '~/components/Nav/SettingsTabs';
import usePersonalizationAccess from '~/hooks/usePersonalizationAccess';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { useTheme } from '~/components/streetbot/shared/theme-provider';
import { sbFetch } from '~/components/streetbot/shared/sbFetch';
import { useUserRole } from '~/components/streetbot/lib/auth/useUserRole';
import { isBalanceFeatureEnabled } from '~/utils/balance';
import MessagesSummary from './tabs/MessagesSummary';
import TasksSummary from './tabs/TasksSummary';
import CalendarSummary from './tabs/CalendarSummary';
import DocumentsSummary from './tabs/DocumentsSummary';

// ---------------------------------------------------------------------------
// Directus CMS helpers (inline to avoid @directus/sdk build dep)
// ---------------------------------------------------------------------------

const CMS_URL = '/cms';
const CMS_TOKEN = 'streetvoices-admin-token-2026';
const CMS_HEADERS = { Authorization: `Bearer ${CMS_TOKEN}`, 'Content-Type': 'application/json' };

type DirectusProfileRecord = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
};

async function cmsGetProfiles(userId: string): Promise<DirectusProfileRecord[]> {
  const params = new URLSearchParams({
    filter: JSON.stringify({ user_id: { _eq: userId } }),
    limit: '1',
    fields: 'id,avatar_url,cover_url',
  });
  const res = await fetch(`${CMS_URL}/items/street_profiles?${params}`, { headers: CMS_HEADERS });
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()).data;
}

async function cmsCreateProfile(data: Partial<DirectusProfileRecord>): Promise<DirectusProfileRecord> {
  const res = await fetch(`${CMS_URL}/items/street_profiles`, {
    method: 'POST',
    headers: CMS_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()).data;
}

async function cmsUpdateProfile(id: string, data: Partial<DirectusProfileRecord>): Promise<void> {
  const res = await fetch(`${CMS_URL}/items/street_profiles/${id}`, {
    method: 'PATCH',
    headers: CMS_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(res.statusText);
}

// ---------------------------------------------------------------------------
// SVG Icon Components (inline, no lucide-react)
// ---------------------------------------------------------------------------

const IconUser = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconBell = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconPalette = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="0.5" fill={color} />
    <circle cx="17.5" cy="10.5" r="0.5" fill={color} />
    <circle cx="8.5" cy="7.5" r="0.5" fill={color} />
    <circle cx="6.5" cy="12.5" r="0.5" fill={color} />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const IconMapPin = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconBuilding = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M16 6h.01" />
    <path d="M8 10h.01" /><path d="M16 10h.01" />
    <path d="M8 14h.01" /><path d="M16 14h.01" />
  </svg>
);

const IconShield = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconDatabase = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const IconSettings = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconMessageSquare = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconBookmark = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const IconTrendingUp = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconGlobe = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconGrid = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const IconInfo = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconUsers = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconBriefcase = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconHardDrive = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="12" x2="2" y2="12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    <line x1="6" y1="16" x2="6.01" y2="16" />
    <line x1="10" y1="16" x2="10.01" y2="16" />
  </svg>
);

const IconShare2 = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const IconUserCheck = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
);

const IconActivity = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconCalendar = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconLink = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconLogOut = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconDollarSign = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconBadgeCheck = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.77 4 4 0 0 1 0 6.76 4 4 0 0 1-4.78 4.77 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z" />
    <polyline points="9 12 12 15 16 10" />
  </svg>
);

const IconCheck = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconGear = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconCommand = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
);

const IconSpeech = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const IconPersonalization = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7h-9" /><path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </svg>
);

const IconDownload = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconTrash = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconCamera = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconX = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconFileText = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconListTodo = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

// ---------------------------------------------------------------------------
// Theme palette (full SBP copy)
// ---------------------------------------------------------------------------

const getPalette = (isDark: boolean) => isDark ? {
  background: 'var(--sb-color-background)',
  surface: 'rgba(255, 255, 255, 0.08)',
  surfaceHover: 'rgba(255, 255, 255, 0.12)',
  surfaceMuted: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.15)',
  borderHover: 'rgba(255, 255, 255, 0.25)',
  textPrimary: 'rgba(255, 255, 255, 0.95)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  accent: '#FFD600',
  accentGlow: 'rgba(255, 214, 0, 0.4)',
  inputBg: 'rgba(255, 255, 255, 0.06)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  overlayBg: 'rgba(255, 255, 255, 0.08)',
  softBorder: 'rgba(255, 255, 255, 0.12)',
  cardBg: 'rgba(255, 255, 255, 0.06)',
  glassShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  glassShadowHover: '0 16px 48px rgba(0, 0, 0, 0.4)',
  headerBg: 'linear-gradient(135deg, rgba(17, 17, 17, 0.8) 0%, rgba(26, 26, 26, 0.7) 50%, rgba(34, 34, 34, 0.8) 100%)',
} : {
  background: '#eef0f5',
  surface: 'rgba(255, 255, 255, 0.95)',
  surfaceHover: 'rgba(255, 255, 255, 1)',
  surfaceMuted: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(0, 0, 0, 0.12)',
  borderHover: 'rgba(0, 0, 0, 0.22)',
  textPrimary: '#1a1c24',
  textSecondary: '#4b4d59',
  textMuted: '#6b6d79',
  accent: '#FFD600',
  accentGlow: 'rgba(255, 214, 0, 0.35)',
  inputBg: '#ffffff',
  inputBorder: 'rgba(0, 0, 0, 0.15)',
  overlayBg: 'rgba(255, 255, 255, 0.98)',
  softBorder: 'rgba(0, 0, 0, 0.1)',
  cardBg: 'rgba(255, 255, 255, 0.95)',
  glassShadow: '0 2px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
  glassShadowHover: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
  headerBg: 'linear-gradient(135deg, rgba(255, 248, 220, 0.6) 0%, rgba(240, 238, 248, 0.7) 50%, rgba(230, 235, 245, 0.8) 100%)',
};

// ---------------------------------------------------------------------------
// SBP settings types and storage
// ---------------------------------------------------------------------------

type FontSizeOption = 'normal' | 'large';
type ThemeName = 'dark' | 'light';

type UserProfileSettings = {
  name: string;
  title: string;
  organization: string;
  email: string;
  phone: string;
  location: string;
  pronouns: string;
  bio: string;
  timezone: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  website: string;
  handle: string;
};

type NotificationPreferences = {
  weeklySummary: boolean;
  escalationAlerts: boolean;
  productUpdates: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
};

type AppearancePreferences = {
  compactUI: boolean;
  showTypingAnimation: boolean;
  fontSize: FontSizeOption;
  preferredTheme: ThemeName;
};

type WorkspacePreferences = {
  autoAssignCases: boolean;
  shareStatusWithTeam: boolean;
  showAgentHandOffs: boolean;
};

type LocationPreferences = {
  showHelperPanel: boolean;
  autoHideAfterSet: boolean;
  defaultCity: string;
  ignoreRadiusFilter: boolean;
};

type PrivacyPreferences = {
  privateProfile: boolean;
  showOnlineStatus: boolean;
  allowMessagesFromAnyone: boolean;
};

type DataPreferences = {
  syncToCloud: boolean;
  analyticsOptIn: boolean;
  crashReports: boolean;
};

type StoredUserSettings = {
  profile: UserProfileSettings;
  notifications: NotificationPreferences;
  appearance: AppearancePreferences;
  location: LocationPreferences;
  workspace: WorkspacePreferences;
  privacy: PrivacyPreferences;
  data: DataPreferences;
};

const SETTINGS_STORAGE_KEY = 'streetbot:user-settings';
const LOCATION_STORAGE_KEY = 'streetbot:location';

type UserLocation = {
  latitude: number;
  longitude: number;
  radiusKm: number;
  label?: string | null;
};

const DEFAULT_USER_SETTINGS: StoredUserSettings = {
  profile: {
    name: '',
    title: '',
    organization: '',
    email: '',
    phone: '',
    location: '',
    pronouns: '',
    bio: '',
    timezone: '',
    avatarUrl: null,
    bannerUrl: null,
    website: '',
    handle: '',
  },
  notifications: {
    weeklySummary: true,
    escalationAlerts: true,
    productUpdates: false,
    emailNotifications: true,
    pushNotifications: true,
  },
  appearance: {
    compactUI: false,
    showTypingAnimation: true,
    fontSize: 'normal',
    preferredTheme: 'dark',
  },
  workspace: {
    autoAssignCases: true,
    shareStatusWithTeam: true,
    showAgentHandOffs: true,
  },
  location: {
    showHelperPanel: true,
    autoHideAfterSet: true,
    defaultCity: 'Toronto, ON',
    ignoreRadiusFilter: true,
  },
  privacy: {
    privateProfile: false,
    showOnlineStatus: true,
    allowMessagesFromAnyone: true,
  },
  data: {
    syncToCloud: true,
    analyticsOptIn: false,
    crashReports: true,
  },
};

type ProfileFieldKey = Exclude<keyof UserProfileSettings, 'avatarUrl' | 'bannerUrl'>;

const TIMEZONE_OPTIONS = [
  'America/Toronto (GMT-5)',
  'America/Chicago (GMT-6)',
  'America/Denver (GMT-7)',
  'America/Los_Angeles (GMT-8)',
  'UTC',
];

const THEME_OPTIONS: ThemeName[] = ['dark', 'light'];
const FONT_SIZE_OPTIONS: FontSizeOption[] = ['normal', 'large'];
const LOCATION_RADIUS_OPTIONS = [5, 10, 25, 50, 100];

const PROFILE_TEXT_FIELDS: Array<{
  key: ProfileFieldKey;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { key: 'name', label: 'Full name', placeholder: 'Add your name' },
  { key: 'handle', label: 'Handle', placeholder: '@street_user' },
  { key: 'title', label: 'Role', placeholder: 'Your title' },
  { key: 'organization', label: 'Organization', placeholder: 'Where you work' },
  { key: 'location', label: 'Location', placeholder: 'City or region' },
  { key: 'pronouns', label: 'Pronouns', placeholder: 'e.g., She/Her' },
  { key: 'email', label: 'Email', placeholder: 'name@example.com', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 000-1234', type: 'tel' },
  { key: 'website', label: 'Website', placeholder: 'streetvoices.app', type: 'url' },
];

function getSettingsStorageKey(userId?: string | null) {
  return userId ? `${SETTINGS_STORAGE_KEY}:${userId}` : SETTINGS_STORAGE_KEY;
}

function readStoredUserSettings(
  userId?: string | null,
  userEmail?: string | null,
): StoredUserSettings {
  try {
    const raw = userId
      ? window.localStorage.getItem(getSettingsStorageKey(userId))
      : null;
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredUserSettings>;
    const parsedEmail = parsed.profile?.email?.trim().toLowerCase();
    const normalizedUserEmail = userEmail?.trim().toLowerCase();

    if (normalizedUserEmail && parsedEmail && parsedEmail !== normalizedUserEmail) {
      return DEFAULT_USER_SETTINGS;
    }

    return {
      profile: { ...DEFAULT_USER_SETTINGS.profile, ...(parsed.profile ?? {}) },
      notifications: { ...DEFAULT_USER_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
      appearance: { ...DEFAULT_USER_SETTINGS.appearance, ...(parsed.appearance ?? {}) },
      workspace: { ...DEFAULT_USER_SETTINGS.workspace, ...(parsed.workspace ?? {}) },
      location: { ...DEFAULT_USER_SETTINGS.location, ...(parsed.location ?? {}) },
      privacy: { ...DEFAULT_USER_SETTINGS.privacy, ...(parsed.privacy ?? {}) },
      data: { ...DEFAULT_USER_SETTINGS.data, ...(parsed.data ?? {}) },
    };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function writeStoredUserSettings(next: StoredUserSettings, userId?: string | null) {
  try {
    window.localStorage.setItem(getSettingsStorageKey(userId), JSON.stringify(next));
  } catch {
    // Storage full or unavailable
  }
}

function readStoredLocation(): UserLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const latitude =
      typeof parsed['latitude'] === 'number'
        ? (parsed['latitude'] as number)
        : typeof parsed['lat'] === 'number'
          ? (parsed['lat'] as number)
          : null;
    const longitude =
      typeof parsed['longitude'] === 'number'
        ? (parsed['longitude'] as number)
        : typeof parsed['lon'] === 'number'
          ? (parsed['lon'] as number)
          : null;
    const radiusKm =
      typeof parsed['radiusKm'] === 'number' ? (parsed['radiusKm'] as number) : null;
    if (latitude === null || longitude === null || radiusKm === null) return null;
    return {
      latitude,
      longitude,
      radiusKm,
      label: typeof parsed['label'] === 'string' ? (parsed['label'] as string) : null,
    };
  } catch {
    return null;
  }
}

function writeStoredLocation(next: UserLocation | null) {
  try {
    if (!next) {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Storage unavailable
  }
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type MainTabId = 'timeline' | 'jobs' | 'news' | 'services' | 'messages' | 'tasks' | 'calendar' | 'documents' | 'gallery' | 'about' | 'communities' | 'portfolio' | 'settings' | 'storage' | 'social-media' | 'contacts' | 'activity';

type SettingsSubTabId =
  | 'edit-profile'
  | 'account'
  | 'appearance'
  | 'sb-location'
  | 'workspace'
  | 'privacy'
  | 'sb-data';

type LibreChatTabId =
  | 'lc-general'
  | 'lc-chat'
  | 'lc-commands'
  | 'lc-speech'
  | 'lc-personalization'
  | 'lc-data'
  | 'lc-balance'
  | 'lc-account';

const mainTabs: Array<{ id: MainTabId; icon: typeof IconMessageSquare; label: string }> = [
  { id: 'timeline', icon: IconMessageSquare, label: 'Timeline' },
  { id: 'jobs', icon: IconBookmark, label: 'Jobs' },
  { id: 'news', icon: IconTrendingUp, label: 'News' },
  { id: 'services', icon: IconGlobe, label: 'Services' },
  { id: 'messages', icon: IconMessageSquare, label: 'Messages' },
  { id: 'tasks', icon: IconListTodo, label: 'Tasks' },
  { id: 'calendar', icon: IconCalendar, label: 'Calendar' },
  { id: 'documents', icon: IconFileText, label: 'Documents' },
  { id: 'gallery', icon: IconGrid, label: 'Gallery' },
  { id: 'about', icon: IconInfo, label: 'About' },
  { id: 'communities', icon: IconUsers, label: 'Communities' },
  { id: 'portfolio', icon: IconBriefcase, label: 'Portfolio' },
  { id: 'storage', icon: IconHardDrive, label: 'Storage' },
  { id: 'social-media', icon: IconShare2, label: 'Social Media' },
  { id: 'contacts', icon: IconUserCheck, label: 'Contacts' },
  { id: 'activity', icon: IconActivity, label: 'Activity' },
];

const settingsSubTabs: Array<{ id: SettingsSubTabId; icon: typeof IconUser; label: string }> = [
  { id: 'edit-profile', icon: IconUser, label: 'Edit Profile' },
  { id: 'account', icon: IconBell, label: 'Account' },
  { id: 'appearance', icon: IconPalette, label: 'Appearance' },
  { id: 'sb-location', icon: IconMapPin, label: 'Location' },
  { id: 'workspace', icon: IconBuilding, label: 'Workspace' },
  { id: 'privacy', icon: IconShield, label: 'Privacy' },
  { id: 'sb-data', icon: IconDatabase, label: 'Data' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);
  const localize = useLocalize();
  const { user, token, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { hasAnyPersonalizationFeature, hasMemoryOptOut } = usePersonalizationAccess();
  const { role, isAdmin } = useUserRole();
  const isPrivileged = isAdmin || role === 'designer';

  // Role-filtered tabs
  const USER_MAIN_TABS: Set<MainTabId> = useMemo(() => new Set(['news', 'services', 'messages', 'tasks', 'calendar', 'documents', 'about', 'settings', 'storage', 'social-media', 'contacts', 'activity']), []);
  const USER_SETTINGS_SUB_TABS: Set<SettingsSubTabId> = useMemo(() => new Set(['edit-profile', 'account', 'appearance']), []);
  const filteredMainTabs = useMemo(() => isPrivileged ? mainTabs : mainTabs.filter((t) => USER_MAIN_TABS.has(t.id)), [isPrivileged, USER_MAIN_TABS]);
  const filteredSettingsSubTabs = useMemo(() => isPrivileged ? settingsSubTabs : settingsSubTabs.filter((t) => USER_SETTINGS_SUB_TABS.has(t.id)), [isPrivileged, USER_SETTINGS_SUB_TABS]);

  // Tab state — default to 'news' for regular users, 'timeline' for privileged
  const [activeMainTab, setActiveMainTab] = useState<MainTabId>(() => isPrivileged ? 'timeline' : 'news');
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<SettingsSubTabId>('edit-profile');
  const [activeLibreChatTab, setActiveLibreChatTab] = useState<LibreChatTabId>('lc-general');
  const [hoveredMainTab, setHoveredMainTab] = useState<string | null>(null);
  const [hoveredSettingsSubTab, setHoveredSettingsSubTab] = useState<string | null>(null);
  const [hoveredLcTab, setHoveredLcTab] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );

  // Settings state
  const [userSettings, setUserSettings] = useState<StoredUserSettings>(() =>
    readStoredUserSettings(),
  );
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [providerAccountType, setProviderAccountType] = useState<string | null>(null);

  // Directus profile sync
  const directusProfileIdRef = useRef<string | null>(null);

  // Saved services (favorites from SBP backend)
  type SavedService = {
    id: number; name: string; description?: string; overview?: string;
    city?: string; province?: string; address?: string; phone?: string;
    email?: string; website?: string; logo?: string; image_url?: string;
    category_names?: string[]; tags?: string[]; is_verified?: boolean;
    rating?: number; rating_count?: number; hours?: Record<string, string>;
    latitude?: number; longitude?: number; gallery?: string[];
  };
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [savedServicesLoading, setSavedServicesLoading] = useState(false);
  const savedServicesFetched = useRef(false);

  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(() => readStoredLocation());
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');

  const tabBarRef = useRef<HTMLDivElement>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSettingsTab = activeMainTab === 'settings';
  const isMobile = viewportWidth <= 768;

  const persistUserSettings = useCallback(
    (next: StoredUserSettings) => {
      writeStoredUserSettings(next, user?.id);
    },
    [user?.id],
  );

  // Derived display values
  const displayName = user?.name || userSettings.profile.name || 'Street User';
  const displayHandle = user?.username ? '@' + user.username : userSettings.profile.handle || '@street_user';
  const displayBio = userSettings.profile.bio || 'Building a more equitable world, one block at a time.';
  const displayOrg = userSettings.profile.organization || '';
  const displayLocation = userSettings.profile.location || '';
  const displayWebsite = userSettings.profile.website || '';
  const displayAvatarUrl = user?.avatar || userSettings.profile.avatarUrl;
  const displayBannerUrl = userSettings.profile.bannerUrl;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SU';

  // Load settings for the authenticated user and hydrate identity fields from auth.
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }

    const loadedSettings = readStoredUserSettings(user?.id, user?.email);
    const nextSettings: StoredUserSettings = {
      ...loadedSettings,
      profile: {
        ...loadedSettings.profile,
        name: user?.name || loadedSettings.profile.name,
        email: user?.email || loadedSettings.profile.email,
        handle: user?.username
          ? `@${String(user.username).replace(/^@+/, '')}`
          : loadedSettings.profile.handle,
      },
    };

    setUserSettings(nextSettings);

    if (user?.id) {
      writeStoredUserSettings(nextSettings, user.id);
    }
  }, [user?.email, user?.id, user?.name, user?.username]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load avatar_url + cover_url from Directus street_profiles on mount
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const profiles = await cmsGetProfiles(user.id);
        if (cancelled) return;
        if (profiles.length > 0) {
          const p = profiles[0];
          directusProfileIdRef.current = p.id;
          // Merge Directus values into local state (Directus wins if local is empty)
          setUserSettings((prev) => {
            const avatarUrl = prev.profile.avatarUrl || p.avatar_url || null;
            const bannerUrl = prev.profile.bannerUrl || p.cover_url || null;
            if (avatarUrl !== prev.profile.avatarUrl || bannerUrl !== prev.profile.bannerUrl) {
              const updated = { ...prev, profile: { ...prev.profile, avatarUrl, bannerUrl } };
              writeStoredUserSettings(updated, user.id);
              return updated;
            }
            return prev;
          });
        }
      } catch {
        // Directus unavailable — fall back to localStorage only
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load provider-specific signup fields into the profile editor.
  useEffect(() => {
    if (!user?.id || !token) {
      setProviderAccountType(null);
      return;
    }

    let cancelled = false;

    void fetch(`/api/provider-profiles/${encodeURIComponent(user.id)}`, {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((providerProfile) => {
        if (cancelled || !providerProfile) {
          if (!cancelled) {
            setProviderAccountType(null);
          }
          return;
        }

        setProviderAccountType(
          typeof providerProfile.account_type === 'string' ? providerProfile.account_type : null,
        );

        setUserSettings((prev) => {
          const updated = {
            ...prev,
            profile: {
              ...prev.profile,
              organization: providerProfile.organization_name || prev.profile.organization,
              title: providerProfile.organization_role || prev.profile.title,
            },
          };
          writeStoredUserSettings(updated, user.id);
          return updated;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  // Helper: sync avatar/banner to Directus (fire-and-forget)
  const syncImageToDirectus = useCallback(
    (field: 'avatar_url' | 'cover_url', value: string | null) => {
      if (!user?.id) return;
      (async () => {
        try {
          if (directusProfileIdRef.current) {
            await cmsUpdateProfile(directusProfileIdRef.current, { [field]: value });
          } else {
            const created = await cmsCreateProfile({
              user_id: user.id,
              display_name: user.name || 'Street User',
              is_public: true,
              [field]: value,
            });
            directusProfileIdRef.current = created.id;
          }
        } catch {
          // Directus unavailable — localStorage is the fallback
        }
      })();
    },
    [user?.id, user?.name],
  );

  // Resolve the same user ID the Directory page uses for favorites
  // Directory stores auth user ID at "streetbot:user-id" (hyphen)
  const favoritesUserId = useMemo(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('streetbot:user-id') : null;
    if (stored && stored !== 'demo-user') return stored;
    return user?.id || 'demo-user';
  }, [user?.id]);

  // Fetch user's saved/favorited services from SBP backend when Services tab is active
  useEffect(() => {
    if (activeMainTab !== 'services' || savedServicesFetched.current) return;
    savedServicesFetched.current = true;
    setSavedServicesLoading(true);
    (async () => {
      try {
        const res = await fetch(`/sbapi/services/favorites?user_id=${encodeURIComponent(favoritesUserId)}`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSavedServices(data);
        }
      } catch {
        // SBP unavailable
      } finally {
        setSavedServicesLoading(false);
      }
    })();
  }, [activeMainTab, favoritesUserId]);

  // -------------------------------------------------------------------------
  // Style constants (memoized)
  // -------------------------------------------------------------------------

  const settingsInputStyle = useMemo(
    (): CSSProperties => ({
      width: '100%',
      borderRadius: 14,
      backgroundColor: palette.inputBg,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${palette.inputBorder}`,
      color: palette.textPrimary,
      padding: '10px 14px',
      fontFamily: 'Rubik, sans-serif',
      fontSize: '13px',
      lineHeight: '20px',
      outline: 'none',
      transition: 'all 0.2s ease',
    }),
    [palette],
  );

  const settingsTextareaStyle = useMemo(
    (): CSSProperties => ({
      ...settingsInputStyle,
      minHeight: 96,
      resize: 'vertical' as const,
    }),
    [settingsInputStyle],
  );

  const settingsCardStyle = useMemo(
    (): CSSProperties => ({
      borderRadius: 24,
      border: `1px solid ${palette.border}`,
      backgroundColor: palette.cardBg,
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      padding: '20px',
      boxShadow: palette.glassShadow,
      transition: 'all 0.3s ease',
    }),
    [palette],
  );

  const settingsLabelStyle = useMemo(
    (): CSSProperties => ({
      display: 'block',
      marginBottom: 6,
      color: palette.textSecondary,
      fontFamily: 'Rubik, sans-serif',
      fontSize: '12px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }),
    [palette],
  );

  const settingsHelperTextStyle = useMemo(
    (): CSSProperties => ({
      color: palette.textMuted,
      fontFamily: 'Rubik, sans-serif',
      fontSize: '12px',
      marginTop: 4,
      lineHeight: '18px',
    }),
    [palette],
  );

  const settingsActionButtonStyle = useMemo(
    (): CSSProperties => ({
      borderRadius: 999,
      border: `1px solid ${palette.border}`,
      padding: '10px 18px',
      fontFamily: 'Rubik, sans-serif',
      fontSize: '13px',
      fontWeight: 500,
      color: palette.textPrimary,
      backgroundColor: palette.surface,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      boxShadow: palette.glassShadow,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }),
    [palette],
  );

  // -------------------------------------------------------------------------
  // LibreChat tabs configuration
  // -------------------------------------------------------------------------

  const libreChatTabs = useMemo(() => {
    const balanceEnabled = isBalanceFeatureEnabled(startupConfig);
    const tabs: Array<{ id: LibreChatTabId; icon: typeof IconGear; label: string }> = [
      { id: 'lc-general', icon: IconGear, label: localize('com_nav_setting_general') },
      { id: 'lc-chat', icon: IconMessageSquare, label: localize('com_nav_setting_chat') },
      { id: 'lc-commands', icon: IconCommand, label: localize('com_nav_commands') },
      { id: 'lc-speech', icon: IconSpeech, label: localize('com_nav_setting_speech') },
    ];

    if (hasAnyPersonalizationFeature) {
      tabs.push({ id: 'lc-personalization', icon: IconPersonalization, label: localize('com_nav_setting_personalization') });
    }

    tabs.push({ id: 'lc-data', icon: IconDatabase, label: localize('com_nav_setting_data') });

    if (balanceEnabled) {
      tabs.push({ id: 'lc-balance', icon: IconDollarSign, label: localize('com_nav_setting_balance') });
    }

    tabs.push({ id: 'lc-account', icon: IconUser, label: localize('com_nav_setting_account') });

    return tabs;
  }, [localize, hasAnyPersonalizationFeature, startupConfig]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderSectionHeading = useCallback(
    (title: string, description?: string) => (
      <div>
        <p style={{
          color: palette.textPrimary,
          fontFamily: 'Rubik, sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          margin: 0,
        }}>
          {title}
        </p>
        {description && (
          <p style={{
            color: palette.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: '13px',
            marginTop: 4,
            lineHeight: '20px',
          }}>
            {description}
          </p>
        )}
      </div>
    ),
    [palette],
  );

  const renderToggleRow = useCallback(
    (label: string, description: string | undefined, checked: boolean, onToggle: () => void) => (
      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        padding: '12px 14px',
        backgroundColor: palette.surface,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}>
        <span>
          <p style={{
            color: palette.textPrimary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            margin: 0,
          }}>
            {label}
          </p>
          {description && (
            <p style={{
              color: palette.textSecondary,
              fontFamily: 'Rubik, sans-serif',
              fontSize: '12px',
              marginTop: 2,
              marginBottom: 0,
            }}>
              {description}
            </p>
          )}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{
            marginTop: 2,
            width: 44,
            height: 22,
            flexShrink: 0,
            cursor: 'pointer',
            borderRadius: 999,
            border: checked ? `1px solid ${palette.accent}` : `1px solid ${palette.border}`,
            background: checked ? palette.accent : isDark ? palette.surfaceMuted : '#d1d5db',
            appearance: 'none',
            transition: 'all 0.2s ease',
            boxShadow: checked ? `0 0 12px ${palette.accentGlow}` : 'none',
          }}
        />
      </label>
    ),
    [palette],
  );

  // -------------------------------------------------------------------------
  // Settings handlers
  // -------------------------------------------------------------------------

  const showSaved = useCallback(() => {
    setSettingsStatus('Saved!');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => setSettingsStatus(null), 2000);
  }, []);

  const handleProfileFieldChange = useCallback(
    (field: ProfileFieldKey, value: string) => {
      setUserSettings((prev) => {
        const updated = { ...prev, profile: { ...prev.profile, [field]: value } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleTimezoneChange = useCallback(
    (value: string) => {
      setUserSettings((prev) => {
        const updated = { ...prev, profile: { ...prev.profile, timezone: value } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleNotificationToggle = useCallback(
    (key: keyof NotificationPreferences) => {
      setUserSettings((prev) => {
        const updated = { ...prev, notifications: { ...prev.notifications, [key]: !prev.notifications[key] } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleAppearanceToggle = useCallback(
    (key: 'compactUI' | 'showTypingAnimation') => {
      setUserSettings((prev) => {
        const updated = { ...prev, appearance: { ...prev.appearance, [key]: !prev.appearance[key] } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handlePreferredThemeSelect = useCallback(
    (t: ThemeName) => {
      setTheme(t);
      setUserSettings((prev) => {
        const updated = { ...prev, appearance: { ...prev.appearance, preferredTheme: t } };
        persistUserSettings(updated);
        return updated;
      });
      setSettingsStatus('Theme updated!');
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setSettingsStatus(null), 2000);
    },
    [persistUserSettings, setTheme],
  );

  const handleFontSizeSelect = useCallback(
    (size: FontSizeOption) => {
      setUserSettings((prev) => {
        const updated = { ...prev, appearance: { ...prev.appearance, fontSize: size } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleWorkspaceToggle = useCallback(
    (key: keyof WorkspacePreferences) => {
      setUserSettings((prev) => {
        const updated = { ...prev, workspace: { ...prev.workspace, [key]: !prev.workspace[key] } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handlePrivacyToggle = useCallback(
    (key: keyof PrivacyPreferences) => {
      setUserSettings((prev) => {
        const updated = { ...prev, privacy: { ...prev.privacy, [key]: !prev.privacy[key] } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleDataToggle = useCallback(
    (key: keyof DataPreferences) => {
      setUserSettings((prev) => {
        const updated = { ...prev, data: { ...prev.data, [key]: !prev.data[key] } };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleLocationPreferenceToggle = useCallback(
    (key: keyof LocationPreferences) => {
      if (key === 'defaultCity') return;
      setUserSettings((prev) => {
        const updated = {
          ...prev,
          location: {
            ...prev.location,
            [key]: !prev.location[key as keyof Omit<LocationPreferences, 'defaultCity'>],
          },
        };
        persistUserSettings(updated);
        return updated;
      });
      showSaved();
    },
    [persistUserSettings, showSaved],
  );

  const handleLocationDefaultCityChange = useCallback((value: string) => {
    setUserSettings((prev) => {
      const updated = { ...prev, location: { ...prev.location, defaultCity: value } };
      persistUserSettings(updated);
      return updated;
    });
  }, [persistUserSettings]);

  const handleAvatarUploadClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUserSettings((prev) => {
          const updated = { ...prev, profile: { ...prev.profile, avatarUrl: dataUrl } };
          persistUserSettings(updated);
          return updated;
        });
        syncImageToDirectus('avatar_url', dataUrl);
        showSaved();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [persistUserSettings, showSaved, syncImageToDirectus]);

  const handleAvatarRemove = useCallback(() => {
    setUserSettings((prev) => {
      const updated = { ...prev, profile: { ...prev.profile, avatarUrl: null } };
      persistUserSettings(updated);
      return updated;
    });
    syncImageToDirectus('avatar_url', null);
    showSaved();
  }, [persistUserSettings, showSaved, syncImageToDirectus]);

  const handleBannerUploadClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUserSettings((prev) => {
          const updated = { ...prev, profile: { ...prev.profile, bannerUrl: dataUrl } };
          persistUserSettings(updated);
          return updated;
        });
        syncImageToDirectus('cover_url', dataUrl);
        showSaved();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [persistUserSettings, showSaved, syncImageToDirectus]);

  const handleBannerRemove = useCallback(() => {
    setUserSettings((prev) => {
      const updated = { ...prev, profile: { ...prev.profile, bannerUrl: null } };
      persistUserSettings(updated);
      return updated;
    });
    syncImageToDirectus('cover_url', null);
    showSaved();
  }, [persistUserSettings, showSaved, syncImageToDirectus]);

  const handleApplyDefaultCity = useCallback(async () => {
    const city = userSettings.location.defaultCity.trim();
    if (!city) return;
    setIsResolvingLocation(true);
    setLocationError(null);
    setLocationStatus('Resolving location...');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1&addressdetails=1`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const addr = result.address || {};
        const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || addr.province || addr.region || '';
        const shortLabel = [cityName, state].filter(Boolean).join(', ') || city;
        const newLocation: UserLocation = {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          radiusKm: userLocation?.radiusKm ?? 10,
          label: shortLabel,
        };
        setUserLocation(newLocation);
        writeStoredLocation(newLocation);
        setUserSettings((prev) => {
          const updated = {
            ...prev,
            profile: { ...prev.profile, location: shortLabel },
            location: { ...prev.location, defaultCity: shortLabel },
          };
          persistUserSettings(updated);
          return updated;
        });
        setLocationStatus('Location set!');
      } else {
        setLocationError('Could not find that location.');
      }
    } catch {
      setLocationError('Failed to resolve location.');
    } finally {
      setIsResolvingLocation(false);
      setTimeout(() => setLocationStatus(null), 3000);
    }
  }, [persistUserSettings, userSettings.location.defaultCity, userLocation?.radiusKm]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported.');
      return;
    }
    setIsResolvingLocation(true);
    setLocationError(null);
    setLocationStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          );
          const data = await response.json();
          const addr = data.address || {};
          const cityVal = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
          const state = addr.state || addr.province || addr.region || '';
          const profileLocation =
            [cityVal, state].filter(Boolean).join(', ') ||
            data.display_name ||
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          const newLocation: UserLocation = {
            latitude,
            longitude,
            radiusKm: userLocation?.radiusKm ?? 10,
            label: data.display_name || profileLocation,
          };
          setUserLocation(newLocation);
          writeStoredLocation(newLocation);
          setUserSettings((prev) => {
            const updated = {
              ...prev,
              profile: { ...prev.profile, location: profileLocation },
              location: { ...prev.location, defaultCity: data.display_name || profileLocation },
            };
            persistUserSettings(updated);
            return updated;
          });
          setLocationStatus('Location set!');
        } catch {
          const exactCoords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          const newLocation: UserLocation = {
            latitude,
            longitude,
            radiusKm: userLocation?.radiusKm ?? 10,
            label: exactCoords,
          };
          setUserLocation(newLocation);
          writeStoredLocation(newLocation);
          setLocationStatus('Location set!');
        }
        setIsResolvingLocation(false);
        setTimeout(() => setLocationStatus(null), 3000);
      },
      (err) => {
        setLocationError(`Failed: ${err.message}`);
        setIsResolvingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [persistUserSettings, userLocation?.radiusKm]);

  const handleManualLocationSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const query = manualLocationInput.trim();
      if (!query) return;
      setIsResolvingLocation(true);
      setLocationError(null);
      setLocationStatus('Resolving...');
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
        );
        const data = await response.json();
        if (data && data.length > 0) {
          const result = data[0];
          const addr = result.address || {};
          const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
          const state = addr.state || addr.province || addr.region || '';
          const shortLabel = [cityName, state].filter(Boolean).join(', ') || query;
          const newLocation: UserLocation = {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            radiusKm: userLocation?.radiusKm ?? 10,
            label: shortLabel,
          };
          setUserLocation(newLocation);
          writeStoredLocation(newLocation);
          setUserSettings((prev) => {
            const updated = {
              ...prev,
              profile: { ...prev.profile, location: shortLabel },
              location: { ...prev.location, defaultCity: shortLabel },
            };
            persistUserSettings(updated);
            return updated;
          });
          setLocationStatus('Location set!');
          setManualLocationInput('');
        } else {
          setLocationError('Location not found.');
        }
      } catch {
        setLocationError('Failed to resolve location.');
      } finally {
        setIsResolvingLocation(false);
        setTimeout(() => setLocationStatus(null), 3000);
      }
    },
    [manualLocationInput, persistUserSettings, userLocation?.radiusKm],
  );

  const handleRadiusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRadius = parseInt(e.target.value, 10);
      if (userLocation) {
        const updated: UserLocation = { ...userLocation, radiusKm: newRadius };
        setUserLocation(updated);
        writeStoredLocation(updated);
      }
    },
    [userLocation],
  );

  const handleClearLocation = useCallback(() => {
    setUserLocation(null);
    writeStoredLocation(null);
    setLocationStatus('Location cleared');
    setTimeout(() => setLocationStatus(null), 2000);
  }, []);


  const handleExportData = useCallback(() => {
    const allData = {
      settings: userSettings,
      location: userLocation,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streetbot-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSaved();
  }, [userSettings, userLocation, showSaved]);

  const handleDeleteAllData = useCallback(() => {
    if (window.confirm('Are you sure you want to delete all Street Voices data? This cannot be undone.')) {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
      setUserSettings(DEFAULT_USER_SETTINGS);
      setUserLocation(null);
      setSettingsStatus('All data deleted.');
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setSettingsStatus(null), 3000);
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (logout) {
      logout();
    }
  }, [logout]);

  // -------------------------------------------------------------------------
  // Render: Profile Header
  // -------------------------------------------------------------------------

  const renderProfileHeader = () => (
    <div style={{ position: 'relative', marginBottom: isMobile ? '14px' : '20px' }}>
      {/* 200px gradient banner */}
      <div style={{
        height: isMobile ? '160px' : '200px',
        background: displayBannerUrl ? `url(${displayBannerUrl})` : palette.headerBg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backdropFilter: displayBannerUrl ? undefined : 'blur(20px)',
        WebkitBackdropFilter: displayBannerUrl ? undefined : 'blur(20px)',
        borderRadius: isMobile ? '18px 18px 0 0' : '24px 24px 0 0',
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${palette.border}`,
        borderBottom: 'none',
      }}>
        {/* Street Profile text */}
        <div style={{
          position: 'absolute',
          top: isMobile ? '16px' : '26px',
          left: isMobile ? '16px' : '26px',
          fontSize: isMobile ? '1.2rem' : '1.6rem',
          fontWeight: 800,
          fontFamily: 'Rubik, sans-serif',
          color: displayBannerUrl ? '#fff' : (isDark ? palette.accent : '#1a1c24'),
          textShadow: displayBannerUrl
            ? '0 1px 4px rgba(0,0,0,0.6)'
            : (isDark ? '0 0 4px rgba(255, 215, 0, 0.3)' : 'none'),
          letterSpacing: '-0.02em',
          zIndex: 2,
        }}>
          Street Profile
        </div>

        {/* Banner edit overlay — top-right */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 2 }}>
          <button
            type="button"
            onClick={handleBannerUploadClick}
            title="Change banner"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.7)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.5)'; }}
          >
            <IconCamera size={16} color="#fff" />
          </button>
          {displayBannerUrl && (
            <button
              type="button"
              onClick={handleBannerRemove}
              title="Remove banner"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(220,38,38,0.7)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(0,0,0,0.5)'; }}
            >
              <IconX size={14} color="#fff" />
            </button>
          )}
        </div>
      </div>

      {/* Avatar + info below banner */}
      <div style={{
        padding: isMobile ? '0 12px' : '0 20px',
        position: 'relative',
        marginTop: isMobile ? '-48px' : '-60px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          gap: isMobile ? 12 : 0,
        }}>
          {/* 120px avatar circle */}
          <div style={{
            width: isMobile ? '92px' : '120px',
            height: isMobile ? '92px' : '120px',
            padding: '4px',
            background: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '50%',
            border: `2px solid ${palette.accent}`,
            boxShadow: palette.glassShadow,
            flexShrink: 0,
          }}>
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt={`${displayName} avatar`}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: palette.surface,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? 28 : 36,
                fontWeight: 700,
                fontFamily: 'Rubik, sans-serif',
                color: palette.accent,
                letterSpacing: '-0.02em',
              }}>
                {initials}
              </div>
            )}
          </div>

          {/* Edit Profile button */}
          <button
            onClick={() => {
              if (isSettingsTab) return;
              setActiveMainTab('settings');
              setActiveSettingsSubTab('edit-profile');
            }}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              border: `1px solid ${isSettingsTab ? palette.accent : palette.border}`,
              backgroundColor: isSettingsTab
                ? isDark ? 'rgba(255, 214, 0, 0.15)' : 'rgba(255, 214, 0, 0.2)'
                : palette.surface,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: isSettingsTab ? palette.accent : palette.textPrimary,
              fontFamily: 'Rubik, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSettingsTab ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              boxShadow: isSettingsTab ? `0 0 16px ${palette.accentGlow}` : palette.glassShadow,
              alignSelf: isMobile ? 'flex-end' : 'auto',
            }}
          >
            {isSettingsTab ? 'EDITING' : 'EDIT PROFILE'}
          </button>
        </div>

        {/* Name, handle, bio, metadata, stats */}
        <div style={{ marginTop: isMobile ? '6px' : '10px' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '1.8rem',
            fontWeight: 800,
            fontFamily: 'Rubik, sans-serif',
            color: palette.textPrimary,
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            {displayName}
          </h1>

          <div style={{
            color: palette.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: '14px',
            marginTop: '2px',
          }}>
            {displayHandle}
          </div>

          <p style={{
            color: palette.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: isMobile ? '13px' : '14px',
            lineHeight: '22px',
            maxWidth: '600px',
            margin: '10px 0 15px 0',
          }}>
            {displayBio}
          </p>

          {/* Metadata row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: isMobile ? '10px' : '16px',
            alignItems: 'center',
            marginBottom: '15px',
          }}>
            {displayOrg && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: palette.textSecondary,
                fontFamily: 'Rubik, sans-serif',
                fontSize: '13px',
              }}>
                <IconBuilding size={14} color={palette.textMuted} />
                {displayOrg}
              </span>
            )}
            {displayLocation && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: palette.textSecondary,
                fontFamily: 'Rubik, sans-serif',
                fontSize: '13px',
              }}>
                <IconMapPin size={14} color={palette.textMuted} />
                {displayLocation}
              </span>
            )}
            {displayWebsite && (
              <a
                href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: palette.accent,
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                <IconLink size={14} color={palette.accent} />
                {displayWebsite}
              </a>
            )}
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: palette.textSecondary,
              fontFamily: 'Rubik, sans-serif',
              fontSize: '13px',
            }}>
              <IconCalendar size={14} color={palette.textMuted} />
              Joined {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '20px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
              color: palette.textPrimary,
            }}>
              <strong style={{ fontWeight: 700 }}>0</strong>
              <span style={{ color: palette.textSecondary, marginLeft: 4 }}>Following</span>
            </span>
            <span style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
              color: palette.textPrimary,
            }}>
              <strong style={{ fontWeight: 700 }}>0</strong>
              <span style={{ color: palette.textSecondary, marginLeft: 4 }}>Followers</span>
            </span>
            <span style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
              color: palette.textPrimary,
            }}>
              <strong style={{ fontWeight: 700 }}>0</strong>
              <span style={{ color: palette.textSecondary, marginLeft: 4 }}>Posts</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Main Tab Bar
  // -------------------------------------------------------------------------

  const renderMainTabBar = () => (
    <div
      ref={tabBarRef}
      style={{
        marginBottom: isMobile ? '14px' : '20px',
        borderRadius: isMobile ? 18 : 24,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.cardBg,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: palette.glassShadow,
        padding: isMobile ? '5px' : '6px',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        gap: 2,
      }}
    >
      {/* Content tabs */}
      {filteredMainTabs.map((tab) => {
        const isActive = activeMainTab === tab.id;
        const isHovered = hoveredMainTab === tab.id;
        const TabIcon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveMainTab(tab.id)}
            onMouseEnter={() => setHoveredMainTab(tab.id)}
            onMouseLeave={() => setHoveredMainTab(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 18,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary,
              backgroundColor: isActive
                ? isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.18)'
                : isHovered
                  ? palette.surfaceHover
                  : 'transparent',
              borderBottom: isActive ? `2px solid ${palette.accent}` : '2px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: isActive ? `0 0 12px ${palette.accentGlow}` : 'none',
            }}
          >
            <TabIcon size={14} color={isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary} />
            {tab.label}
          </button>
        );
      })}

      {/* Separator */}
      <div style={{
        width: 1,
        height: 24,
        backgroundColor: palette.border,
        margin: '0 6px',
        flexShrink: 0,
      }} />

      {/* Settings tab */}
      {(() => {
        const isActive = activeMainTab === 'settings';
        const isHovered = hoveredMainTab === 'settings';
        return (
          <button
            onClick={() => setActiveMainTab('settings')}
            onMouseEnter={() => setHoveredMainTab('settings')}
            onMouseLeave={() => setHoveredMainTab(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 18,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary,
              backgroundColor: isActive
                ? isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.18)'
                : isHovered
                  ? palette.surfaceHover
                  : 'transparent',
              borderBottom: isActive ? `2px solid ${palette.accent}` : '2px solid transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: isActive ? `0 0 12px ${palette.accentGlow}` : 'none',
            }}
          >
            <IconSettings size={14} color={isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary} />
            Settings
          </button>
        );
      })()}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Tab Content Placeholder (for non-settings tabs)
  // -------------------------------------------------------------------------

  const renderPlaceholderContent = (tabId: MainTabId) => {
    const profileTabConfig: Record<string, { icon: typeof IconMessageSquare; title: string; desc: string; cta: string; href: string }> = {
      timeline: { icon: IconMessageSquare, title: 'Your Timeline', desc: 'Recent activity, posts, and interactions across Street Voices.', cta: 'Go to Word on the Street', href: '/word-on-the-street' },
      jobs: { icon: IconBookmark, title: 'Saved Jobs', desc: 'Jobs you\'ve saved or applied to will appear here.', cta: 'Browse Jobs', href: '/jobs' },
      news: { icon: IconTrendingUp, title: 'News & Articles', desc: 'Articles you\'ve bookmarked or shared.', cta: 'Read News', href: '/news' },
      services: { icon: IconGlobe, title: 'My Services', desc: 'Services you\'ve saved or used from the community directory.', cta: 'Browse Directory', href: '/directory' },
      gallery: { icon: IconGrid, title: 'Gallery', desc: 'Photos and artwork you\'ve shared with the community.', cta: 'Visit Gallery', href: '/gallery' },
      about: { icon: IconInfo, title: 'About', desc: '', cta: 'Edit Profile', href: '' },
      communities: { icon: IconUsers, title: 'Communities', desc: 'Groups and communities you\'re part of.', cta: 'Explore Groups', href: '/groups' },
      portfolio: { icon: IconBriefcase, title: 'Portfolio', desc: 'Your skills, certifications, and work samples.', cta: 'View Academy', href: '/academy' },
      messages: { icon: IconMessageSquare, title: 'Messages', desc: 'Your recent conversations.', cta: 'Open Messages', href: '/messages' },
      tasks: { icon: IconListTodo, title: 'Tasks', desc: 'Your assigned tasks and projects.', cta: 'Open Tasks', href: '/tasks' },
      calendar: { icon: IconCalendar, title: 'Calendar', desc: 'Your upcoming events.', cta: 'Open Calendar', href: '/calendar' },
      documents: { icon: IconFileText, title: 'Documents', desc: 'Your recent documents.', cta: 'Open Documents', href: '/documents' },
    };
    const cfg = profileTabConfig[tabId] || profileTabConfig.timeline;
    const TabIcon = cfg.icon;

    // Hub tabs: Messages, Tasks, Calendar, Documents — render live summaries
    const hubUserId = user?.id || '';
    if (tabId === 'messages') {
      return <MessagesSummary palette={palette} isDark={isDark} isMobile={isMobile} cardStyle={settingsCardStyle} buttonStyle={settingsActionButtonStyle} navigate={navigate} userId={hubUserId} />;
    }
    if (tabId === 'tasks') {
      return <TasksSummary palette={palette} isDark={isDark} isMobile={isMobile} cardStyle={settingsCardStyle} buttonStyle={settingsActionButtonStyle} navigate={navigate} userId={hubUserId} />;
    }
    if (tabId === 'calendar') {
      return <CalendarSummary palette={palette} isDark={isDark} isMobile={isMobile} cardStyle={settingsCardStyle} buttonStyle={settingsActionButtonStyle} navigate={navigate} userId={hubUserId} />;
    }
    if (tabId === 'documents') {
      return <DocumentsSummary palette={palette} isDark={isDark} isMobile={isMobile} cardStyle={settingsCardStyle} buttonStyle={settingsActionButtonStyle} navigate={navigate} userId={hubUserId} />;
    }

    // New unified tabs: Storage, Social Media, Contacts, Activity
    if (tabId === 'storage') {
      return (
        <div style={{ width: '100%', height: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 180px)', borderRadius: 12, overflow: 'hidden', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
          <iframe src={`/storage?embed=true&theme=${isDark ? 'dark' : 'light'}`} title="Storage" style={{ width: '100%', height: '100%', border: 'none', backgroundColor: isDark ? '#171717' : '#fff' }} />
        </div>
      );
    }
    if (tabId === 'social-media') {
      return (
        <div style={{ width: '100%', height: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 180px)', borderRadius: 12, overflow: 'hidden', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
          <iframe src={`/social-media?embed=true&theme=${isDark ? 'dark' : 'light'}`} title="Social Media" style={{ width: '100%', height: '100%', border: 'none', backgroundColor: isDark ? '#171717' : '#fff' }} />
        </div>
      );
    }
    if (tabId === 'contacts') {
      return (
        <div style={{ width: '100%', height: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 180px)', borderRadius: 12, overflow: 'hidden', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
          <iframe src={`/directory?embed=true&theme=${isDark ? 'dark' : 'light'}`} title="Contacts" style={{ width: '100%', height: '100%', border: 'none', backgroundColor: isDark ? '#171717' : '#fff' }} />
        </div>
      );
    }
    if (tabId === 'activity') {
      return (
        <div style={{ ...settingsCardStyle, padding: '48px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: isDark ? 'rgba(255, 214, 0, 0.1)' : 'rgba(255, 214, 0, 0.15)', border: `1px solid ${isDark ? 'rgba(255, 214, 0, 0.2)' : 'rgba(255, 214, 0, 0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconActivity size={28} color={palette.accent} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Rubik, sans-serif', color: palette.textPrimary }}>Activity Feed</h3>
          <p style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '14px', maxWidth: 400, margin: 0 }}>
            Your recent activity across all features — messages sent, tasks completed, posts published, and more.
          </p>
          <p style={{ color: palette.textMuted, fontFamily: 'Rubik, sans-serif', fontSize: '13px', fontStyle: 'italic' }}>Coming soon</p>
        </div>
      );
    }

    // Special case: "Services" tab shows user's saved/favorited services
    if (tabId === 'services') {
      if (savedServicesLoading) {
        return (
          <div style={{ ...settingsCardStyle, padding: '48px 40px', textAlign: 'center' }}>
            <p style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif' }}>Loading saved services...</p>
          </div>
        );
      }
      if (savedServices.length === 0) {
        return (
          <div style={{ ...settingsCardStyle, padding: '48px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: isDark ? 'rgba(255, 214, 0, 0.1)' : 'rgba(255, 214, 0, 0.15)', border: `1px solid ${isDark ? 'rgba(255, 214, 0, 0.2)' : 'rgba(255, 214, 0, 0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconGlobe size={28} color={palette.accent} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Rubik, sans-serif', color: palette.textPrimary }}>No Saved Services</h3>
            <p style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '14px', maxWidth: 400, margin: 0 }}>
              Save services from the Directory to see them here.
            </p>
            <button onClick={() => navigate('/directory')} style={{ ...settingsActionButtonStyle, marginTop: 8, backgroundColor: palette.accent, color: '#000', cursor: 'pointer' }}>Browse Directory</button>
          </div>
        );
      }

      const formatPhone = (phone?: string) => {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        if (digits.length === 11) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        return phone;
      };

      const handleUnsave = async (serviceId: number) => {
        try {
          const resp = await fetch(`/sbapi/services/${serviceId}/favorite?user_id=${encodeURIComponent(favoritesUserId)}`, { method: 'DELETE' });
          if (resp.ok) {
            setSavedServices((prev) => prev.filter((s) => s.id !== serviceId));
          }
        } catch { /* ignore */ }
      };

      const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)';
      const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Rubik, sans-serif', color: palette.textPrimary }}>
              Saved Services ({savedServices.length})
            </h3>
            <button onClick={() => navigate('/directory')} style={{ ...settingsActionButtonStyle, backgroundColor: 'transparent', color: palette.accent, border: `1px solid ${palette.accent}`, cursor: 'pointer', fontSize: 12, padding: '6px 14px' }}>
              Browse Directory
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {savedServices.map((svc) => (
              <div key={svc.id} style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 24,
                overflow: 'hidden',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}>
                {/* Logo Banner */}
                <div style={{
                  position: 'relative',
                  height: 160,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: `1px solid ${cardBorder}`,
                }}>
                  <img
                    src={svc.logo || '/service-logos/default.svg'}
                    alt={svc.name}
                    loading="lazy"
                    style={{ maxWidth: '80%', maxHeight: 120, width: 'auto', height: 'auto', objectFit: 'contain' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/service-logos/default.svg'; }}
                  />
                  {/* Category badge */}
                  {svc.category_names?.[0] && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 600, color: '#000', background: palette.accent,
                    }}>
                      {svc.category_names[0]}
                    </div>
                  )}
                  {/* Unsave button */}
                  <button
                    onClick={() => handleUnsave(svc.id)}
                    title="Remove from saved"
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      height: 34, width: 34, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                  {/* Verified badge */}
                  {svc.is_verified && (
                    <div style={{
                      position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 20,
                      background: '#3b82f6', fontSize: 11, fontWeight: 600, color: '#fff',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Verified
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: 18 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px', textAlign: 'center', color: palette.textPrimary, fontFamily: 'Rubik, sans-serif' }}>
                    {svc.name}
                  </h3>
                  <p style={{
                    fontSize: 13, lineHeight: 1.5, marginBottom: 12, textAlign: 'center',
                    color: palette.textSecondary, fontFamily: 'Rubik, sans-serif',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {svc.overview || svc.description || 'Community service provider'}
                  </p>

                  {/* Tags */}
                  {svc.tags && svc.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                      {svc.tags.slice(0, 4).map((tag, idx) => (
                        <span key={idx} style={{
                          display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                          borderRadius: 9999, fontSize: 11, fontWeight: 500,
                          background: 'rgba(255, 214, 0, 0.15)', color: palette.accent,
                        }}>{tag}</span>
                      ))}
                      {svc.tags.length > 4 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 9999, fontSize: 11, background: 'rgba(255,255,255,0.1)', color: palette.textMuted }}>
                          +{svc.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contact info summary */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, marginBottom: 14, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ flexShrink: 0, marginTop: 2 }}><IconMapPin size={16} color={palette.accent} /></span>
                      <span style={{ fontSize: 13, color: palette.textPrimary, lineHeight: 1.4 }}>
                        {svc.address || svc.city || 'Location not available'}
                      </span>
                    </div>
                    {svc.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flexShrink: 0 }}><IconBell size={16} color={palette.accent} /></span>
                        <a href={`tel:${svc.phone.replace(/\D/g, '')}`} style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
                          {formatPhone(svc.phone)}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: `1px solid ${cardBorder}` }}>
                    {svc.phone && (
                      <button
                        onClick={() => { window.location.href = `tel:${svc.phone}`; }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: 'none', cursor: 'pointer',
                        }}
                      >
                        <IconBell size={14} /> Call
                      </button>
                    )}
                    {svc.address && (
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(svc.address || '')}`, '_blank')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'none', cursor: 'pointer',
                        }}
                      >
                        <IconMapPin size={14} /> Directions
                      </button>
                    )}
                    {svc.website && (
                      <a
                        href={svc.website.startsWith('http') ? svc.website : `https://${svc.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          background: 'rgba(255, 214, 0, 0.15)', color: palette.accent, textDecoration: 'none',
                        }}
                      >
                        <IconGlobe size={14} /> Website
                      </a>
                    )}
                    {svc.rating && svc.rating > 0 && (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={palette.accent} stroke={palette.accent} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 500, color: palette.textPrimary }}>{svc.rating.toFixed(1)}</span>
                        {svc.rating_count && <span style={{ fontSize: 12, color: palette.textMuted }}>({svc.rating_count})</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Special case: "About" tab shows actual profile info
    if (tabId === 'about') {
      return (
        <div style={{ ...settingsCardStyle, padding: '32px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Rubik, sans-serif', color: palette.textPrimary }}>About {displayName}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {displayBio && <p style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '15px', lineHeight: '24px', margin: 0 }}>{displayBio}</p>}
            {displayOrg && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary, fontSize: '14px' }}><IconBuilding size={16} /> {displayOrg}</div>}
            {displayLocation && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary, fontSize: '14px' }}><IconMapPin size={16} /> {displayLocation}</div>}
            {displayWebsite && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary, fontSize: '14px' }}><IconGlobe size={16} /> <a href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} target="_blank" rel="noopener noreferrer" style={{ color: palette.accent }}>{displayWebsite}</a></div>}
            {userSettings.profile.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary, fontSize: '14px' }}><IconBell size={16} /> {userSettings.profile.email}</div>}
            {userSettings.profile.pronouns && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.textSecondary, fontSize: '14px' }}><IconUser size={16} /> {userSettings.profile.pronouns}</div>}
          </div>
          <button onClick={() => { setActiveMainTab('settings'); setActiveSettingsSubTab('edit-profile'); }} style={{ ...settingsActionButtonStyle, marginTop: 24, backgroundColor: palette.accent, color: '#000' }}>Edit Profile</button>
        </div>
      );
    }

    return (
      <div style={{
        ...settingsCardStyle,
        padding: '48px 40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: isDark ? 'rgba(255, 214, 0, 0.1)' : 'rgba(255, 214, 0, 0.15)',
          border: `1px solid ${isDark ? 'rgba(255, 214, 0, 0.2)' : 'rgba(255, 214, 0, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <TabIcon size={28} color={palette.accent} />
        </div>
        <h3 style={{
          margin: 0,
          fontSize: '1.2rem',
          fontWeight: 700,
          fontFamily: 'Rubik, sans-serif',
          color: palette.textPrimary,
        }}>
          {cfg.title}
        </h3>
        <p style={{
          color: palette.textSecondary,
          fontFamily: 'Rubik, sans-serif',
          fontSize: '14px',
          lineHeight: '22px',
          maxWidth: 400,
          margin: 0,
        }}>
          {cfg.desc}
        </p>
        <button
          onClick={() => navigate(cfg.href)}
          style={{
            ...settingsActionButtonStyle,
            marginTop: 8,
            backgroundColor: palette.accent,
            color: '#000',
            cursor: 'pointer',
          }}
        >
          {cfg.cta}
        </button>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Settings Sub-Tab Content
  // -------------------------------------------------------------------------

  const renderSettingsSubTabContent = () => {
    const profile = userSettings.profile;

    // --- Edit Profile ---
    if (activeSettingsSubTab === 'edit-profile') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Banner */}
          <div>
            <h3 style={{
              margin: '0 0 8px 0',
              color: palette.textPrimary,
              fontSize: 18,
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
            }}>
              Profile Banner
            </h3>
            <p style={settingsHelperTextStyle}>
              Displayed at the top of your profile. Recommended size: 1200x400px.
            </p>
            <div style={{
              width: '100%',
              height: 100,
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${palette.border}`,
              background: displayBannerUrl ? `url(${displayBannerUrl})` : palette.headerBg,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginTop: 8,
              marginBottom: 10,
            }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleBannerUploadClick}
                style={{
                  ...settingsActionButtonStyle,
                  backgroundColor: palette.accent,
                  color: '#000',
                  border: 'none',
                }}
              >
                Upload Banner
              </button>
              {userSettings.profile.bannerUrl && (
                <button
                  onClick={handleBannerRemove}
                  style={{
                    ...settingsActionButtonStyle,
                    color: '#f87171',
                    borderColor: '#f87171',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 8 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt={`${displayName} avatar`}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `2px solid ${palette.accent}`,
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: `2px solid ${palette.accent}`,
                  backgroundColor: palette.surface,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  color: palette.accent,
                  boxShadow: palette.glassShadow,
                }}>
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={handleAvatarUploadClick}
                style={{
                  position: 'absolute',
                  right: -8,
                  bottom: -8,
                  borderRadius: 999,
                  border: `1px solid ${palette.border}`,
                  backgroundColor: isDark ? palette.surface : palette.surface,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  color: palette.textPrimary,
                  padding: '5px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  boxShadow: palette.glassShadow,
                  transition: 'all 0.2s ease',
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                Upload
              </button>
            </div>
            <div>
              <h3 style={{
                margin: 0,
                color: palette.textPrimary,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'Rubik, sans-serif',
              }}>
                Profile Photo
              </h3>
              <p style={settingsHelperTextStyle}>
                This is displayed on your profile and posts.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={handleAvatarUploadClick}
                  style={{
                    ...settingsActionButtonStyle,
                    backgroundColor: palette.accent,
                    color: '#000',
                    border: 'none',
                  }}
                >
                  Upload Photo
                </button>
                {profile.avatarUrl && (
                  <button
                    onClick={handleAvatarRemove}
                    style={{
                      ...settingsActionButtonStyle,
                      color: '#f87171',
                      borderColor: '#f87171',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Profile fields grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {PROFILE_TEXT_FIELDS.map((field) => (
              <label key={field.key} style={{ display: 'block' }}>
                <span style={settingsLabelStyle}>{field.label}</span>
                <input
                  type={field.type ?? 'text'}
                  value={(profile[field.key] as string) ?? ''}
                  onChange={(e) => handleProfileFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={settingsInputStyle}
                />
              </label>
            ))}
          </div>

          {/* Bio */}
          <label style={{ display: 'block' }}>
            <span style={settingsLabelStyle}>Bio</span>
            <textarea
              value={profile.bio}
              onChange={(e) => handleProfileFieldChange('bio', e.target.value)}
              style={settingsTextareaStyle}
              placeholder="Tell the world about yourself..."
            />
          </label>

          {/* Timezone */}
          <label style={{ display: 'block' }}>
            <span style={settingsLabelStyle}>Timezone</span>
            <select
              value={profile.timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              style={settingsInputStyle}
            >
              <option value="" style={{ color: '#000' }}>Select timezone</option>
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option} style={{ color: '#000' }}>{option}</option>
              ))}
            </select>
          </label>

        </div>
      );
    }

    // --- Account ---
    if (activeSettingsSubTab === 'account') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Contact info card */}
          <div style={settingsCardStyle}>
            {renderSectionHeading('Contact Information', 'Your account details and contact preferences.')}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: `1px solid ${palette.softBorder}`,
              }}>
                <span style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '13px' }}>Email</span>
                <span style={{ color: palette.textPrimary, fontFamily: 'Rubik, sans-serif', fontSize: '13px', fontWeight: 500 }}>
                  {user?.email || userSettings.profile.email || 'Not set'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: `1px solid ${palette.softBorder}`,
              }}>
                <span style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '13px' }}>Username</span>
                <span style={{ color: palette.textPrimary, fontFamily: 'Rubik, sans-serif', fontSize: '13px', fontWeight: 500 }}>
                  {user?.username || 'Not set'}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
              }}>
                <span style={{ color: palette.textSecondary, fontFamily: 'Rubik, sans-serif', fontSize: '13px' }}>Phone</span>
                <span style={{ color: palette.textPrimary, fontFamily: 'Rubik, sans-serif', fontSize: '13px', fontWeight: 500 }}>
                  {userSettings.profile.phone || 'Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Notification toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {renderSectionHeading('Notifications', 'Control how and when you receive updates.')}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderToggleRow('Email Notifications', 'Receive updates via email.', userSettings.notifications.emailNotifications, () => handleNotificationToggle('emailNotifications'))}
              {renderToggleRow('Push Notifications', 'Enable browser push alerts.', userSettings.notifications.pushNotifications, () => handleNotificationToggle('pushNotifications'))}
              {renderToggleRow('Weekly Summary', 'Weekly digest of your activity.', userSettings.notifications.weeklySummary, () => handleNotificationToggle('weeklySummary'))}
              {renderToggleRow('Escalation Alerts', 'Alerts for high-priority cases.', userSettings.notifications.escalationAlerts, () => handleNotificationToggle('escalationAlerts'))}
              {renderToggleRow('Product Updates', 'New features and announcements.', userSettings.notifications.productUpdates, () => handleNotificationToggle('productUpdates'))}
            </div>
          </div>

          {/* Logout */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={handleLogout}
              style={{
                ...settingsActionButtonStyle,
                color: '#f87171',
                borderColor: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <IconLogOut size={14} color="#f87171" />
              Log Out
            </button>
          </div>
        </div>
      );
    }

    // --- Appearance ---
    if (activeSettingsSubTab === 'appearance') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            {renderSectionHeading('Theme', 'Choose your preferred color scheme.')}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => handlePreferredThemeSelect(option)}
                  style={{
                    ...settingsActionButtonStyle,
                    backgroundColor: userSettings.appearance.preferredTheme === option
                      ? palette.accent
                      : isDark ? '#1a1a1a' : '#e5e7eb',
                    color: userSettings.appearance.preferredTheme === option ? '#000' : palette.textPrimary,
                    border: userSettings.appearance.preferredTheme === option
                      ? 'none'
                      : `1px solid ${palette.border}`,
                    minWidth: 100,
                    boxShadow: userSettings.appearance.preferredTheme === option
                      ? `0 0 16px ${palette.accentGlow}`
                      : palette.glassShadow,
                  }}
                >
                  {option === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </div>

          <div>
            {renderSectionHeading('Font Size', 'Adjust text size for readability.')}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {FONT_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handleFontSizeSelect(size)}
                  style={{
                    ...settingsActionButtonStyle,
                    backgroundColor: userSettings.appearance.fontSize === size
                      ? palette.accent
                      : isDark ? '#1a1a1a' : '#e5e7eb',
                    color: userSettings.appearance.fontSize === size ? '#000' : palette.textPrimary,
                    border: userSettings.appearance.fontSize === size
                      ? 'none'
                      : `1px solid ${palette.border}`,
                    minWidth: 100,
                    boxShadow: userSettings.appearance.fontSize === size
                      ? `0 0 16px ${palette.accentGlow}`
                      : palette.glassShadow,
                  }}
                >
                  {size === 'normal' ? 'Normal' : 'Large'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderSectionHeading('Interface', 'Customize your experience.')}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {renderToggleRow('Compact Layout', 'Show more content with less spacing.', userSettings.appearance.compactUI, () => handleAppearanceToggle('compactUI'))}
              {renderToggleRow('Typing Animation', 'Show animated typing indicators.', userSettings.appearance.showTypingAnimation, () => handleAppearanceToggle('showTypingAnimation'))}
            </div>
          </div>
        </div>
      );
    }

    // --- Location ---
    if (activeSettingsSubTab === 'sb-location') {
      const currentLocationLabel = userLocation?.label ?? 'No location set';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {renderSectionHeading('Location Helper', 'Control the floating location panel.')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderToggleRow('Show Floating Helper', 'Display location popup above composer.', userSettings.location.showHelperPanel, () => handleLocationPreferenceToggle('showHelperPanel'))}
            {renderToggleRow('Auto-hide After Setting', 'Close helper once location is set.', userSettings.location.autoHideAfterSet, () => handleLocationPreferenceToggle('autoHideAfterSet'))}
          </div>

          <div style={{ ...settingsCardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {renderSectionHeading('Your Location', 'Set your location for nearby services.')}
            <label style={{ display: 'block' }}>
              <span style={settingsLabelStyle}>Default City</span>
              <input
                type="text"
                value={userSettings.location.defaultCity}
                onChange={(e) => handleLocationDefaultCityChange(e.target.value)}
                placeholder="City or region"
                style={settingsInputStyle}
              />
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                onClick={handleApplyDefaultCity}
                disabled={!userSettings.location.defaultCity.trim() || isResolvingLocation}
                style={{
                  ...settingsActionButtonStyle,
                  backgroundColor: palette.accent,
                  color: '#000',
                  border: 'none',
                  opacity: !userSettings.location.defaultCity.trim() || isResolvingLocation ? 0.5 : 1,
                }}
              >
                Set as Location
              </button>
              <button
                onClick={handleUseMyLocation}
                disabled={isResolvingLocation}
                style={{
                  ...settingsActionButtonStyle,
                  color: palette.textPrimary,
                  backgroundColor: isDark ? palette.surface : 'rgba(0, 0, 0, 0.08)',
                  borderColor: palette.border,
                  opacity: isResolvingLocation ? 0.5 : 1,
                }}
              >
                Use Exact GPS Location
              </button>
            </div>

            {locationStatus && (
              <p style={{ color: palette.accent, fontSize: 13, fontFamily: 'Rubik, sans-serif' }}>
                {locationStatus}
              </p>
            )}
            {locationError && (
              <p style={{ color: '#f87171', fontSize: 13, fontFamily: 'Rubik, sans-serif' }}>
                {locationError}
              </p>
            )}

            <div>
              <p style={settingsLabelStyle}>Current Location</p>
              <p style={{ color: palette.textPrimary, fontSize: 14, fontFamily: 'Rubik, sans-serif' }}>
                {currentLocationLabel}
              </p>
              {userLocation && (
                <p style={{ color: palette.textSecondary, fontSize: 12, marginTop: 4, fontFamily: 'Rubik, sans-serif' }}>
                  Coordinates: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                </p>
              )}
            </div>

            <form onSubmit={handleManualLocationSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={manualLocationInput}
                onChange={(e) => setManualLocationInput(e.target.value)}
                placeholder="Search for a location..."
                disabled={isResolvingLocation}
                style={{ ...settingsInputStyle, flex: 1, minWidth: 220 }}
              />
              <button
                type="submit"
                disabled={isResolvingLocation || !manualLocationInput.trim()}
                style={{
                  ...settingsActionButtonStyle,
                  backgroundColor: palette.accent,
                  color: '#000',
                  border: 'none',
                  opacity: isResolvingLocation || !manualLocationInput.trim() ? 0.5 : 1,
                }}
              >
                Search
              </button>
            </form>

            {userLocation && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                backgroundColor: isDark ? '#111' : 'rgba(0,0,0,0.06)',
                borderRadius: 12,
              }}>
                <label style={{ color: palette.textSecondary, fontSize: 12, fontFamily: 'Rubik, sans-serif' }}>
                  Radius:
                </label>
                <select
                  value={userLocation.radiusKm}
                  onChange={handleRadiusChange}
                  style={{ ...settingsInputStyle, width: 'auto', padding: '8px 12px' }}
                >
                  {LOCATION_RADIUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} style={{ color: '#000' }}>+/-{opt} km</option>
                  ))}
                </select>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: palette.textSecondary,
                  fontFamily: 'Rubik, sans-serif',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={userSettings.location.ignoreRadiusFilter}
                    onChange={() => handleLocationPreferenceToggle('ignoreRadiusFilter')}
                  />
                  Show all services
                </label>
                <button
                  onClick={handleClearLocation}
                  style={{
                    ...settingsActionButtonStyle,
                    color: palette.textPrimary,
                    backgroundColor: isDark ? palette.surface : 'rgba(0, 0, 0, 0.08)',
                    borderColor: palette.border,
                    padding: '6px 16px',
                    fontSize: 12,
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // --- Workspace ---
    if (activeSettingsSubTab === 'workspace') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderSectionHeading('Case Workflow', 'Control how cases and tasks are managed.')}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderToggleRow('Auto-assign New Cases', 'Automatically create tasks for new cases.', userSettings.workspace.autoAssignCases, () => handleWorkspaceToggle('autoAssignCases'))}
            {renderToggleRow('Share Live Status', 'Let teammates see when you\'re active.', userSettings.workspace.shareStatusWithTeam, () => handleWorkspaceToggle('shareStatusWithTeam'))}
            {renderToggleRow('Show Agent Hand-offs', 'Display when specialist agents are involved.', userSettings.workspace.showAgentHandOffs, () => handleWorkspaceToggle('showAgentHandOffs'))}
          </div>
        </div>
      );
    }

    // --- Privacy ---
    if (activeSettingsSubTab === 'privacy') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderSectionHeading('Privacy Settings', 'Control who can see your profile and interact with you.')}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderToggleRow('Private Profile', 'Only approved followers can see your posts.', userSettings.privacy.privateProfile, () => handlePrivacyToggle('privateProfile'))}
            {renderToggleRow('Show Online Status', 'Let others see when you\'re active.', userSettings.privacy.showOnlineStatus, () => handlePrivacyToggle('showOnlineStatus'))}
            {renderToggleRow('Allow Messages from Anyone', 'Receive messages from people you don\'t follow.', userSettings.privacy.allowMessagesFromAnyone, () => handlePrivacyToggle('allowMessagesFromAnyone'))}
          </div>
        </div>
      );
    }

    // --- Data ---
    if (activeSettingsSubTab === 'sb-data') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {renderSectionHeading('Data & Sync', 'Manage your data preferences and exports.')}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {renderToggleRow('Sync to Cloud', 'Back up your settings and preferences to the cloud.', userSettings.data.syncToCloud, () => handleDataToggle('syncToCloud'))}
            {renderToggleRow('Analytics Opt-in', 'Help improve Street Voices by sharing usage data.', userSettings.data.analyticsOptIn, () => handleDataToggle('analyticsOptIn'))}
            {renderToggleRow('Crash Reports', 'Automatically send crash reports for debugging.', userSettings.data.crashReports, () => handleDataToggle('crashReports'))}
          </div>

          <div style={settingsCardStyle}>
            {renderSectionHeading('Export & Delete', 'Download or permanently remove your data.')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              <button
                onClick={handleExportData}
                style={{
                  ...settingsActionButtonStyle,
                  backgroundColor: palette.accent,
                  color: '#000',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconDownload size={14} color="#000" />
                Export All Data
              </button>
              <button
                onClick={handleDeleteAllData}
                style={{
                  ...settingsActionButtonStyle,
                  color: '#f87171',
                  borderColor: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <IconTrash size={14} color="#f87171" />
                Delete All Data
              </button>
            </div>
            <p style={{ ...settingsHelperTextStyle, marginTop: 12 }}>
              Exporting will download a JSON file with all your settings, preferences, and location data.
              Deleting will permanently remove all locally stored Street Voices data.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  // -------------------------------------------------------------------------
  // Render: LibreChat Settings Content
  // -------------------------------------------------------------------------

  const renderLibreChatSettingsContent = () => {
    const wrapStyle: CSSProperties = { padding: '0 4px' };
    switch (activeLibreChatTab) {
      case 'lc-general':
        return <div style={wrapStyle}><General /></div>;
      case 'lc-chat':
        return <div style={wrapStyle}><Chat /></div>;
      case 'lc-commands':
        return <div style={wrapStyle}><Commands /></div>;
      case 'lc-speech':
        return <div style={wrapStyle}><Speech /></div>;
      case 'lc-personalization':
        return <div style={wrapStyle}><Personalization hasMemoryOptOut={hasMemoryOptOut} hasAnyPersonalizationFeature={hasAnyPersonalizationFeature} /></div>;
      case 'lc-data':
        return <div style={wrapStyle}><Data /></div>;
      case 'lc-balance':
        return <div style={wrapStyle}><Balance /></div>;
      case 'lc-account':
        return <div style={wrapStyle}><Account /></div>;
      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render: Settings Content (full settings tab with sidebar)
  // -------------------------------------------------------------------------

  const renderSettingsContent = () => {
    return (
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 14 : 24,
        minHeight: isMobile ? 'auto' : 500,
      }}>
        {/* Settings sidebar (200px) */}
        <nav style={{
          width: isMobile ? '100%' : 200,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          borderRadius: isMobile ? 16 : 20,
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.cardBg,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: palette.glassShadow,
          padding: isMobile ? '12px 8px' : '16px 10px',
          alignSelf: isMobile ? 'stretch' : 'flex-start',
          position: isMobile ? 'static' : 'sticky',
          top: isMobile ? undefined : 20,
        }}>
          {/* SBP settings heading */}
          <p style={{
            margin: '0 0 4px 14px',
            color: palette.textMuted,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'Rubik, sans-serif',
          }}>
            Street Profile
          </p>

          {filteredSettingsSubTabs.map((tab) => {
            const isActive = activeSettingsSubTab === tab.id && activeLibreChatTab === '' as LibreChatTabId;
            const isHovered = hoveredSettingsSubTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSettingsSubTab(tab.id);
                  setActiveLibreChatTab('' as LibreChatTabId);
                }}
                onMouseEnter={() => setHoveredSettingsSubTab(tab.id)}
                onMouseLeave={() => setHoveredSettingsSubTab(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary,
                  backgroundColor: isActive
                    ? isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.18)'
                    : isHovered
                      ? palette.surfaceHover
                      : 'transparent',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  lineHeight: '20px',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 18,
                    borderRadius: 2,
                    backgroundColor: palette.accent,
                  }} />
                )}
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <TabIcon size={16} color={isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary} />
                </span>
                {tab.label}
              </button>
            );
          })}

          {/* LibreChat section — only for admin/designer */}
          {isPrivileged && (<>
          {/* Divider */}
          <div style={{ height: 1, margin: '10px 14px', backgroundColor: palette.border }} />

          {/* LibreChat settings heading */}
          <p style={{
            margin: '0 0 4px 14px',
            color: palette.textMuted,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: 'Rubik, sans-serif',
          }}>
            LibreChat
          </p>

          {libreChatTabs.map((tab) => {
            const isActive = activeLibreChatTab === tab.id;
            const isHovered = hoveredLcTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveLibreChatTab(tab.id);
                  setActiveSettingsSubTab('' as SettingsSubTabId);
                }}
                onMouseEnter={() => setHoveredLcTab(tab.id)}
                onMouseLeave={() => setHoveredLcTab(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary,
                  backgroundColor: isActive
                    ? isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.18)'
                    : isHovered
                      ? palette.surfaceHover
                      : 'transparent',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  lineHeight: '20px',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 18,
                    borderRadius: 2,
                    backgroundColor: palette.accent,
                  }} />
                )}
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <TabIcon size={16} color={isActive ? palette.accent : isHovered ? palette.textPrimary : palette.textSecondary} />
                </span>
                {tab.label}
              </button>
            );
          })}
          </>)}
        </nav>

        {/* Settings content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          borderRadius: isMobile ? 16 : 20,
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.cardBg,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: palette.glassShadow,
          padding: isMobile ? '16px 14px' : '28px 32px',
        }}>
          {/* Content title */}
          <div style={{ marginBottom: isMobile ? 16 : 24 }}>
            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 20,
                  fontWeight: 600,
                  fontFamily: 'Rubik, sans-serif',
                  color: palette.textPrimary,
                }}>
                  {(() => {
                    if (activeLibreChatTab) {
                      const lcTab = libreChatTabs.find((t) => t.id === activeLibreChatTab);
                      return lcTab?.label || 'Settings';
                    }
                    const sbTab = settingsSubTabs.find((t) => t.id === activeSettingsSubTab);
                    return sbTab?.label || 'Settings';
                  })()}
                </h2>
                {!activeLibreChatTab && activeSettingsSubTab === 'edit-profile' && providerAccountType === 'provider' && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 214, 0, 0.18)',
                    color: palette.accent,
                    border: `1px solid ${isDark ? 'rgba(255, 214, 0, 0.28)' : 'rgba(255, 214, 0, 0.34)'}`,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Rubik, sans-serif',
                    alignSelf: 'flex-start',
                  }}>
                    <IconBadgeCheck size={14} color={palette.accent} />
                    Service Provider Profile
                  </div>
                )}
              </div>
              {settingsStatus && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 14px',
                  borderRadius: 999,
                  backgroundColor: isDark ? 'rgba(255, 214, 0, 0.15)' : 'rgba(255, 214, 0, 0.2)',
                  color: isDark ? palette.accent : '#7c6900',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'Rubik, sans-serif',
                  transition: 'opacity 0.3s ease',
                }}>
                  <IconCheck size={14} />
                  {settingsStatus}
                </div>
              )}
            </div>
          </div>

          {/* Render settings content */}
          {activeLibreChatTab ? renderLibreChatSettingsContent() : renderSettingsSubTabContent()}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Tab Content
  // -------------------------------------------------------------------------

  const renderTabContent = () => {
    if (activeMainTab === 'settings') {
      return renderSettingsContent();
    }
    return renderPlaceholderContent(activeMainTab);
  };

  // -------------------------------------------------------------------------
  // Initialize: when entering settings, ensure a sub-tab is selected
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (activeMainTab === 'settings' && !activeSettingsSubTab && !activeLibreChatTab) {
      setActiveSettingsSubTab('edit-profile');
    }
  }, [activeMainTab, activeSettingsSubTab, activeLibreChatTab]);

  // When settings tab is opened for the first time, select edit-profile by default
  useEffect(() => {
    if (activeMainTab === 'settings' && activeSettingsSubTab === '' as SettingsSubTabId && activeLibreChatTab === '' as LibreChatTabId) {
      setActiveSettingsSubTab('edit-profile');
    }
  }, [activeMainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: if role changes and active tabs are no longer visible, reset them
  useEffect(() => {
    if (!isPrivileged) {
      if (!USER_MAIN_TABS.has(activeMainTab)) {
        setActiveMainTab('news');
      }
      if (activeMainTab === 'settings' && !USER_SETTINGS_SUB_TABS.has(activeSettingsSubTab)) {
        setActiveSettingsSubTab('edit-profile');
      }
      // Non-privileged users should never have a LibreChat tab active
      if (activeLibreChatTab) {
        setActiveLibreChatTab('' as LibreChatTabId);
        setActiveSettingsSubTab('edit-profile');
      }
    }
  }, [isPrivileged, activeMainTab, activeSettingsSubTab, activeLibreChatTab, USER_MAIN_TABS, USER_SETTINGS_SUB_TABS]);

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      fontFamily: 'Rubik, sans-serif',
      backgroundColor: palette.background,
      color: palette.textPrimary,
    }}>
      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        padding: isMobile ? '0 10px 40px 10px' : '0 20px 60px 20px',
      }}>
        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: isMobile ? '12px 2px 8px' : '18px 2px 10px',
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: palette.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: isMobile ? 14 : 15 }}>←</span>
          Back to Home
        </button>

        {/* Profile Header */}
        {renderProfileHeader()}

        {/* Tab Bar */}
        {renderMainTabBar()}

        {/* Tab Content */}
        {renderTabContent()}
      </main>
    </div>
  );
}
