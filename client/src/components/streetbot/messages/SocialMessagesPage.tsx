'use client';

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { Bell, Hash, Home, Search, Sun, UserRound, Users } from 'lucide-react';
import { useAuthContext } from '~/hooks';
import NavDropdown from '../shared/NavDropdown';
import {
  STREET_PROFILE_NAV_ITEMS,
  isStreetProfileNavActive,
} from '../shared/streetProfileNavItems';
import TopRightAccountMenu from '../shared/TopRightAccountMenu';
import { useActiveUser } from '../shared/useActiveUser';

type ThemeName = 'light' | 'dark';
type ShortcutAction = 'jump' | 'compose' | 'next' | 'previous';
type SetupDiagnosticStatus = 'ok' | 'warning' | 'error';
type MessagesChromeState = {
  hasLoginView: boolean;
  hasMessagesSidebar: boolean;
};

type LocalMessage = {
  id: string;
  author: string;
  text: string;
  time: string;
  outgoing?: boolean;
};

type LocalConversation = {
  id: string;
  name: string;
  handle: string;
  type: 'dm' | 'group';
  avatar: string;
  status: string;
  unread: number;
  preview: string;
  messages: LocalMessage[];
};

export type MessagesSetupDiagnosticCheck = {
  id: string;
  label: string;
  status: SetupDiagnosticStatus;
  summary: string;
  action?: string;
};

export type MessagesSetupDiagnostics = {
  service: string;
  generatedAt: string;
  status: SetupDiagnosticStatus;
  command?: string;
  checks: MessagesSetupDiagnosticCheck[];
};

export type MessagesDiagnosticsState = {
  phase: 'idle' | 'checking' | 'ready' | 'unreachable';
  diagnostics?: MessagesSetupDiagnostics;
  error?: string;
};

export const MESSAGES_DIAGNOSTICS_ENDPOINT = '/social/api/setup/diagnostics';
const DIAGNOSTICS_TIMEOUT_MS = 4500;
const DIAGNOSTICS_EYEBROW = 'Setup diagnostics';
const DIAGNOSTICS_RETRY_LABEL = 'Run checks again';
const DIAGNOSTICS_ERROR_HEADING = 'Messages setup needs attention';
const DIAGNOSTICS_WARNING_HEADING = 'Messages setup has warnings';
const DIAGNOSTICS_HELP_TEXT =
  'This usually means a teammate is missing sv-social, social-postgres, the shared bridge secret, or the LibreChat API route.';
const MESSAGES_SEARCH_LABEL = 'Search messages';
const MESSAGES_SEARCH_PLACEHOLDER = 'Search messages...';
const MESSAGES_SEARCH_BUTTON_LABEL = 'Search';
const MESSAGES_DONATE_LABEL = 'Donate';
const MESSAGES_BRAND_STYLE_ID = 'street-voices-messages-brand';
const DEFAULT_MESSAGES_CHROME_STATE: MessagesChromeState = {
  hasLoginView: false,
  hasMessagesSidebar: true,
};
const MESSAGES_UNIVERSAL_NAV_ITEMS = [
  { label: 'Street Profile', href: '/profiles' },
  { label: 'Street Gallery', href: '/gallery' },
  { label: 'Academy', href: '/academy' },
  { label: 'Job Board', href: '/jobs' },
  { label: 'Directory', href: '/directory' },
  { label: 'News', href: '/news' },
];
const MESSAGES_SIDEBAR_WIDTH = 280;

const LOCAL_MESSAGE_THREADS: LocalConversation[] = [
  {
    id: 'faith-macpherson',
    name: 'Faith Macpherson',
    handle: '@faith-macpherson',
    type: 'dm',
    avatar: 'FM',
    status: 'Street Profile',
    unread: 2,
    preview: 'I can send the portfolio images after class.',
    messages: [
      {
        id: 'faith-1',
        author: 'Faith Macpherson',
        text: 'Hey Joel, I can send the portfolio images after class.',
        time: '9:18 AM',
      },
      {
        id: 'faith-2',
        author: 'Joel Zola',
        text: 'Perfect. Please send the strongest three first.',
        time: '9:20 AM',
        outgoing: true,
      },
      {
        id: 'faith-3',
        author: 'Faith Macpherson',
        text: 'Got it. I will add notes for each image too.',
        time: '9:23 AM',
      },
    ],
  },
  {
    id: 'street-gallery-crew',
    name: 'Street Gallery Crew',
    handle: '6 members',
    type: 'group',
    avatar: 'SG',
    status: 'Group',
    unread: 4,
    preview: 'New submissions are ready for review.',
    messages: [
      {
        id: 'gallery-1',
        author: 'Maya Torres',
        text: 'New submissions are ready for review. Invisible City is still the strongest lead card.',
        time: '8:42 AM',
      },
      {
        id: 'gallery-2',
        author: 'Joel Zola',
        text: 'Keep Invisible City first and confirm the filters still show all 15 artworks.',
        time: '8:44 AM',
        outgoing: true,
      },
      {
        id: 'gallery-3',
        author: 'Sarah Nightingale',
        text: 'Confirmed. Woven Stories and The Gathering are both visible.',
        time: '8:46 AM',
      },
    ],
  },
  {
    id: 'kadiatu-barrie',
    name: 'Kadiatu Barrie',
    handle: '@kadiatu-barrie',
    type: 'dm',
    avatar: 'KB',
    status: 'Street Profile',
    unread: 0,
    preview: 'Thanks, I will update my profile bio tonight.',
    messages: [
      {
        id: 'kadiatu-1',
        author: 'Kadiatu Barrie',
        text: 'Thanks, I will update my profile bio tonight.',
        time: 'Yesterday',
      },
      {
        id: 'kadiatu-2',
        author: 'Joel Zola',
        text: 'Send me the new wording and I can help tighten it.',
        time: 'Yesterday',
        outgoing: true,
      },
    ],
  },
  {
    id: 'word-on-the-street',
    name: 'Word on the Street',
    handle: 'Announcements',
    type: 'group',
    avatar: 'WS',
    status: 'Channel',
    unread: 1,
    preview: 'Community update draft is ready.',
    messages: [
      {
        id: 'wots-1',
        author: 'Messaging Agent',
        text: 'Community update draft is ready. It includes gallery, groups, and profile highlights.',
        time: '7:31 AM',
      },
    ],
  },
];

