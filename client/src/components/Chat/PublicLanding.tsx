import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { variantConfig, isDirectory, isStreetBot } from '~/config/appVariant';
import { useAuthContext } from '~/hooks/AuthContext';
import DirectoryHomepage from './DirectoryHomepage';
import HomepageTopNav from './HomepageTopNav';
import HomepageFooter from './HomepageFooter';
import HomepageNews from './HomepageNews';
import { GlassBackground } from '~/components/streetbot/shared/GlassBackground';
import { cn } from '~/utils';
import VoiceWaveform from './Input/VoiceWaveform';

/**
 * Public landing page — mirrors the authenticated HomepageChatView layout exactly.
 * Uses a static fake AuthContext (provided by PublicHomepageLayout in routes/index.tsx)
 * so no API calls or login redirects happen.
 *
 * - Directory variant: real DirectoryHomepage search bar (no auth deps)
 * - StreetBot variant: visual replica of ChatForm that navigates to /login on focus
 *   (authenticated StreetBot users are redirected to /c/new which has the sidebar)
 */
function PublicLanding() {
  const { isAuthenticated } = useAuthContext();
  const { pathname } = useLocation();

  // Authenticated StreetBot users at / → redirect to /home (renders inside Root with sidebar)
  if (isAuthenticated && isStreetBot && pathname !== '/home') {
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      className={cn(
        'relative flex w-full overflow-hidden',
        isStreetBot ? 'bg-transparent' : 'bg-presentation',
      )}
      style={{ height: '100dvh' }}
    >
      {isStreetBot && <GlassBackground />}
      <main className="relative z-[1] flex h-full w-full flex-col overflow-y-auto" role="main">
        <div className="relative flex h-full min-h-full w-full flex-col sm:min-h-full">
          <HomepageTopNav />
          <>
            <div
              className={cn(
                'flex flex-1 flex-col items-center',
                isDirectory
                  ? 'justify-end sm:mt-[-56px] sm:justify-center lg:justify-start lg:pt-[30vh] 2xl:justify-center 2xl:pt-0'
                  : 'justify-start pt-[25dvh] sm:justify-center sm:pt-0',
              )}
            >
              {/* Landing logo — matches Landing component's centerFormOnLanding=true layout:
                  max-h-full on mobile (logo visible), sm:max-h-0 on desktop (logo collapsed, only chat input centered) */}
              <div
                className={cn(
                  // Match New Chat landing hero layout for StreetBot exactly.
                  isDirectory
                    ? 'mb-0 flex shrink-0 transform-gpu flex-col items-center justify-center transition-all duration-200'
                    : 'mb-0 flex transform-gpu flex-col items-center justify-center transition-all duration-200',
                  !isDirectory && 'sm:h-full sm:max-h-0 sm:-translate-y-6',
                )}
              >
                <div
                  className={cn(
                    'flex origin-center flex-col items-center gap-0 p-2',
                    isDirectory
                      ? 'mb-1 mt-[28dvh] scale-[0.853] sm:mb-6 sm:mt-0 sm:scale-100'
                      : 'mb-10 sm:mb-40',
                  )}
                >
                  <div
                    className={cn(
                      'flex flex-col items-center justify-center px-6',
                      isDirectory ? 'py-2 sm:py-6' : 'py-8',
                    )}
                  >
                    {variantConfig.landingLogo.darkIcon && (
                      <div className="flex items-center justify-center">
                        <img
                          src={variantConfig.landingLogo.darkIcon}
                          className="hidden dark:block"
                          alt={variantConfig.landingLogo.alt}
                          width={80}
                          height={80}
                          loading="eager"
                          style={{ width: variantConfig.landingLogo.iconWidth, height: 'auto' }}
                        />
                        <img
                          src={variantConfig.landingLogo.lightIcon}
                          className="block dark:hidden"
                          alt={variantConfig.landingLogo.alt}
                          width={80}
                          height={80}
                          loading="eager"
                          style={{ width: variantConfig.landingLogo.iconWidth, height: 'auto' }}
                        />
                      </div>
                    )}
                    <div
                      className="flex items-center justify-center"
                      style={{ marginTop: variantConfig.landingLogo.darkIcon ? 8 : 0 }}
                    >
                      <img
                        src={variantConfig.landingLogo.darkText}
                        className="hidden dark:block"
                        alt={variantConfig.landingLogo.alt}
                        width={250}
                        height={40}
                        loading="eager"
                        style={{ width: variantConfig.landingLogo.textWidth, height: 'auto' }}
                      />
                      <img
                        src={variantConfig.landingLogo.lightText}
                        className="block dark:hidden"
                        alt={variantConfig.landingLogo.alt}
                        width={250}
                        height={40}
                        loading="eager"
                        style={{ width: variantConfig.landingLogo.textWidth, height: 'auto' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {isDirectory ? <DirectoryHomepage /> : <PublicChatInput />}
            </div>
            <HomepageNews />
            <HomepageFooter />
          </>
        </div>
      </main>
    </div>
  );
}

/**
 * Pixel-perfect replica of the ChatForm input for unauthenticated users.
 * Clicking anywhere navigates to /c/new (auth will redirect to /login).
 * Matches: PlusButton + textarea + AudioRecorder + SendButton layout.
 */
function PublicChatInput() {
  const navigate = useNavigate();
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const [isVoicePreviewActive, setIsVoicePreviewActive] = useState(false);
  const go = () => navigate('/c/new');

  const stopVoicePreview = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    setIsVoicePreviewActive(false);
  }, []);

  const handleVoicePreviewClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (isVoicePreviewActive) {
        stopVoicePreview();
        return;
      }

      setIsVoicePreviewActive(true);

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          previewStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }
      } catch {
        // Keep the visible voice affordance even when the browser blocks mic access.
      }

      previewTimeoutRef.current = setTimeout(stopVoicePreview, 12000);
    },
    [isVoicePreviewActive, stopVoicePreview],
  );

  useEffect(() => stopVoicePreview, [stopVoicePreview]);

  return (
    <div
      className={cn('w-full px-6 sm:px-0', 'max-w-3xl transition-all duration-200 xl:max-w-4xl')}
    >
      <div
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go();
        }}
        role="button"
        tabIndex={0}
        className="mx-auto flex w-full cursor-pointer flex-row sm:hidden"
      >
        <div
          className="relative flex min-h-[120px] w-full flex-col justify-between overflow-hidden rounded-[28px] border px-4 py-4 text-text-primary shadow-md transition-all duration-200"
          style={{
            background: 'var(--sb-color-input-bg)',
            borderColor: 'var(--sb-color-input-border)',
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }}
        >
          {isVoicePreviewActive && <VoiceWaveform />}
          <div className="px-1 text-[18px] leading-6 text-text-secondary">
            Message Street Voices 0.5
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-8 items-center justify-center rounded-full text-text-primary">
                <svg
                  className="size-6"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <svg
                  className="size-5"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
                </svg>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="relative z-20 flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover"
                aria-label="Start StreetBot voice"
                aria-pressed={isVoicePreviewActive}
                onClick={handleVoicePreviewClick}
              >
                <svg
                  className="size-6"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <button
                className="rounded-full bg-text-primary p-2 text-text-primary opacity-10 disabled:cursor-not-allowed"
                aria-label="Send message"
                tabIndex={-1}
                disabled
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white dark:text-black"
                  aria-hidden="true"
                >
                  <path
                    d="M7 11L12 6L17 11M12 18V7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden sm:block" style={{ transform: 'translateY(-5px)' }}>
        <div
          onClick={go}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go();
          }}
          role="button"
          tabIndex={0}
          className={cn(
            'mx-auto flex w-full cursor-pointer flex-row gap-3 sm:mb-28 sm:px-2',
            'md:max-w-2xl xl:max-w-3xl',
          )}
        >
          <div className="relative flex h-full flex-1 items-stretch md:flex-col">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  'relative flex w-full flex-grow flex-col overflow-hidden rounded-3xl border text-text-primary shadow-md transition-all duration-200',
                  'border-border-light bg-surface-chat',
                )}
                style={{
                  background: 'var(--sb-color-input-bg)',
                  borderColor: 'var(--sb-color-input-border)',
                  backdropFilter: 'blur(18px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                }}
              >
                {isVoicePreviewActive && <VoiceWaveform />}
                <div className="flex items-center gap-2 px-2 py-1.5">
                  {/* Plus button — matches PlusButton: size-9 rounded-full */}
                  <div className="flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover">
                    <svg
                      className="size-5"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  {/* Textarea placeholder — matches TextareaAutosize area */}
                  <div className="relative flex-1">
                    <div
                      className="m-0 w-full resize-none px-5 py-1 text-text-secondary md:py-1"
                      style={{ height: 24, lineHeight: '24px' }}
                    >
                      Message Street Voices...
                    </div>
                  </div>
                  {/* Mic icon — matches AudioRecorder button */}
                  <button
                    type="button"
                    className="relative z-20 flex size-9 items-center justify-center rounded-full p-1 text-text-secondary hover:bg-surface-hover"
                    aria-label="Start StreetBot voice"
                    aria-pressed={isVoicePreviewActive}
                    onClick={handleVoicePreviewClick}
                  >
                    <svg
                      className="size-5"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                  {/* Send button — matches SendButton: rounded-full bg-text-primary p-1.5, disabled style */}
                  <button
                    className="rounded-full bg-text-primary p-1.5 text-text-primary opacity-10 disabled:cursor-not-allowed"
                    aria-label="Send message"
                    tabIndex={-1}
                    disabled
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-white dark:text-black"
                      aria-hidden="true"
                    >
                      <path
                        d="M7 11L12 6L17 11M12 18V7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(PublicLanding);
