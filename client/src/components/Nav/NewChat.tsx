import React, { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

const palette = {
  textPrimary: '#E6E7F2',
};

const SIDEBAR_ASSET_VERSION = 'sidebar-icons-20260523';
const sidebarAsset = (path: string) => `${path}?v=${SIDEBAR_ASSET_VERSION}`;

export default function NewChat({
  index = 0,
  toggleNav,
  isSmallScreen,
  isMinimized = false,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
  isMinimized?: boolean;
}) {
  const queryClient = useQueryClient();
  const { newConversation: newConvo } = useNewConvo(index);
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);
  const isActive = location.pathname === '/c/new';

  const clickHandler: React.MouseEventHandler<HTMLAnchorElement> = useCallback(
    (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
      navigate('/c/new', { replace: false, state: { focusChat: true } });
      window.setTimeout(() => {
        if (window.location.pathname !== '/c/new') {
          window.history.pushState({}, '', '/c/new');
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
      }, 0);
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, navigate, toggleNav, isSmallScreen],
  );

  if (isMinimized) {
    return (
      <a
        href="/c/new"
        onClick={clickHandler}
        className={`sb-action-btn sv-sidebar-btn sb-action-minimized${isActive ? ' sb-nav-active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: 12,
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          color: palette.textPrimary,
          cursor: 'pointer',
          marginBottom: 12,
          textDecoration: 'none',
        }}
        data-testid="nav-new-chat-button"
        aria-label={localize('com_ui_new_chat')}
        title="New Chat"
      >
        <img
          src={sidebarAsset('/images/sidebar-icons/new-chat.svg')}
          alt=""
          width={18}
          height={18}
          className="sb-action-icon sv-sidebar-icon"
        />
      </a>
    );
  }

  return (
    <a
      href="/c/new"
      onClick={clickHandler}
      className={`sb-action-btn sv-sidebar-btn${isActive ? ' sb-nav-active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 12,
        padding: '9px 12px',
        borderRadius: 14,
        border: 'none',
        backgroundColor: 'transparent',
        color: palette.textPrimary,
        fontSize: 14,
        lineHeight: '1.125rem',
        fontFamily: 'Rubik, sans-serif',
        fontWeight: 400,
        cursor: 'pointer',
        marginTop: 2,
        marginBottom: 0,
        minHeight: 40,
        textDecoration: 'none',
      }}
      data-testid="nav-new-chat-button"
      aria-label={localize('com_ui_new_chat')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
        <span aria-hidden>
          <img
            src={sidebarAsset('/images/sidebar-icons/new-chat.svg')}
            alt=""
            width={18}
            height={18}
            className="sb-action-icon sv-sidebar-icon"
          />
        </span>
        <span className="sv-sidebar-btn-label">New Chat</span>
      </div>
    </a>
  );
}