const getLibreChatTheme = (): ThemeName => {
  const html = document.documentElement;
  const dataTheme = html.getAttribute('data-theme');

  if (dataTheme === 'light' || html.classList.contains('light')) {
    return 'light';
  }

  if (dataTheme === 'dark' || html.classList.contains('dark')) {
    return 'dark';
  }

  try {
    const storedTheme = localStorage.getItem('theme') || localStorage.getItem('color-theme');
    if (storedTheme === 'light') {
      return 'light';
    }
  } catch {
    // Ignore storage access failures and fall back to dark.
  }

  return 'dark';
};

const isEditableShortcutTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
};

export const buildIframeSrc = (search?: string) => {
  if (typeof window === 'undefined' && search === undefined) {
    return '/social/dm?embed=true';
  }

  const parentParams = new URLSearchParams(search ?? window.location.search);
  const channel = parentParams.get('channel');
  const message = parentParams.get('message') || parentParams.get('msg');
  let path = '/social/dm';

  if (channel?.startsWith('dm-')) {
    path = `/social/dm/${encodeURIComponent(channel.slice(3))}`;
  } else if (channel?.startsWith('channel-')) {
    path = `/social/channels/${encodeURIComponent(channel.slice(8))}`;
  } else if (channel) {
    path = `/social/channels/${encodeURIComponent(channel)}`;
  }

  const iframeParams = new URLSearchParams({ embed: 'true' });
  if (message) {
    iframeParams.set('message', message);
  }

  return `${path}?${iframeParams.toString()}`;
};

