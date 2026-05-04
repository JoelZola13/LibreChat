'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type ThemeName = 'light' | 'dark';
type ShortcutAction = 'jump' | 'compose' | 'next' | 'previous';

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

export default function SocialMessagesPage() {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState(() => buildIframeSrc(location.search));

  useEffect(() => {
    setIframeSrc(buildIframeSrc(location.search));
  }, [location.search]);

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
