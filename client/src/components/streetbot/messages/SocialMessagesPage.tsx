'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type ThemeName = 'light' | 'dark';
type ShortcutAction = 'jump' | 'compose' | 'next' | 'previous';
type SetupDiagnosticStatus = 'ok' | 'warning' | 'error';

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
  }

  const iframeParams = new URLSearchParams({ embed: 'true' });
  if (message) {
    iframeParams.set('message', message);
  }

  return `${path}?${iframeParams.toString()}`;
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

export default function SocialMessagesPage() {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState(() => buildIframeSrc(location.search));
  const [diagnosticsState, setDiagnosticsState] = useState<MessagesDiagnosticsState>({
    phase: 'idle',
  });

  useEffect(() => {
    setIframeSrc(buildIframeSrc(location.search));
  }, [location.search]);

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
    const syncIframeSrc = () => setIframeSrc(buildIframeSrc());

    window.addEventListener('popstate', syncIframeSrc);
    window.addEventListener('hashchange', syncIframeSrc);
    return () => {
      window.removeEventListener('popstate', syncIframeSrc);
      window.removeEventListener('hashchange', syncIframeSrc);
    };
  }, []);

  useEffect(() => {
    const postShortcut = (action: ShortcutAction) => {
      iframeRef.current?.contentWindow?.postMessage(
        { source: 'librechat', type: 'street-voices-shortcut', action },
        window.location.origin,
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifierKey = event.metaKey || event.ctrlKey;

      if (modifierKey && !event.altKey && !event.shiftKey && key === 'k') {
        event.preventDefault();
        postShortcut('jump');
        return;
      }

      if (modifierKey && !event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault();
        postShortcut('compose');
        return;
      }

      if (!modifierKey && !event.altKey && !event.shiftKey && key === '/') {
        event.preventDefault();
        postShortcut('jump');
        return;
      }

      if (event.altKey && !modifierKey && !event.shiftKey && event.key === 'ArrowDown') {
        event.preventDefault();
        postShortcut('next');
        return;
      }

      if (event.altKey && !modifierKey && !event.shiftKey && event.key === 'ArrowUp') {
        event.preventDefault();
        postShortcut('previous');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#17121f]">
      {getMessagesDiagnosticsSeverity(diagnosticsState) !== 'ok' && (
        <MessagesDiagnosticsPanel state={diagnosticsState} onRetry={runDiagnostics} />
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Street Voices Messages"
        className="block h-full w-full border-0"
        allow="clipboard-read; clipboard-write; microphone"
        onLoad={syncIframeTheme}
      />
    </div>
  );
}
