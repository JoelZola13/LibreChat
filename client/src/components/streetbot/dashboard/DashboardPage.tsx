import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  MessageSquare,
  FileText,
  BookOpen,
  Activity,
  Zap,
  AlertTriangle,
  ArrowRight,
  Plus,
  Search,
  Briefcase,
  RefreshCw,
  Loader2,
  Clock,
} from 'lucide-react';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useDashboardData } from './useDashboardData';
import type { DashboardData } from './useDashboardData';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Skeleton shimmer ── */
function Skeleton({ width, height = 16 }: { width: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.06)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

/* ── Widget wrapper ── */
function WidgetCard({
  icon: Icon,
  iconColor,
  title,
  linkTo,
  linkLabel,
  loading,
  error,
  onRetry,
  children,
  colors,
  glassCard,
  cardHoverHandlers,
}: {
  icon: typeof CheckSquare;
  iconColor: string;
  title: string;
  linkTo: string;
  linkLabel?: string;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        ...glassCard,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => navigate(linkTo)}
      {...cardHoverHandlers}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${iconColor}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
          <span style={{ color: colors.text, fontWeight: 600, fontSize: 15 }}>{title}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: colors.textMuted,
            fontSize: 12,
          }}
        >
          <span>{linkLabel || 'View all'}</span>
          <ArrowRight size={12} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 60 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="80%" />
            <Skeleton width="60%" />
            <Skeleton width="70%" />
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textMuted, fontSize: 13 }}>
            <span>Could not load</span>
            {onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.accent,
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                }}
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/* ── Tasks Widget ── */
function TasksWidget({ data, colors, glassCard, cardHoverHandlers, onRetry }: {
  data: DashboardData;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
  onRetry: () => void;
}) {
  const todayCount = data.tasksToday.data?.length ?? 0;
  const overdueCount = data.tasksOverdue.data?.length ?? 0;
  const tasks = data.tasksToday.data?.slice(0, 3) ?? [];

  return (
    <WidgetCard
      icon={CheckSquare}
      iconColor="#22c55e"
      title="Tasks"
      linkTo="/tasks"
      loading={data.tasksToday.loading}
      error={data.tasksToday.error}
      onRetry={onRetry}
      colors={colors}
      glassCard={glassCard}
      cardHoverHandlers={cardHoverHandlers}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <span style={{ color: colors.text, fontSize: 24, fontWeight: 700 }}>{todayCount}</span>
        <span style={{ color: colors.textMuted, fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 }}>today</span>
        {overdueCount > 0 && (
          <span style={{ color: colors.error, fontSize: 13, alignSelf: 'flex-end', marginBottom: 2, fontWeight: 600 }}>
            {overdueCount} overdue
          </span>
        )}
      </div>
      {tasks.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '4px 0',
            fontSize: 13,
            color: colors.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ color: t.status === 'done' ? colors.success : colors.textSecondary, marginRight: 6 }}>
            {t.status === 'done' ? '✓' : '○'}
          </span>
          {t.name}
        </div>
      ))}
    </WidgetCard>
  );
}

/* ── Messages Widget ── */
function MessagesWidget({ data, colors, glassCard, cardHoverHandlers, onRetry }: {
  data: DashboardData;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
  onRetry: () => void;
}) {
  const convos = data.conversations.data ?? [];
  const total = convos.length;

  return (
    <WidgetCard
      icon={MessageSquare}
      iconColor="#FFD600"
      title="Messages"
      linkTo="/messages"
      loading={data.conversations.loading}
      error={data.conversations.error}
      onRetry={onRetry}
      colors={colors}
      glassCard={glassCard}
      cardHoverHandlers={cardHoverHandlers}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <span style={{ color: colors.text, fontSize: 24, fontWeight: 700 }}>{total}</span>
        <span style={{ color: colors.textMuted, fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 }}>conversations</span>
      </div>
      {convos.slice(0, 2).map((c) => (
        <div
          key={c.id}
          style={{
            padding: '4px 0',
            fontSize: 13,
            color: colors.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ fontWeight: 500, color: colors.text }}>{c.name || `Conversation ${c.id}`}</span>
          {c.last_message?.content && (
            <span style={{ color: colors.textMuted, marginLeft: 6 }}>
              — {c.last_message.content.slice(0, 40)}
            </span>
          )}
        </div>
      ))}
    </WidgetCard>
  );
}