function appendIframeCacheKey(src: string, cacheKey: number) {
  if (!cacheKey) {
    return src;
  }

  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}sv_auth=${cacheKey}`;
}

export const getComposeTarget = (search?: string) => {
  if (typeof window === 'undefined' && search === undefined) {
    return null;
  }

  const parentParams = new URLSearchParams(search ?? window.location.search);
  return parentParams.get('compose') || parentParams.get('to');
};

const isMessagesSetupDiagnostics = (value: unknown): value is MessagesSetupDiagnostics => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MessagesSetupDiagnostics>;
  return (
    typeof candidate.service === 'string' &&
    typeof candidate.generatedAt === 'string' &&
    (candidate.status === 'ok' || candidate.status === 'warning' || candidate.status === 'error') &&
    Array.isArray(candidate.checks)
  );
};

export const getMessagesDiagnosticsSeverity = (
  state: MessagesDiagnosticsState,
): SetupDiagnosticStatus => {
  if (state.phase === 'unreachable') {
    return 'error';
  }

  return state.diagnostics?.status || 'ok';
};

export async function fetchMessagesSetupDiagnostics(
  fetchImpl: typeof fetch = fetch,
  endpoint = MESSAGES_DIAGNOSTICS_ENDPOINT,
  timeoutMs = DIAGNOSTICS_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (isMessagesSetupDiagnostics(payload)) {
      return payload;
    }

    throw new Error(`Diagnostics returned ${response.status}`);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function createUnreachableCheck(error?: string): MessagesSetupDiagnosticCheck {
  return {
    id: 'social-service',
    label: 'Social service',
    status: 'error',
    summary: error || 'LibreChat cannot reach the Social Messages service.',
    action: 'Start the normal Docker stack, then run cd social && npm run health.',
  };
}

function statusLabel(status: SetupDiagnosticStatus) {
  if (status === 'ok') {
    return 'OK';
  }

  if (status === 'warning') {
    return 'Check';
  }

  return 'Fix';
}

function statusClassName(status: SetupDiagnosticStatus) {
  if (status === 'ok') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200';
  }

  if (status === 'warning') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-300/15 dark:text-yellow-200';
  }

  return 'bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-200';
}

function getMessagesChromeState(iframeDocument: Document): MessagesChromeState {
  const bodyText = iframeDocument.body?.innerText || '';
  const passwordField = iframeDocument.querySelector<HTMLInputElement>('input[type="password"]');
  const emailField = iframeDocument.querySelector<HTMLInputElement>(
    'input[type="email"], input[name*="email" i], input[placeholder*="email" i]',
  );
  const hasLoginView =
    (Boolean(passwordField) && Boolean(emailField)) ||
    /\bLog In\b|\bSign Up\b|Email address|Password/i.test(bodyText);
  const aside = iframeDocument.querySelector<HTMLElement>('aside');
  const asideRect = aside?.getBoundingClientRect();
  const hasMessagesSidebar =
    Boolean(asideRect && asideRect.width >= 160 && asideRect.height >= 240) && !hasLoginView;

  return {
    hasLoginView,
    hasMessagesSidebar,
  };
}

function syncIframeBrand(frame: HTMLIFrameElement | null): MessagesChromeState | null {
  try {
    const iframeDocument = frame?.contentDocument;
    if (!iframeDocument) {
      return null;
    }

    const chromeState = getMessagesChromeState(iframeDocument);
    iframeDocument.body?.toggleAttribute('data-sv-login-view', chromeState.hasLoginView);
    iframeDocument.body?.toggleAttribute(
      'data-sv-messages-sidebar',
      chromeState.hasMessagesSidebar,
    );

    let style = iframeDocument.getElementById(MESSAGES_BRAND_STYLE_ID);
    if (!style) {
      style = iframeDocument.createElement('style');
      style.id = MESSAGES_BRAND_STYLE_ID;
      iframeDocument.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --sv-brand-yellow: #FFD600;
        --sv-brand-ink: #17121f;
        --sv-brand-ink-deep: #11131d;
        --sv-brand-violet: #2D2366;
        --sv-brand-cyan: #0B3A46;
        --sv-brand-wine: #441A38;
        --sv-brand-border: rgba(226, 230, 246, 0.14);
        --sv-brand-surface: rgba(24, 25, 38, 0.76);
        --sv-brand-surface-strong: rgba(33, 34, 50, 0.88);
        --sv-brand-sidebar: rgba(18, 9, 29, 0.97);
        --sv-brand-text: #F6F7FB;
        --sv-brand-text-soft: rgba(246, 247, 251, 0.74);
        --sv-brand-text-muted: rgba(246, 247, 251, 0.58);
      }

      html,
      body {
        background:
          radial-gradient(circle at 52% 14%, rgba(45, 35, 102, 0.66), transparent 34%),
          radial-gradient(circle at 8% 88%, rgba(11, 58, 70, 0.72), transparent 36%),
          radial-gradient(circle at 92% 90%, rgba(68, 26, 56, 0.68), transparent 38%),
          linear-gradient(135deg, #11131d 0%, #17121f 48%, #1b1221 100%) !important;
        color: #F6F7FB !important;
      }

      #root,
      #__next,
      body > div:first-child,
      main,
      [role="main"] {
        background: transparent !important;
      }

      aside {
        background:
          linear-gradient(180deg, rgba(25, 12, 36, 0.98), var(--sv-brand-sidebar)) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
      }

      aside,
      aside * {
        color: var(--sv-brand-text-soft) !important;
      }

      aside h1,
      aside h2,
      aside h3,
      aside strong,
      aside [style*="font-weight: 700"],
      aside [style*="font-weight:700"] {
        color: var(--sv-brand-text) !important;
      }

      aside > :first-child h1,
      aside > :first-child h2,
      aside > :first-child strong,
      aside > :first-child [style*="font-weight: 900"],
      aside > :first-child [style*="font-weight:900"] {
        color: var(--sv-brand-yellow) !important;
      }

      aside > :first-child {
        display: none !important;
        border-bottom: 0 !important;
        box-shadow: none !important;
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      body[data-sv-login-view] aside {
        display: none !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        overflow: hidden !important;
      }

      body[data-sv-login-view] header,
      body[data-sv-login-view] main,
      body[data-sv-login-view] [role="main"] {
        margin-left: 0 !important;
      }

      header,
      nav:not([aria-label="Street Voices main navigation"]) {
        background: rgba(17, 19, 29, 0.82) !important;
        border-color: var(--sv-brand-border) !important;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22) !important;
        backdrop-filter: blur(24px) saturate(170%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(170%) !important;
      }

      section,
      article,
      [role="list"],
      [role="listbox"],
      [role="tabpanel"] {
        border-color: var(--sv-brand-border) !important;
      }

      section,
      article,
      [role="list"],
      [role="listbox"],
      [role="tabpanel"],
      [class*="card"],
      [class*="panel"],
      [class*="surface"] {
        background-color: var(--sv-brand-surface) !important;
        backdrop-filter: blur(18px) saturate(160%) !important;
        -webkit-backdrop-filter: blur(18px) saturate(160%) !important;
      }

      [style*="background: rgba(255"],
      [style*="background-color: rgba(255"] {
        background: var(--sv-brand-surface) !important;
      }

      main,
      [role="main"],
      section,
      article,
      [role="list"],
      [role="listbox"],
      [role="tabpanel"] {
        color: var(--sv-brand-text) !important;
      }

      main p,
      main span,
      main small,
      [role="main"] p,
      [role="main"] span,
      [role="main"] small,
      section p,
      section span,
      article p,
      article span {
        color: var(--sv-brand-text-soft) !important;
      }

      main h1,
      main h2,
      main h3,
      main strong,
      section h1,
      section h2,
      section h3,
      section strong,
      article h1,
      article h2,
      article h3,
      article strong {
        color: var(--sv-brand-text) !important;
      }

      button,
      input,
      textarea,
      select,
      [role="tab"],
      [role="button"] {
        border-color: var(--sv-brand-border) !important;
      }

      input,
      textarea,
      select {
        background-color: rgba(255, 255, 255, 0.08) !important;
        color: #F6F7FB !important;
      }

      input::placeholder,
      textarea::placeholder {
        color: rgba(246, 247, 251, 0.58) !important;
      }

      [role="tab"][aria-selected="true"],
      button[aria-selected="true"],
      [aria-current="page"],
      [data-active="true"] {
        background: var(--sv-brand-yellow) !important;
        border-color: var(--sv-brand-yellow) !important;
        color: #050505 !important;
      }

	      [class*="badge"],
	      mark,
	      [style*="background: #FFD600"],
	      [style*="background:#FFD600"],
	      [style*="background-color: #FFD600"],
	      [style*="background-color:#FFD600"],
	      [style*="background: #ffd600"],
	      [style*="background:#ffd600"],
	      [style*="background-color: #ffd600"],
	      [style*="background-color:#ffd600"],
	      [style*="background: rgb(255, 214, 0)"],
	      [style*="background-color: rgb(255, 214, 0)"],
	      [style*="background: var(--sv-brand-yellow)"],
	      [style*="background-color: var(--sv-brand-yellow)"],
	      [style*="background: linear-gradient"][style*="#FFD600"],
	      [style*="background-image: linear-gradient"][style*="#FFD600"],
	      [style*="background: linear-gradient"][style*="#ffd600"],
	      [style*="background-image: linear-gradient"][style*="#ffd600"],
	      [data-sv-yellow-surface="true"],
	      [class*="bg-accent"],
	      [class*="bg-yellow"],
	      [class*="bg-\\[\\#FFD600\\]"],
	      [class*="bg-\\[\\#ffd600\\]"],
	      [class*="from-yellow"],
	      [class*="to-yellow"],
	      [class*="via-yellow"] {
	        color: #050505 !important;
	      }

	      [class*="badge"] *,
	      mark *,
	      [style*="background: #FFD600"] *,
	      [style*="background:#FFD600"] *,
	      [style*="background-color: #FFD600"] *,
	      [style*="background-color:#FFD600"] *,
	      [style*="background: #ffd600"] *,
	      [style*="background:#ffd600"] *,
	      [style*="background-color: #ffd600"] *,
	      [style*="background-color:#ffd600"] *,
	      [style*="background: rgb(255, 214, 0)"] *,
	      [style*="background-color: rgb(255, 214, 0)"] *,
	      [style*="background: var(--sv-brand-yellow)"] *,
	      [style*="background-color: var(--sv-brand-yellow)"] *,
	      [style*="background: linear-gradient"][style*="#FFD600"] *,
	      [style*="background-image: linear-gradient"][style*="#FFD600"] *,
	      [style*="background: linear-gradient"][style*="#ffd600"] *,
	      [style*="background-image: linear-gradient"][style*="#ffd600"] *,
	      [data-sv-yellow-surface="true"] *,
	      [class*="bg-accent"] *,
	      [class*="bg-yellow"] *,
	      [class*="bg-\\[\\#FFD600\\]"] *,
	      [class*="bg-\\[\\#ffd600\\]"] *,
	      [class*="from-yellow"] *,
	      [class*="to-yellow"] *,
	      [class*="via-yellow"] * {
	        color: #050505 !important;
	        stroke: #050505 !important;
	      }

	      a:hover,
	      a:focus-visible {
	        color: var(--sv-brand-yellow) !important;
	      }

      a:focus-visible,
      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      [role="button"]:focus-visible {
        outline: 2px solid var(--sv-brand-yellow) !important;
        outline-offset: 2px !important;
      }

      button:hover,
      [role="button"]:hover,
      [role="listitem"]:hover {
        border-color: rgba(255, 255, 255, 0.22) !important;
        background-color: var(--sv-brand-surface-strong) !important;
      }

      aside button:hover,
      aside [role="button"]:hover,
      aside a:hover {
        color: var(--sv-brand-text) !important;
        background-color: rgba(255, 255, 255, 0.08) !important;
      }

      aside [aria-current="page"],
      aside [data-active="true"],
      aside button[aria-selected="true"] {
        background: rgba(255, 214, 0, 0.22) !important;
        color: var(--sv-brand-text) !important;
        border-color: rgba(255, 214, 0, 0.34) !important;
      }
	    `;

    const iframeWindow = frame?.contentWindow as
      | (Window & { __svYellowContrastObserver?: MutationObserver })
      | null;
    const isYellowSurface = (element: HTMLElement) => {
      const computed = iframeWindow?.getComputedStyle(element);
      if (!computed) {
        return false;
      }

      const backgroundText =
        `${computed.backgroundColor} ${computed.backgroundImage}`.toLowerCase();
      if (
        backgroundText.includes('#ffd600') ||
        backgroundText.includes('255, 214, 0') ||
        backgroundText.includes('255 214 0')
      ) {
        return true;
      }

      const rgbMatch = computed.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!rgbMatch) {
        return false;
      }

      const [, red, green, blue] = rgbMatch.map(Number);
      return red >= 238 && green >= 180 && green <= 225 && blue <= 36;
    };

    const applyYellowContrast = () => {
      iframeDocument.querySelectorAll<HTMLElement>('body *').forEach((element) => {
        element.toggleAttribute('data-sv-yellow-surface', isYellowSurface(element));
      });
    };

    iframeWindow?.requestAnimationFrame(applyYellowContrast);
    if (iframeWindow && !iframeWindow.__svYellowContrastObserver && iframeDocument.body) {
      const observer = new iframeWindow.MutationObserver(() => {
        iframeWindow.requestAnimationFrame(applyYellowContrast);
      });
      observer.observe(iframeDocument.body, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true,
      });
      iframeWindow.__svYellowContrastObserver = observer;
    }

    const noticeCandidates = Array.from(
      iframeDocument.querySelectorAll<HTMLElement>('div, section, article'),
    ).filter((element) => {
      const text = element.textContent || '';
      const rect = element.getBoundingClientRect();
      return (
        text.includes('waiting on first sign-in') &&
        text.includes('ADDED RECENTLY') &&
        rect.height >= 36 &&
        rect.height <= 140 &&
        rect.width >= 360
      );
    });
    const notice = noticeCandidates.reduce<HTMLElement | null>((current, element) => {
      if (!current) {
        return element;
      }

      const currentRect = current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return elementRect.width * elementRect.height > currentRect.width * currentRect.height
        ? element
        : current;
    }, null);
    if (notice) {
      notice.style.display = 'none';
    }

    return chromeState;
  } catch {
    // The embedded messages app may be cross-origin while booting.
    return null;
  }
}

