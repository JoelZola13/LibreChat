'use client';

import React, { useCallback, useEffect, useRef } from 'react';

type ThemeName = 'light' | 'dark';

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

export default function SocialMessagesPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#17121f]">
      <iframe
        ref={iframeRef}
        src="/social/dm?embed=true"
        title="Street Voices Messages"
        className="block h-full w-full border-0"
        allow="clipboard-read; clipboard-write; microphone"
        onLoad={syncIframeTheme}
      />
    </div>
  );
}
