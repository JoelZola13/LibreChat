import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import { useActiveUser } from './useActiveUser';
import { SB_API_BASE } from './apiConfig';
import { profilePhotoAlt, sampleProfilePhotoForName } from './sampleProfilePhotos';
import { SOCIAL_SAMPLE_GROUPS } from './socialNetworkSamples';

const SESSION_USER_CACHE_KEY = 'streetbot:session-user:v1';
const EXPLICIT_LOGOUT_KEY = 'streetbot:explicit-logout';
const QUICK_ACCESS_STORAGE_PREFIX = 'streetbot:account-quick-access:v1';
const SEEDED_ACADEMY_COURSE_ID = '0a2bab81-edda-4fd9-9ef6-a6d0cd2d2746';
const SEEDED_ACADEMY_COURSE_TITLE = 'Networking with Kadiatu';
const SEEDED_ACADEMY_PROGRESS_PERCENT = 36;
const ACCOUNT_MENU_LABELS = {
  courses: 'Courses',
  viewAllCourses: 'View all courses',
  assignedTasks: 'Assigned Tasks',
  calendar: 'Calendar',
  openCalendar: 'Open calendar',
  jobs: 'Jobs',
  groups: 'Groups',
  seeAllGroups: 'See all groups',
  employerWorkspace: 'Employer Workspace',
  employeeWorkspace: 'Employee Workspace',
  studentWorkspace: 'Student Workspace',
  instructorWorkspace: 'Instructor Workspace',
  messages: 'Messages',
  tasks: 'Tasks',
  logout: 'Logout',
  streetVoices: 'Street Voices',
};

type QuickAccessItem = {
  title: string;
  href: string;
  meta: string;
  badge?: string;
};

type AccountQuickAccess = {
  courses: QuickAccessItem[];
  tasks: QuickAccessItem[];
  calendar: QuickAccessItem[];
  jobs: QuickAccessItem[];
  groups: QuickAccessItem[];
};

type TopRightAccountMenuProps = {
  dark?: boolean;
  size?: number;
  align?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
};

function getActiveUserId(activeUser: any) {
  return (
    activeUser?.id || activeUser?._id || activeUser?.username || activeUser?.email || 'street-user'
  );
}

function getQuickAccessKey(userId: string) {
  return `${QUICK_ACCESS_STORAGE_PREFIX}:${userId}`;
}

function buildDefaultQuickAccess(): AccountQuickAccess {
  return {
    courses: [
      {
        title: SEEDED_ACADEMY_COURSE_TITLE,
        href: `/academy/courses/${SEEDED_ACADEMY_COURSE_ID}`,
        meta: 'Street Voices Media Training',
        badge: 'Enrolled',
      },
    ],
    tasks: [
      {
        title: 'Upload intro assignment draft',
        href: '/tasks',
        meta: 'Due tomorrow - Academy',
        badge: 'High',
      },
      {
        title: 'Review group discussion replies',
        href: '/tasks',
        meta: '2 comments waiting - Groups',
      },
    ],
    calendar: [
      {
        title: 'Media training cohort session',
        href: '/myprofile?tab=calendar',
        meta: 'Today, 6:00 PM - Profile calendar',
        badge: 'Today',
      },
      {
        title: 'Portfolio review block',
        href: '/myprofile?tab=calendar',
        meta: 'Tomorrow, 2:00 PM - Availability',
      },
    ],
    jobs: [
      {
        title: 'Volunteer Writer application',
        href: '/jobs/employee-workspace',
        meta: 'Applied - Street Voices',
        badge: 'Active',
      },
      {
        title: 'Saved creative roles',
        href: '/jobs?saved=1',
        meta: '3 saved jobs',
      },
    ],
    groups: SOCIAL_SAMPLE_GROUPS.filter((group) => group.is_member)
      .slice(0, 3)
      .map((group) => ({
        title: group.name,
        href: `/groups/${group.id}`,
        meta: `${group.member_count} members`,
        badge: group.category,
      })),
  };
}

function writeQuickAccess(userId: string, quickAccess: AccountQuickAccess) {
  try {
    localStorage.setItem(getQuickAccessKey(userId), JSON.stringify(quickAccess));
  } catch {
    // noop
  }
}