function MessagesDiagnosticsPanel({
  state,
  onRetry,
}: {
  state: MessagesDiagnosticsState;
  onRetry: () => void;
}) {
  const severity = getMessagesDiagnosticsSeverity(state);
  const checks = state.diagnostics?.checks || [createUnreachableCheck(state.error)];
  const command = state.diagnostics?.command || 'cd social && npm run health';
  const heading = severity === 'error' ? DIAGNOSTICS_ERROR_HEADING : DIAGNOSTICS_WARNING_HEADING;

  return (
    <div className="absolute inset-x-3 top-3 z-20 flex justify-center sm:inset-x-6 sm:top-5">
      <section className="w-full max-w-2xl rounded-lg border border-yellow-400/40 bg-white p-4 text-sm text-gray-900 shadow-2xl dark:border-yellow-300/30 dark:bg-[#211a2b] dark:text-gray-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
              {DIAGNOSTICS_EYEBROW}
            </p>
            <h2 className="mt-1 text-base font-semibold">{heading}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{DIAGNOSTICS_HELP_TEXT}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-white/10"
          >
            {DIAGNOSTICS_RETRY_LABEL}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusClassName(check.status)}`}
                >
                  {statusLabel(check.status)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{check.label}</p>
                  <p className="text-gray-600 dark:text-gray-300">{check.summary}</p>
                  {check.action && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{check.action}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md bg-gray-950 px-3 py-2 font-mono text-xs text-gray-100">
          {command}
        </div>
      </section>
    </div>
  );
}

function LocalMessagesFallback({
  searchQuery,
  activeUserName,
}: {
  searchQuery: string;
  activeUserName: string;
}) {
  void activeUserName;
  const [threads] = useState<LocalConversation[]>(LOCAL_MESSAGE_THREADS);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleThreads = threads.filter((thread) => {
    if (!normalizedSearch) return true;
    return [thread.name, thread.handle, thread.preview, thread.status]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const teammateThreads = visibleThreads.filter((thread) => thread.type === 'dm');

  const sidebarItems = [
    { label: 'Direct messages', icon: UserRound, active: true },
    { label: 'Activity', icon: Bell },
    { label: 'Mentions', icon: Search },
    { label: 'Later', icon: Home },
    { label: 'Channel browser', icon: Users },
  ];

  return (
    <div
      className="sv-messages-shell"
      style={{
        display: 'grid',
        gridTemplateColumns: '280px minmax(0, 1fr)',
        height: '100%',
        paddingTop: 64,
        color: '#F6F7FB',
      }}
    >
      <aside
        style={{
          minHeight: 0,
          borderRight: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(18, 9, 29, 0.72)',
          padding: '18px 12px',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            margin: '0 4px 18px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.07)',
            padding: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Desktop alerts</div>
              <div style={{ marginTop: 4, color: 'rgba(246,247,251,0.62)', fontSize: 11 }}>
                Get notified while Messages is in the background.
              </div>
            </div>
            <span style={{ color: 'rgba(246,247,251,0.55)' }}>x</span>
          </div>
          <button
            type="button"
            style={{
              marginTop: 12,
              border: 0,
              borderRadius: 4,
              background: '#FFD600',
              color: '#050505',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Enable
          </button>
        </div>

        <div style={{ display: 'grid', gap: 3 }}>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 5,
                  background: item.active ? 'rgba(255,214,0,0.22)' : 'transparent',
                  color: item.active ? '#F6F7FB' : 'rgba(246,247,251,0.70)',
                  padding: '9px 12px',
                  fontSize: 14,
                  fontWeight: item.active ? 800 : 600,
                }}
              >
                <Icon size={16} />
                {item.label}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, padding: '0 12px' }}>
          <div
            style={{
              color: 'rgba(246,247,251,0.72)',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Channels
          </div>
          {['announcements', 'general', 'help'].map((channel) => (
            <div
              key={channel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                color: 'rgba(246,247,251,0.70)',
                fontSize: 14,
              }}
            >
              <Hash size={15} />
              {channel}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: '0 12px' }}>
          <div
            style={{
              color: 'rgba(246,247,251,0.72)',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            People
          </div>
          <div style={{ marginTop: 12, color: 'rgba(246,247,251,0.62)', fontSize: 13 }}>
            Start a direct message
          </div>
        </div>
      </aside>

      <section
        style={{
          minWidth: 0,
          minHeight: 0,
          padding: '18px 7vw 42px',
          overflow: 'auto',
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'end',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>Direct messages</h1>
              <p style={{ margin: '4px 0 0', color: 'rgba(246,247,251,0.68)', fontSize: 14 }}>
                {teammateThreads.length || visibleThreads.length} teammates, 0 agents
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, minWidth: 360 }}>
              {['All', 'Teammates', 'Agents'].map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  style={{
                    height: 36,
                    minWidth: 58,
                    borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: index === 0 ? '#FFD600' : 'rgba(255,255,255,0.04)',
                    color: index === 0 ? '#050505' : 'rgba(246,247,251,0.62)',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {filter}
                </button>
              ))}
              <input
                value={searchQuery}
                readOnly
                placeholder="Search people and agents"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 36,
                  borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.07)',
                  color: '#F6F7FB',
                  padding: '0 14px',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.035)',
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,214,0,0.08)',
                color: '#FFD600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
              }}
            >
              +
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>
                {visibleThreads.length} teammates waiting on first sign-in
              </strong>
              <p style={{ margin: '5px 0 0', color: 'rgba(246,247,251,0.46)', fontSize: 12 }}>
                LibreChat sign-in unlocks Messages automatically.
              </p>
            </div>
            <span
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(246,247,251,0.62)',
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {visibleThreads.length} added recently
            </span>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(23,24,38,0.72)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.07)',
                padding: '10px 18px',
                color: 'rgba(246,247,251,0.76)',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
              }}
            >
              <span>Teammates</span>
              <span>{teammateThreads.length || visibleThreads.length}</span>
            </div>
            {visibleThreads.map((thread) => (
              <div
                key={thread.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  minHeight: 78,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  padding: '12px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      background: 'rgba(255,214,0,0.18)',
                      color: '#F6F7FB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {thread.avatar.slice(0, 1)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong
                        style={{
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 14,
                        }}
                      >
                        {thread.name}
                      </strong>
                      <span
                        style={{
                          borderRadius: 999,
                          background: 'rgba(255,214,0,0.16)',
                          color: '#FFD600',
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 900,
                        }}
                      >
                        NEW
                      </span>
                      <span style={{ color: 'rgba(246,247,251,0.50)', fontSize: 11 }}>
                        {thread.handle}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: 'rgba(246,247,251,0.74)',
                        fontSize: 12,
                      }}
                    >
                      Needs first sign-in
                    </div>
                    <div style={{ marginTop: 4, color: 'rgba(246,247,251,0.46)', fontSize: 11 }}>
                      LibreChat sign-in unlocks Messages automatically.
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SocialMessagesPage() {
  const location = useLocation();
  const { theme, setTheme } = useContext(ThemeContext);
  const { isAuthenticated } = useAuthContext();
  const { activeUser } = useActiveUser();
  const activeUserSessionKey =
    activeUser?.id || activeUser?._id || activeUser?.email || activeUser?.username || null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState(() => buildIframeSrc(location.search));
  const [authCacheKey, setAuthCacheKey] = useState(0);
  const [socialSessionReady, setSocialSessionReady] = useState(false);
  const [messagesChromeState, setMessagesChromeState] = useState<MessagesChromeState>(
    DEFAULT_MESSAGES_CHROME_STATE,
  );
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [diagnosticsState, setDiagnosticsState] = useState<MessagesDiagnosticsState>({
    phase: 'idle',
  });
  const dark = checkDark(theme);
  const shouldUseLocalMessages = diagnosticsState.phase === 'unreachable';
  const activeUserName =
    activeUser?.name || activeUser?.username || activeUser?.email || 'Joel Zola';

  useEffect(() => {
    if (!isAuthenticated || !activeUserSessionKey) {
      setSocialSessionReady(false);
      setIframeSrc(buildIframeSrc(location.search));
      return;
    }

    let cancelled = false;
    const nextCacheKey = Date.now();
    setSocialSessionReady(false);

    const warmSocialSession = async () => {
      try {
        await fetch(`/social/api/channels?sv_auth=${nextCacheKey}`, {
          cache: 'no-store',
          credentials: 'include',
        });
      } catch {
        // If the warm-up fails, still mount the iframe so diagnostics can surface the issue.
      }

      if (cancelled) {
        return;
      }

      setAuthCacheKey(nextCacheKey);
      setIframeSrc(appendIframeCacheKey(buildIframeSrc(location.search), nextCacheKey));
      setSocialSessionReady(true);
    };

    void warmSocialSession();

    return () => {
      cancelled = true;
    };
  }, [activeUserSessionKey, isAuthenticated, location.search]);

  const runDiagnostics = useCallback(async () => {
    setDiagnosticsState((current) => ({
      phase: 'checking',
      diagnostics: current.diagnostics,
      error: current.error,
    }));

    try {
      const diagnostics = await fetchMessagesSetupDiagnostics();
      setDiagnosticsState({ phase: 'ready', diagnostics });
    } catch (error) {
      setDiagnosticsState({
        phase: 'unreachable',
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'Timed out while checking the Social Messages service.'
            : 'LibreChat could not reach /social/api/setup/diagnostics.',
      });
    }
  }, []);

  useEffect(() => {
    void runDiagnostics();
  }, [iframeSrc, runDiagnostics]);

  const postIframeShortcut = useCallback((action: ShortcutAction, query?: string | null) => {
    const payload: {
      source: 'librechat';
      type: 'street-voices-shortcut';
      action: ShortcutAction;
      query?: string;
    } = { source: 'librechat', type: 'street-voices-shortcut', action };

    if (query) {
      payload.query = query;
    }

    iframeRef.current?.contentWindow?.postMessage(payload, window.location.origin);
  }, []);

  const handleMessageSearch = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      postIframeShortcut('jump', messageSearchQuery.trim());
    },
    [messageSearchQuery, postIframeShortcut],
  );

  const toggleTheme = useCallback(() => {
    setTheme(checkDark(theme) ? 'light' : 'dark');
  }, [setTheme, theme]);

  const syncIframeTheme = useCallback(() => {
    const theme = getLibreChatTheme();
    const frame = iframeRef.current;

    try {
      frame?.contentWindow?.postMessage(
        { source: 'librechat', type: 'street-voices-theme', theme },
        window.location.origin,
      );
      const iframeHtml = frame?.contentDocument?.documentElement;
      iframeHtml?.classList.remove('dark', 'light');
      iframeHtml?.classList.add(theme);
      iframeHtml?.setAttribute('data-theme', theme);
      if (iframeHtml) {
        iframeHtml.style.colorScheme = theme;
      }
      const chromeState = syncIframeBrand(frame ?? null);
      if (chromeState) {
        setMessagesChromeState(chromeState);
      }
    } catch {
      // The iframe may still be loading; it also reads the parent theme itself.
    }
  }, []);

  useEffect(() => {
    syncIframeTheme();

    const observer = new MutationObserver(syncIframeTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    window.addEventListener('storage', syncIframeTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', syncIframeTheme);
    };
  }, [syncIframeTheme]);

  useEffect(() => {
    const syncIframeSrc = () => {
      if (isAuthenticated && activeUserSessionKey && !socialSessionReady) {
        return;
      }

      setIframeSrc(appendIframeCacheKey(buildIframeSrc(), authCacheKey));
    };

    window.addEventListener('popstate', syncIframeSrc);
    window.addEventListener('hashchange', syncIframeSrc);
    return () => {
      window.removeEventListener('popstate', syncIframeSrc);
      window.removeEventListener('hashchange', syncIframeSrc);
    };
  }, [activeUserSessionKey, authCacheKey, isAuthenticated, socialSessionReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifierKey = event.metaKey || event.ctrlKey;

      if (modifierKey && !event.altKey && !event.shiftKey && key === 'k') {
        event.preventDefault();
        postIframeShortcut('jump');
        return;
      }

      if (modifierKey && !event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault();
        postIframeShortcut('compose');
        return;
      }

      if (!modifierKey && !event.altKey && !event.shiftKey && key === '/') {
        event.preventDefault();
        postIframeShortcut('jump');
        return;
      }

      if (event.altKey && !modifierKey && !event.shiftKey && event.key === 'ArrowDown') {
        event.preventDefault();
        postIframeShortcut('next');
        return;
      }

      if (event.altKey && !modifierKey && !event.shiftKey && event.key === 'ArrowUp') {
        event.preventDefault();
        postIframeShortcut('previous');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [postIframeShortcut]);

  useEffect(() => {
    const composeTarget = getComposeTarget(location.search);
    if (!composeTarget) {
      return;
    }

    const timer = window.setTimeout(() => {
      postIframeShortcut('compose', composeTarget);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [iframeSrc, location.search, postIframeShortcut]);

  const handleIframeLoad = useCallback(() => {
    syncIframeTheme();
    const chromeState = syncIframeBrand(iframeRef.current);
    if (chromeState) {
      setMessagesChromeState(chromeState);
    }
    const composeTarget = getComposeTarget(location.search);
    if (composeTarget) {
      window.setTimeout(() => postIframeShortcut('compose', composeTarget), 100);
    }
  }, [location.search, postIframeShortcut, syncIframeTheme]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const chromeState = syncIframeBrand(iframeRef.current);
      if (!chromeState) {
        return;
      }

      setMessagesChromeState((current) =>
        current.hasLoginView === chromeState.hasLoginView &&
        current.hasMessagesSidebar === chromeState.hasMessagesSidebar
          ? current
          : chromeState,
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, [iframeSrc]);

  return (
    <div
      className="sv-messages-brand-frame relative h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#17121f]"
      data-messages-login={messagesChromeState.hasLoginView ? 'true' : 'false'}
      data-messages-sidebar={messagesChromeState.hasMessagesSidebar ? 'true' : 'false'}
    >
      <style>{`
        .sv-messages-brand-frame {
          background:
            radial-gradient(circle at 52% 14%, rgba(45, 35, 102, 0.66), transparent 34%),
            radial-gradient(circle at 8% 88%, rgba(11, 58, 70, 0.72), transparent 36%),
            radial-gradient(circle at 92% 90%, rgba(68, 26, 56, 0.68), transparent 38%),
            linear-gradient(135deg, #11131d 0%, #17121f 48%, #1b1221 100%) !important;
        }

        .sv-messages-shell {
          background:
            radial-gradient(circle at 52% 14%, rgba(45, 35, 102, 0.66), transparent 34%),
            radial-gradient(circle at 8% 88%, rgba(11, 58, 70, 0.72), transparent 36%),
            radial-gradient(circle at 92% 90%, rgba(68, 26, 56, 0.68), transparent 38%),
            linear-gradient(135deg, #11131d 0%, #17121f 48%, #1b1221 100%);
        }

        .sv-messages-universal-nav {
          position: absolute;
          top: 0;
          left: ${MESSAGES_SIDEBAR_WIDTH}px;
          right: 0;
          z-index: 30;
          height: 64px;
          box-sizing: border-box;
          padding: 8px 18px;
          background:
            linear-gradient(90deg, rgba(17, 19, 29, 0.88), rgba(29, 25, 61, 0.72), rgba(17, 19, 29, 0.88));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
        }

        .sv-messages-brand-frame[data-messages-sidebar="false"] .sv-messages-universal-nav {
          left: 0;
        }

        .sv-messages-universal-nav__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          width: 100%;
          height: 100%;
          max-width: 1380px;
          margin: 0 auto;
        }

        .sv-messages-universal-nav__links {
          display: flex;
          align-items: center;
          gap: 0;
          flex: 0 0 auto;
        }

        .sv-messages-universal-nav__link {
          display: inline-flex;
          align-items: center;
          border-radius: 8px;
          color: #E6E7F2;
          font-family: Rubik, sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1.2;
          padding: 8px 12px;
          text-decoration: none;
          transition:
            background-color 160ms ease,
            color 160ms ease;
          white-space: nowrap;
        }

        .sv-messages-universal-nav__link:hover,
        .sv-messages-universal-nav__link:focus-visible {
          background: rgba(255, 255, 255, 0.12);
          outline: none;
        }

        .sv-messages-universal-nav__link--active {
          color: #FFD600;
          font-weight: 900;
        }

        .sv-messages-universal-nav__search-wrap {
          flex: 1 1 520px;
          min-width: 260px;
          max-width: 520px;
        }

        .sv-messages-universal-nav__search {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          height: 42px;
          box-sizing: border-box;
          padding: 0 5px 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
        }

        .sv-messages-universal-nav__search-input {
          flex: 1;
          min-width: 0;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #fff;
          font-family: Rubik, sans-serif;
          font-size: 14px;
        }

        .sv-messages-universal-nav__search-input::placeholder {
          color: rgba(230, 231, 242, 0.64);
          opacity: 1;
        }

        .sv-messages-universal-nav__search-button {
          height: 32px;
          min-width: 120px;
          padding: 0 32px;
          border: 0;
          border-radius: 999px;
          background: #FFD600;
          color: #000;
          box-shadow: 0 8px 18px rgba(255, 214, 0, 0.24);
          cursor: pointer;
          font-family: Inter, sans-serif;
          font-size: 15px;
          font-weight: 700;
        }

        .sv-messages-universal-nav__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .sv-messages-universal-nav__icon,
        .sv-messages-universal-nav__donate {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.06);
          color: #E6E7F2;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        }

        .sv-messages-universal-nav__icon {
          width: 38px;
          padding: 0;
        }

        .sv-messages-universal-nav__donate {
          padding: 0 18px;
          border-radius: 999px;
          font-family: Rubik, sans-serif;
          font-size: 14px;
          font-weight: 900;
        }

        .sv-messages-universal-nav__notice {
          position: absolute;
          top: -5px;
          right: -4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #e11d48;
          color: #fff;
          font-family: Inter, sans-serif;
          font-size: 10px;
          font-weight: 900;
        }

        .sv-messages-universal-nav__sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 1280px) {
          .sv-messages-universal-nav {
            padding-left: 14px;
            padding-right: 14px;
          }

          .sv-messages-universal-nav__inner {
            gap: 12px;
          }

          .sv-messages-universal-nav__link {
            padding-left: 8px;
            padding-right: 8px;
          }

          .sv-messages-universal-nav__search-wrap {
            max-width: 420px;
          }

          .sv-messages-universal-nav__search-button {
            min-width: 96px;
            padding: 0 22px;
          }
        }

        @media (max-width: 1120px) {
          .sv-messages-universal-nav__search-wrap,
          .sv-messages-universal-nav__actions {
            display: none;
          }

          .sv-messages-universal-nav__inner {
            justify-content: flex-end;
          }
        }

        @media (max-width: 760px) {
          .sv-messages-universal-nav {
            display: none;
          }
        }
      `}</style>
      <nav className="sv-messages-universal-nav" aria-label="Street Voices main navigation">
        <div className="sv-messages-universal-nav__inner">
          <div className="sv-messages-universal-nav__links">
            {MESSAGES_UNIVERSAL_NAV_ITEMS.map((item) => {
              const isActive =
                item.label === 'Street Profile'
                  ? isStreetProfileNavActive(location.pathname)
                  : location.pathname === item.href ||
                    location.pathname.startsWith(`${item.href}/`);

              if (item.label === 'Street Profile') {
                return (
                  <NavDropdown
                    key={item.href}
                    label={item.label}
                    href={item.href}
                    items={STREET_PROFILE_NAV_ITEMS}
                    textColor={isActive ? '#FFD600' : '#E6E7F2'}
                    fontSize={14}
                    buttonStyle={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: isActive ? 900 : 700,
                    }}
                    menuMinWidth={170}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={[
                    'sv-messages-universal-nav__link',
                    isActive ? 'sv-messages-universal-nav__link--active' : '',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="sv-messages-universal-nav__search-wrap">
            <form
              role="search"
              aria-label={MESSAGES_SEARCH_LABEL}
              className="sv-messages-universal-nav__search"
              onSubmit={handleMessageSearch}
            >
              <Search size={17} color="rgba(230,231,242,0.64)" />
              <label htmlFor="messages-search" className="sv-messages-universal-nav__sr-only">
                {MESSAGES_SEARCH_LABEL}
              </label>
              <input
                id="messages-search"
                type="search"
                value={messageSearchQuery}
                onChange={(event) => setMessageSearchQuery(event.target.value)}
                placeholder={MESSAGES_SEARCH_PLACEHOLDER}
                className="sv-messages-universal-nav__search-input"
              />
              <button type="submit" className="sv-messages-universal-nav__search-button">
                {MESSAGES_SEARCH_BUTTON_LABEL}
              </button>
            </form>
          </div>
          <div className="sv-messages-universal-nav__actions">
            <Link to="/home" className="sv-messages-universal-nav__icon" aria-label="Go to home">
              <Home size={18} strokeWidth={2} />
            </Link>
            <Link
              to="/notifications"
              className="sv-messages-universal-nav__icon"
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={17} strokeWidth={2} />
              <span className="sv-messages-universal-nav__notice">27</span>
            </Link>
            <Link to="/donate" className="sv-messages-universal-nav__donate">
              {MESSAGES_DONATE_LABEL}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="sv-theme-toggle-button sv-messages-universal-nav__icon"
              aria-label="Toggle theme"
            >
              <Sun size={18} strokeWidth={2} />
            </button>
            <TopRightAccountMenu dark={dark} size={28} />
          </div>
        </div>
      </nav>
      {getMessagesDiagnosticsSeverity(diagnosticsState) !== 'ok' && !shouldUseLocalMessages && (
        <MessagesDiagnosticsPanel state={diagnosticsState} onRetry={runDiagnostics} />
      )}
      {shouldUseLocalMessages ? (
        <LocalMessagesFallback
          searchQuery={messageSearchQuery}
          activeUserName={activeUserName}
        />
      ) : isAuthenticated && activeUserSessionKey && !socialSessionReady ? (
        <div className="sv-messages-shell flex h-full w-full items-center justify-center text-sm font-semibold text-white/70">
          Loading messages...
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Street Voices Messages"
          className="sv-messages-shell block h-full w-full border-0"
          allow="clipboard-read; clipboard-write; microphone"
          onLoad={handleIframeLoad}
        />
      )}
    </div>
  );
}