/* ── Documents Widget ── */
function DocumentsWidget({ data, colors, glassCard, cardHoverHandlers, onRetry }: {
  data: DashboardData;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
  onRetry: () => void;
}) {
  const docs = data.recentDocs.data ?? [];

  return (
    <WidgetCard
      icon={FileText}
      iconColor="#3b82f6"
      title="Documents"
      linkTo="/documents"
      loading={data.recentDocs.loading}
      error={data.recentDocs.error}
      onRetry={onRetry}
      colors={colors}
      glassCard={glassCard}
      cardHoverHandlers={cardHoverHandlers}
    >
      {docs.length === 0 ? (
        <span style={{ color: colors.textMuted, fontSize: 13 }}>No recent documents</span>
      ) : (
        docs.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            <FileText size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
            {d.status && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: 'rgba(59,130,246,0.12)',
                  color: '#3b82f6',
                  flexShrink: 0,
                }}
              >
                {d.status}
              </span>
            )}
          </div>
        ))
      )}
    </WidgetCard>
  );
}

/* ── Academy Widget ── */
function AcademyWidget({ data, colors, glassCard, cardHoverHandlers, onRetry }: {
  data: DashboardData;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
  onRetry: () => void;
}) {
  const courses = data.enrollments.data ?? [];
  const inProgress = courses.filter((c) => c.status === 'in_progress' || (c.progress && c.progress < 100)).length;

  return (
    <WidgetCard
      icon={BookOpen}
      iconColor="#8b5cf6"
      title="Academy"
      linkTo="/academy"
      loading={data.enrollments.loading}
      error={data.enrollments.error}
      onRetry={onRetry}
      colors={colors}
      glassCard={glassCard}
      cardHoverHandlers={cardHoverHandlers}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <span style={{ color: colors.text, fontSize: 24, fontWeight: 700 }}>{courses.length}</span>
        <span style={{ color: colors.textMuted, fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 }}>enrolled</span>
        {inProgress > 0 && (
          <span style={{ color: '#8b5cf6', fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 }}>
            {inProgress} in progress
          </span>
        )}
      </div>
      {courses.slice(0, 2).map((c) => (
        <div
          key={c.id}
          style={{
            padding: '4px 0',
            fontSize: 13,
            color: colors.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {c.course_name}
          {c.progress != null && (
            <span style={{ color: colors.textMuted, marginLeft: 6 }}>{c.progress}%</span>
          )}
        </div>
      ))}
    </WidgetCard>
  );
}

/* ── Quick Actions Widget ── */
function QuickActionsWidget({ colors, glassCard, cardHoverHandlers }: {
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
}) {
  const navigate = useNavigate();

  const actions = [
    { icon: Plus, label: 'New Task', to: '/tasks', color: '#22c55e' },
    { icon: FileText, label: 'New Doc', to: '/documents', color: '#3b82f6' },
    { icon: Search, label: 'Ask Street Voices', to: '/c/new', color: '#FFD600' },
    { icon: Briefcase, label: 'Find Jobs', to: '/jobs', color: '#f59e0b' },
  ];

  return (
    <div
      style={{
        ...glassCard,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'all 0.3s ease',
      }}
      {...cardHoverHandlers}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(245,158,11,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={18} style={{ color: '#f59e0b' }} />
        </div>
        <span style={{ color: colors.text, fontWeight: 600, fontSize: 15 }}>Quick Actions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.cardBg,
              color: colors.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.surfaceHover;
              e.currentTarget.style.borderColor = a.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.cardBg;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <a.icon size={16} style={{ color: a.color }} />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Activity Feed Widget ── */
function ActivityFeedWidget({ data, colors, glassCard, cardHoverHandlers, onRetry }: {
  data: DashboardData;
  colors: ReturnType<typeof useGlassStyles>['colors'];
  glassCard: ReturnType<typeof useGlassStyles>['glassCard'];
  cardHoverHandlers: ReturnType<typeof useGlassStyles>['cardHoverHandlers'];
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const items = data.activityFeed.data ?? [];

  const iconForType = (type?: string) => {
    switch (type) {
      case 'task': return CheckSquare;
      case 'document': return FileText;
      case 'message': return MessageSquare;
      case 'course': return BookOpen;
      default: return Activity;
    }
  };

  const colorForType = (type?: string) => {
    switch (type) {
      case 'task': return '#22c55e';
      case 'document': return '#3b82f6';
      case 'message': return '#FFD600';
      case 'course': return '#8b5cf6';
      default: return '#06b6d4';
    }
  };

  return (
    <div
      style={{
        ...glassCard,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        transition: 'all 0.3s ease',
        gridColumn: '1 / -1',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(6,182,212,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Activity size={18} style={{ color: '#06b6d4' }} />
          </div>
          <span style={{ color: colors.text, fontWeight: 600, fontSize: 15 }}>Recent Activity</span>
        </div>
      </div>

      {data.activityFeed.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Skeleton width={28} height={28} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Skeleton width="70%" />
                <Skeleton width="40%" height={12} />
              </div>
            </div>
          ))}
        </div>
      ) : data.activityFeed.error ? (
        <div style={{ color: colors.textMuted, fontSize: 13 }}>
          Could not load activity.{' '}
          <button
            onClick={onRetry}
            style={{ background: 'none', border: 'none', color: colors.accent, cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <span style={{ color: colors.textMuted, fontSize: 13 }}>No recent activity</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item) => {
            const Icon = iconForType(item.entity_type);
            const itemColor = colorForType(item.entity_type);
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 6px',
                  borderRadius: 10,
                  cursor: item.link ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onClick={item.link ? () => navigate(item.link!) : undefined}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${itemColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} style={{ color: itemColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.description || item.action || 'Activity'}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={10} />
                  {relativeTime(item.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Dashboard ── */
export default function DashboardPage() {
  const { colors, glassCard, cardHoverHandlers, accentButton } = useGlassStyles();
  const data = useDashboardData();
  const overdueCount = data.tasksOverdue.data?.length ?? 0;
  const navigate = useNavigate();

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <GlassBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 960,
          margin: '0 auto',
          padding: '32px 20px 60px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: colors.text, fontSize: 28, fontWeight: 700, margin: 0, fontFamily: "'Rubik', sans-serif" }}>
              {getGreeting()}
            </h1>
            <p style={{ color: colors.textMuted, fontSize: 14, margin: '4px 0 0' }}>{formatDate()}</p>
          </div>
          <button
            onClick={data.refresh}
            title="Refresh"
            style={{
              background: 'none',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: 8,
              borderRadius: 10,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = colors.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; }}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 14,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: 20,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/tasks?filter=overdue')}
          >
            <AlertTriangle size={18} style={{ color: colors.error }} />
            <span style={{ color: colors.error, fontSize: 14, fontWeight: 500 }}>
              You have {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
            </span>
            <ArrowRight size={14} style={{ color: colors.error, marginLeft: 'auto' }} />
          </div>
        )}

        {/* Widget grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          <TasksWidget data={data} colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} onRetry={data.refresh} />
          <MessagesWidget data={data} colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} onRetry={data.refresh} />
          <DocumentsWidget data={data} colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} onRetry={data.refresh} />
          <AcademyWidget data={data} colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} onRetry={data.refresh} />
          <QuickActionsWidget colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} />
          <ActivityFeedWidget data={data} colors={colors} glassCard={glassCard} cardHoverHandlers={cardHoverHandlers} onRetry={data.refresh} />
        </div>
      </div>

      {/* Pulse animation for skeletons */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
