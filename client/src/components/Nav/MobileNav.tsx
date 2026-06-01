import React, { useContext, useMemo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import type { Dispatch, SetStateAction } from 'react';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import { useLocalize, useNewConvo } from '~/hooks';
import { useAuthContext } from '~/hooks';
import { isStreetBot } from '~/config/appVariant';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SideMenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 9h12M5 15h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M15 17H9m9-2V10a6 6 0 1 0-12 0v5l-2 2h16l-2-2ZM10 20h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StreetBotMobileNav({
  setNavVisible,
  navVisible,
}: {
  navVisible: boolean;
  setNavVisible: Dispatch<SetStateAction<boolean>>;
}) {
  const { pathname } = useLocation();
  const { theme, setTheme } = useContext(ThemeContext);
  const { user } = useAuthContext();
  const dark = checkDark(theme);
  const showHome = pathname !== '/home' && pathname !== '/';
  const userInitial = useMemo(
    () => user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?',
    [user?.name, user?.username],
  );

  const toggleNav = useCallback(() => {
    setNavVisible((prev) => {
      localStorage.setItem('navVisible', JSON.stringify(!prev));
      return !prev;
    });
  }, [setNavVisible]);

  const toggleTheme = useCallback(() => {
    setTheme(dark ? 'light' : 'dark');
  }, [dark, setTheme]);

  return (
    <div
      data-streetbot-mobile-nav="true"
      className="sticky top-0 z-[90] flex h-[56px] items-center border-b border-white/5 bg-[#11121b]/96 px-4 text-white md:hidden"
    >
      <button
        type="button"
        aria-label={navVisible ? 'Close sidebar' : 'Open sidebar'}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90"
        onClick={toggleNav}
      >
        <SideMenuIcon />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {showHome && (
          <Link
            to="/home"
            aria-label="Home"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-white"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white"
        >
          <BellIcon />
          <span className="absolute -right-1 -top-1 rounded-full bg-[#ff2f5f] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            16
          </span>
        </Link>
        <button
          type="button"
          aria-label="Toggle theme"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/90"
          onClick={toggleTheme}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
        <Link
          to="/settings"
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name || 'Profile'} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b84c6] text-xs font-bold text-white">
              {userInitial}
            </div>
          )}
        </Link>
        <button
          type="button"
          aria-label={navVisible ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/90"
          onClick={toggleNav}
        >
          <MenuIcon />
        </button>
      </div>
    </div>
  );
}

function DefaultMobileNav({
  setNavVisible,
  navVisible,
}: {
  navVisible: boolean;
  setNavVisible: Dispatch<SetStateAction<boolean>>;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const { title = 'New Chat' } = conversation || {};

  return (
    <div className="bg-token-main-surface-primary sticky top-0 z-10 flex min-h-[40px] items-center justify-center bg-presentation pl-1 dark:text-white md:hidden">
      <button
        type="button"
        data-testid="mobile-header-new-chat-button"
        aria-label={
          navVisible ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')
        }
        aria-live="polite"
        className="m-1 inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-active-alt"
        onClick={() =>
          setNavVisible((prev) => {
            localStorage.setItem('navVisible', JSON.stringify(!prev));
            return !prev;
          })
        }
      >
        <span className="sr-only">
          {navVisible ? localize('com_nav_close_sidebar') : localize('com_nav_open_sidebar')}
        </span>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="icon-md"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3 8C3 7.44772 3.44772 7 4 7H20C20.5523 7 21 7.44772 21 8C21 8.55228 20.5523 9 20 9H4C3.44772 9 3 8.55228 3 8ZM3 16C3 15.4477 3.44772 15 4 15H14C14.5523 15 15 15.4477 15 16C15 16.5523 14.5523 17 14 17H4C3.44772 17 3 16.5523 3 16Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <h1 className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-center text-sm font-normal">
        {title ?? localize('com_ui_new_chat')}
      </h1>
      <button
        type="button"
        aria-label={localize('com_ui_new_chat')}
        className="m-1 inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-active-alt"
        onClick={() => {
          clearMessagesCache(queryClient, conversation?.conversationId);
          queryClient.invalidateQueries([QueryKeys.messages]);
          newConversation();
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="icon-md"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16.7929 2.79289C18.0118 1.57394 19.9882 1.57394 21.2071 2.79289C22.4261 4.01184 22.4261 5.98815 21.2071 7.20711L12.7071 15.7071C12.5196 15.8946 12.2652 16 12 16H9C8.44772 16 8 15.5523 8 15V12C8 11.7348 8.10536 11.4804 8.29289 11.2929L16.7929 2.79289ZM19.7929 4.20711C19.355 3.7692 18.645 3.7692 18.2071 4.2071L10 12.4142V14H11.5858L19.7929 5.79289C20.2308 5.35499 20.2308 4.64501 19.7929 4.20711ZM6 5C5.44772 5 5 5.44771 5 6V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V14C19 13.4477 19.4477 13 20 13C20.5523 13 21 13.4477 21 14V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V6C3 4.34314 4.34315 3 6 3H10C10.5523 3 11 3.44771 11 4C11 4.55228 10.5523 5 10 5H6Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

export default function MobileNav(props: {
  navVisible: boolean;
  setNavVisible: Dispatch<SetStateAction<boolean>>;
}) {
  if (isStreetBot) {
    return <StreetBotMobileNav {...props} />;
  }

  return <DefaultMobileNav {...props} />;
}
