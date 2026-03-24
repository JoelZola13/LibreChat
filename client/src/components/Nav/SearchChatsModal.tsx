import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { TConversation } from 'librechat-data-provider';
import { useNavigate } from 'react-router-dom';

const searchModalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 130,
  padding: 20,
};

const searchModalContentStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  maxHeight: '70vh',
  backgroundColor: 'rgba(18, 19, 27, 0.95)',
  borderRadius: 16,
  border: '1px solid rgba(188, 189, 208, 0.12)',
  padding: 20,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const searchModalInputStyle: CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  color: 'rgba(255, 255, 255, 0.95)',
  outline: 'none',
  fontFamily: 'Rubik, sans-serif',
};

type SearchChatsModalProps = {
  conversations: TConversation[];
  onClose: () => void;
  onNewChat: () => void;
};

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function isWithinLast7Days(date: Date): boolean {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  return date >= sevenDaysAgo && !isToday(date) && !isYesterday(date);
}

const entryButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: 'rgba(255, 255, 255, 0.85)',
  fontFamily: 'Rubik, sans-serif',
  fontSize: 14,
  cursor: 'pointer',
  borderRadius: 10,
  textAlign: 'left' as const,
  transition: 'background 0.15s ease',
};

const sectionLabelStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: 11,
  fontFamily: 'Rubik, sans-serif',
  letterSpacing: '0.08em',
  marginBottom: 8,
  paddingLeft: 12,
  textTransform: 'uppercase' as const,
};

const iconCircleStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export default function SearchChatsModal({ conversations, onClose, onNewChat }: SearchChatsModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filterConversations = useCallback(
    (convos: TConversation[]) => {
      if (!query) return convos;
      const q = query.toLowerCase();
      return convos.filter((c) => c.title?.toLowerCase().includes(q));
    },
    [query],
  );

  const { today, yesterday, last7Days, older } = useMemo(() => {
    const groups = {
      today: [] as TConversation[],
      yesterday: [] as TConversation[],
      last7Days: [] as TConversation[],
      older: [] as TConversation[],
    };

    for (const convo of conversations) {
      const date = new Date(convo.updatedAt ?? convo.createdAt);
      if (isToday(date)) {
        groups.today.push(convo);
      } else if (isYesterday(date)) {
        groups.yesterday.push(convo);
      } else if (isWithinLast7Days(date)) {
        groups.last7Days.push(convo);
      } else {
        groups.older.push(convo);
      }
    }

    return groups;
  }, [conversations]);

  const filteredToday = useMemo(() => filterConversations(today), [filterConversations, today]);
  const filteredYesterday = useMemo(() => filterConversations(yesterday), [filterConversations, yesterday]);
  const filteredLast7 = useMemo(() => filterConversations(last7Days), [filterConversations, last7Days]);
  const filteredOlder = useMemo(() => filterConversations(older), [filterConversations, older]);

  const hasResults = filteredToday.length + filteredYesterday.length + filteredLast7.length + filteredOlder.length > 0;

  const handleConvoClick = (conversationId: string | null) => {
    if (conversationId) {
      navigate(`/c/${conversationId}`);
    }
    onClose();
  };

  const renderEntry = (convo: TConversation) => (
    <button
      key={convo.conversationId}
      type="button"
      style={entryButtonStyle}
      onClick={() => handleConvoClick(convo.conversationId)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={iconCircleStyle}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {convo.title || 'New Chat'}
      </span>
    </button>
  );

  const renderSection = (label: string, convos: TConversation[]) => {
    if (convos.length === 0) return null;
    return (
      <div style={{ marginTop: 16 }}>
        <p style={sectionLabelStyle}>{label}</p>
        {convos.map(renderEntry)}
      </div>
    );
  };

  return (
    <div style={searchModalBackdropStyle} onClick={onClose}>
      <div
        style={searchModalContentStyle}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row with ESC hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <input
            type="search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            style={{ ...searchModalInputStyle, flex: 1, margin: 0 }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
              padding: '4px 8px',
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
            }}
            aria-label="Close search (ESC)"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
            }}
          >
            ESC
          </button>
        </div>

        {/* Scrollable chat list */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {/* New chat option */}
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.95)',
              fontFamily: 'Rubik, sans-serif',
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: 10,
              transition: 'background 0.15s ease',
            }}
            onClick={() => {
              onNewChat();
              onClose();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <img
              src="/images/streetbot/icon-edit.svg"
              alt="New chat"
              width={18}
              height={18}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            />
            <span>New chat</span>
          </button>

          {renderSection('Today', filteredToday)}
          {renderSection('Yesterday', filteredYesterday)}
          {renderSection('Previous 7 days', filteredLast7)}
          {renderSection('Older', filteredOlder)}

          {/* No results message */}
          {query && !hasResults && (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
              No chats found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