async function ensureSeededAcademyEnrollment(userId: string) {
  try {
    localStorage.setItem('streetbot:user-id', userId);

    const enrollmentsResponse = await fetch(
      `${SB_API_BASE}/api/academy/enrollments/${encodeURIComponent(userId)}`,
    );
    if (enrollmentsResponse.ok) {
      const enrollments = await enrollmentsResponse.json();
      const existingEnrollment = Array.isArray(enrollments)
        ? enrollments.find(
            (entry) => entry?.course_id === SEEDED_ACADEMY_COURSE_ID && entry?.status !== 'dropped',
          )
        : null;
      if (existingEnrollment) return;
    }

    await fetch(`${SB_API_BASE}/api/academy/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: SEEDED_ACADEMY_COURSE_ID,
        user_id: userId,
        status: 'active',
        progress_percent: SEEDED_ACADEMY_PROGRESS_PERCENT,
      }),
    });
  } catch {
    // The menu still uses local synthetic data if the API is unavailable.
  }
}

export default function TopRightAccountMenu({
  dark = true,
  size = 28,
  align = 'right',
  className,
  style,
}: TopRightAccountMenuProps) {
  const { activeUser } = useActiveUser();
  const { logout, isAuthenticated } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [quickAccess, setQuickAccess] = useState<AccountQuickAccess | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeUserId = activeUser ? getActiveUserId(activeUser) : null;

  const userInitial =
    activeUser?.name?.charAt(0)?.toUpperCase() ||
    activeUser?.username?.charAt(0)?.toUpperCase() ||
    '?';

  useEffect(() => {
    setAvatarLoadError(false);
  }, [activeUser?.avatar]);

  useEffect(() => {
    if (!activeUserId) {
      setQuickAccess(null);
      return;
    }

    const seeded = buildDefaultQuickAccess();
    writeQuickAccess(activeUserId, seeded);
    setQuickAccess(seeded);
    void ensureSeededAcademyEnrollment(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const markLoggedOut = useCallback(() => {
    try {
      sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, '1');
      sessionStorage.removeItem(SESSION_USER_CACHE_KEY);
    } catch {
      // noop
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    markLoggedOut();

    if (isAuthenticated) {
      logout('/home?redirect=false');
      return;
    }

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // The local session cache is already cleared, so keep moving.
    }

    window.location.assign('/home?redirect=false');
  }, [isAuthenticated, logout, markLoggedOut]);

  if (!activeUser) {
    return null;
  }

  const menuBg = dark ? 'rgba(30, 31, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const menuBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(17, 24, 39, 0.12)';
  const text = dark ? '#E6E7F2' : '#111827';
  const muted = dark ? 'rgba(230,231,242,0.66)' : 'rgba(17,24,39,0.62)';
  const hoverBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)';
  const badgeBg = dark ? 'rgba(255, 214, 0, 0.16)' : 'rgba(255, 214, 0, 0.28)';

  const quickSectionStyle: CSSProperties = {
    padding: '8px 2px',
  };

  const quickSectionTitleStyle: CSSProperties = {
    margin: '0 8px 6px',
    color: muted,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  };

  const quickLinkStyle: CSSProperties = {
    display: 'block',
    padding: '9px 10px',
    borderRadius: 10,
    color: text,
    textDecoration: 'none',
  };

  const profileRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 10px',
    borderRadius: 12,
    color: text,
    textDecoration: 'none',
  };

  const groupAvatarStyle: CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: dark ? 'rgba(255, 214, 0, 0.18)' : 'rgba(255, 214, 0, 0.34)',
    border: dark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(17,24,39,0.10)',
    color: dark ? '#FFD600' : '#4b3a00',
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
  };

  const renderUserAvatar = (avatarSize: number) => {
    const avatarUrl =
      activeUser.avatar && !avatarLoadError
        ? activeUser.avatar
        : sampleProfilePhotoForName(activeUser.name || activeUser.username);

    return avatarUrl ? (
      <img
        src={avatarUrl}
        alt={profilePhotoAlt(activeUser.name || activeUser.username, 'Profile')}
        width={avatarSize}
        height={avatarSize}
        loading="lazy"
        onError={() => setAvatarLoadError(true)}
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    ) : (
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          background: '#7c3aed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: Math.max(10, Math.round(avatarSize * 0.38)),
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {userInitial}
      </div>
    );
  };

  const renderQuickItem = (item: QuickAccessItem) => (
    <Link
      key={`${item.href}-${item.title}`}
      to={item.href}
      role="menuitem"
      onClick={() => setOpen(false)}
      style={quickLinkStyle}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 850, lineHeight: 1.25 }}>
          {item.title}
        </span>
        {item.badge ? (
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              background: badgeBg,
              color: dark ? '#FFD600' : '#7a5b00',
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {item.badge}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 3, color: muted, fontSize: 12, lineHeight: 1.25 }}>{item.meta}</div>
    </Link>
  );

  const renderGroupItem = (item: QuickAccessItem) => (
    <Link
      key={`${item.href}-${item.title}`}
      to={item.href}
      role="menuitem"
      onClick={() => setOpen(false)}
      style={{
        ...quickLinkStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={groupAvatarStyle}>{item.title.slice(0, 2).toUpperCase()}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: text,
            fontSize: 14,
            fontWeight: 850,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.title}
        </span>
        <span style={{ display: 'block', marginTop: 3, color: muted, fontSize: 12 }}>
          {item.meta}
        </span>
      </span>
    </Link>
  );

  const primaryAccountLinkStyle: CSSProperties = {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 8,
    color: text,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
  };

  const attachHover = (element: HTMLElement | null, hovered: boolean) => {
    if (!element) return;
    element.style.background = hovered ? hoverBg : 'transparent';
  };

  return (
    <div ref={menuRef} className={className} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size + 8,
          height: size + 8,
          border: 'none',
          borderRadius: '50%',
          background: 'transparent',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        {renderUserAvatar(size)}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: align === 'right' ? 0 : 'auto',
            left: align === 'left' ? 0 : 'auto',
            width: 326,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'min(760px, calc(100vh - 86px))',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: 8,
            borderRadius: 12,
            background: menuBg,
            border: `1px solid ${menuBorder}`,
            boxShadow: dark ? '0 18px 48px rgba(0,0,0,0.38)' : '0 18px 40px rgba(17,24,39,0.16)',
            zIndex: 5000,
          }}
        >
          <Link
            to="/myprofile"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={profileRowStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {renderUserAvatar(42)}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  color: text,
                  fontSize: 16,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeUser.name || activeUser.username || ACCOUNT_MENU_LABELS.streetVoices}
              </span>
              {activeUser.email ? (
                <span
                  style={{
                    display: 'block',
                    color: muted,
                    fontSize: 12,
                    lineHeight: 1.3,
                    marginTop: 3,
                  }}
                >
                  {activeUser.email}
                </span>
              ) : null}
            </span>
          </Link>
          <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />

          {quickAccess?.groups.length ? (
            <>
              <div style={quickSectionStyle}>
                <div style={quickSectionTitleStyle}>{ACCOUNT_MENU_LABELS.groups}</div>
                {quickAccess.groups.map(renderGroupItem)}
                <Link
                  to="/groups"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  style={{
                    ...quickLinkStyle,
                    color: dark ? '#FFD600' : '#7a5b00',
                    fontSize: 13,
                    fontWeight: 900,
                    textAlign: 'center',
                    background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.08)',
                    marginTop: 6,
                  }}
                >
                  {ACCOUNT_MENU_LABELS.seeAllGroups}
                </Link>
              </div>
              <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />
            </>
          ) : null}

          {quickAccess?.courses.length ? (
            <>
              <div style={quickSectionStyle}>
                <div style={quickSectionTitleStyle}>{ACCOUNT_MENU_LABELS.courses}</div>
                {quickAccess.courses.map(renderQuickItem)}
                <Link
                  to="/academy/student-workspace"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  style={{
                    ...quickLinkStyle,
                    color: dark ? '#FFD600' : '#7a5b00',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {ACCOUNT_MENU_LABELS.viewAllCourses}
                </Link>
              </div>
              <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />
            </>
          ) : null}

          {quickAccess?.tasks.length ? (
            <>
              <div style={quickSectionStyle}>
                <div style={quickSectionTitleStyle}>{ACCOUNT_MENU_LABELS.assignedTasks}</div>
                {quickAccess.tasks.map(renderQuickItem)}
              </div>
              <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />
            </>
          ) : null}

          {quickAccess?.calendar.length ? (
            <>
              <div style={quickSectionStyle}>
                <div style={quickSectionTitleStyle}>{ACCOUNT_MENU_LABELS.calendar}</div>
                {quickAccess.calendar.map(renderQuickItem)}
                <Link
                  to="/myprofile?tab=calendar"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  style={{
                    ...quickLinkStyle,
                    color: dark ? '#FFD600' : '#7a5b00',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {ACCOUNT_MENU_LABELS.openCalendar}
                </Link>
              </div>
              <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />
            </>
          ) : null}

          {quickAccess?.jobs.length ? (
            <>
              <div style={quickSectionStyle}>
                <div style={quickSectionTitleStyle}>{ACCOUNT_MENU_LABELS.jobs}</div>
                {quickAccess.jobs.map(renderQuickItem)}
              </div>
              <div style={{ height: 1, background: menuBorder, margin: '0 2px 6px' }} />
            </>
          ) : null}

          <Link
            to="/jobs/employer"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.employerWorkspace}
          </Link>
          <Link
            to="/jobs/employee-workspace"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.employeeWorkspace}
          </Link>
          <Link
            to="/academy/student-workspace"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.studentWorkspace}
          </Link>
          <Link
            to="/academy/instructor"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.instructorWorkspace}
          </Link>
          <Link
            to="/messages"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.messages}
          </Link>
          <Link
            to="/tasks"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={primaryAccountLinkStyle}
            onMouseEnter={(event) => attachHover(event.currentTarget, true)}
            onMouseLeave={(event) => attachHover(event.currentTarget, false)}
          >
            {ACCOUNT_MENU_LABELS.tasks}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'block',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              fontSize: 14,
              fontWeight: 800,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = hoverBg;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            {ACCOUNT_MENU_LABELS.logout}
          </button>
        </div>
      )}
    </div>
  );
}
