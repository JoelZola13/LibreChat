import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { variantConfig, isDirectory, isStreetBot } from '~/config/appVariant';
import { useAuthContext } from '~/hooks/AuthContext';
import DirectoryHomepage from './DirectoryHomepage';
import HomepageTopNav from './HomepageTopNav';
import HomepageFooter from './HomepageFooter';
import HomepageNews from './HomepageNews';
import { cn } from '~/utils';
import { GlassBackground } from '~/components/streetbot/shared/GlassBackground';
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
      className="relative flex w-full overflow-hidden bg-presentation"
      style={{ height: '100dvh' }}
    >
      {isStreetBot && (
        <style>{`
          @media (max-height: 500px) and (hover: none) {
            .sv-public-streetbot-hero {
              flex: 0 0 auto !important;
              min-height: 300px !important;
              justify-content: flex-start !important;
              padding-top: 72px !important;
            }
            .sv-public-streetbot-logo-wrap {
              height: auto !important;
              max-height: none !important;
              transform: none !important;
            }
            .sv-public-streetbot-logo-group {
              margin-bottom: 18px !important;
              transform: scale(0.72);
              transform-origin: center top;
            }
            .sv-public-streetbot-input {
              max-width: min(620px, calc(100vw - 112px)) !important;
            }
            .sv-public-streetbot-input-offset {
              transform: none !important;
            }
          }
        `}</style>
      )}
      {isStreetBot && <GlassBackground />}
      <main className="relative z-[1] flex h-full w-full flex-col overflow-y-auto" role="main">
        <div className="relative flex min-h-full w-full flex-col">
          <HomepageTopNav />
          <>
            <div
              className={cn(
                'flex flex-col items-center',
                isStreetBot && 'sv-public-streetbot-hero',
                isDirectory
                  ? 'flex-1 justify-start pt-[20dvh] sm:mt-[-56px] sm:pt-[17dvh] lg:min-h-[560px] lg:flex-none lg:pt-[29vh] xl:pt-[28vh] 2xl:pt-[27vh]'
                  : 'min-h-[calc(100dvh-72px)] flex-1 justify-center sm:min-h-0 sm:justify-center lg:justify-start lg:pt-[30vh] 2xl:justify-center 2xl:pt-0',
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
                  !isDirectory &&
                    'h-auto max-h-none translate-y-0 sm:h-full sm:max-h-0 sm:-translate-y-6',
                  isStreetBot && 'sv-public-streetbot-logo-wrap',
                )}
              >
                <div
                  className={cn(
                    'flex origin-center flex-col items-center gap-0 p-2',
                    isDirectory
                      ? 'mb-1 mt-[28dvh] translate-y-0 scale-[0.768] sm:mb-6 sm:mt-0 sm:translate-y-[25px] sm:scale-[0.81]'
                      : 'mb-[45px] sm:mb-40',
                    isStreetBot && 'sv-public-streetbot-logo-group',
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
      className={cn('w-full px-4 sm:px-0', 'max-w-3xl transition-all duration-200 xl:max-w-4xl')}
    >
      <div className="sv-public-streetbot-input-offset" style={{ transform: 'translateY(-5px)' }}>
        <div
          onClick={go}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go();
          }}
          role="button"
          tabIndex={0}
          className={cn(
            'sv-public-streetbot-input',
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
                {isVoicePreviewActive && (
                  <VoiceWaveform
                    status="StreetBot voice preview is listening"
                    className="bottom-2 left-14 right-24"
                  />
                )}
                <div className="flex min-h-[104px] flex-col justify-between px-4 py-4 sm:min-h-[112px] sm:px-5 sm:py-4">
                  <div className="flex items-start gap-2">
                    <div
                      className="min-w-0 flex-1 truncate whitespace-nowrap pt-0.5 text-[16px] leading-6 text-text-secondary sm:text-base"
                    >
                      Message Street Voices 0.5
                    </div>
                    <button
                      type="button"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full p-1 text-text-secondary hover:bg-surface-hover sm:size-9"
                      aria-label="Open message options"
                      tabIndex={-1}
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
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-2">
                    {/* Attach button — matches the signed-in input control row */}
                    <div className="flex size-8 items-center justify-center rounded-full p-1 hover:bg-surface-hover sm:size-9">
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
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </div>
                    <div
                      className="flex size-8 items-center justify-center rounded-full bg-blue-600/20 p-1 text-blue-300 sm:size-9"
                      title="Share your location"
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
                        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="mx-auto flex" />
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full p-1 text-text-secondary hover:bg-surface-hover sm:size-9"
                      aria-label="Message controls"
                      tabIndex={-1}
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
                        <line x1="21" x2="14" y1="4" y2="4" />
                        <line x1="10" x2="3" y1="4" y2="4" />
                        <line x1="21" x2="12" y1="12" y2="12" />
                        <line x1="8" x2="3" y1="12" y2="12" />
                        <line x1="21" x2="16" y1="20" y2="20" />
                        <line x1="12" x2="3" y1="20" y2="20" />
                        <line x1="14" x2="14" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="10" y2="14" />
                        <line x1="16" x2="16" y1="18" y2="22" />
                      </svg>
                    </button>
                    {/* Mic icon — matches AudioRecorder button */}
                    <button
                      type="button"
                      onClick={handleVoicePreviewClick}
                      className={cn(
                        'relative z-20 flex size-8 items-center justify-center rounded-full p-1 text-text-secondary hover:bg-surface-hover sm:size-9',
                        isVoicePreviewActive &&
                          'bg-red-500/10 ring-1 ring-red-500/40 hover:bg-red-500/15 dark:bg-red-500/15',
                      )}
                      aria-label="Start StreetBot voice"
                      aria-pressed={isVoicePreviewActive}
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
                    {/* Send button — matches SendButton disabled style */}
                    <button
                      className="rounded-full bg-text-primary p-1 text-text-primary opacity-10 disabled:cursor-not-allowed sm:p-1.5"
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
    </div>
  );
}

export default memo(PublicLanding);
