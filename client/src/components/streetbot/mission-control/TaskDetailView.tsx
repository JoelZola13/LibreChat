import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Circle, Clock, CheckCircle2, AlertCircle, User, Bot,
  ListTodo, Activity, MessageSquare, ChevronDown, ChevronRight, Send,
  Loader2, Tag,
} from 'lucide-react';
import { paperclipFetch } from './config';
import type { PaperclipIssue, PaperclipAgent, ActivityItem } from './types';

// ── Helpers ──

function relativeTime(dateStr?: string | null): string {
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#F59E0B', in_progress: '#3B82F6', done: '#10B981', backlog: '#6B7280', blocked: '#EF4444',
};
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog', blocked: 'Blocked',
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280',
};

interface Props {
  identifier: string;
  allIssues: PaperclipIssue[];
  allAgents: PaperclipAgent[];
  colors: any;
  glassSurface: React.CSSProperties;
  isDark: boolean;
  onBack: () => void;
  onNavigateTask: (identifier: string) => void;
}

export default function TaskDetailView({ identifier, allIssues, allAgents, colors, glassSurface, isDark, onBack, onNavigateTask }: Props) {
  const [activeTab, setActiveTab] = useState<'comments' | 'subtasks' | 'activity'>('comments');
  const [subtasks, setSubtasks] = useState<PaperclipIssue[]>([]);
  const [issueActivity, setIssueActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const issue = useMemo(() => allIssues.find(i => i.identifier === identifier), [allIssues, identifier]);

  const agentMap = useMemo(() => {
    const map = new Map<string, PaperclipAgent>();
    allAgents.forEach(a => map.set(a.id, a));
    return map;
  }, [allAgents]);

  const assignee = issue?.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : null;
  const creator = issue?.createdByAgentId ? agentMap.get(issue.createdByAgentId) : null;

  // Load subtasks and activity
  useEffect(() => {
    if (!issue) return;
    // Subtasks: filter from allIssues by parentId
    setSubtasks(allIssues.filter(i => i.parentId === issue.id));
    // Activity for this issue
    setLoadingActivity(true);
    paperclipFetch<ActivityItem[]>(`/activity?entityId=${issue.id}`)
      .then(items => setIssueActivity(items))
      .catch(() => setIssueActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [issue, allIssues]);

  // Separate comments from other activity
  const comments = useMemo(() =>
    issueActivity.filter(a => a.action === 'issue.comment_added'),
    [issueActivity]
  );

  const activityItems = useMemo(() =>
    issueActivity.filter(a => a.action !== 'issue.comment_added'),
    [issueActivity]
  );

  if (!issue) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={32} color="#EF4444" style={{ marginBottom: 12 }} />
        <div style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 600 }}>Task not found</div>
        <div style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: 4 }}>{identifier}</div>
        <button onClick={onBack} style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 10, border: `1px solid ${colors.border}`,
          background: 'transparent', color: colors.text, cursor: 'pointer', fontSize: '0.85rem',
        }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[issue.status] || '#6B7280';
  const priorityColor = PRIORITY_COLORS[issue.priority] || '#6B7280';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
    color: active ? colors.text : colors.textMuted,
  });

  return (
    <div>
      {/* Back button + breadcrumb */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
        border: 'none', background: 'transparent', color: colors.textSecondary, cursor: 'pointer',
        fontSize: '0.85rem', marginBottom: 16, transition: 'color 0.15s',
      }}>
        <ArrowLeft size={16} />
        <span>Tasks</span>
        <span style={{ color: colors.textMuted }}>/</span>
        <span style={{ color: colors.text, fontWeight: 600 }}>{issue.identifier}</span>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Main Content */}
        <div>
          {/* Title + Status */}
          <div style={{ ...glassSurface, borderRadius: 20, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <Circle size={12} fill={statusColor} color={statusColor} style={{ marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textMuted, fontFamily: 'monospace' }}>
                  {issue.identifier}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: colors.text, margin: '4px 0 0' }}>
                  {issue.title}
                </h2>
              </div>
            </div>

            {issue.description && (
              <div style={{
                padding: '12px 16px', borderRadius: 12,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                color: colors.textSecondary, fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {issue.description}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            <button onClick={() => setActiveTab('comments')} style={tabStyle(activeTab === 'comments')}>
              <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Comments {comments.length > 0 && `(${comments.length})`}
            </button>
            <button onClick={() => setActiveTab('subtasks')} style={tabStyle(activeTab === 'subtasks')}>
              <ListTodo size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Sub-tasks {subtasks.length > 0 && `(${subtasks.length})`}
            </button>
            <button onClick={() => setActiveTab('activity')} style={tabStyle(activeTab === 'activity')}>
              <Activity size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Activity {activityItems.length > 0 && `(${activityItems.length})`}
            </button>
          </div>

          {/* Tab content */}
          <div style={{ ...glassSurface, borderRadius: 20, padding: 20, minHeight: 200 }}>
            {activeTab === 'comments' && (
              <div>
                {loadingActivity ? (
                  <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
                    No comments yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {comments.map(c => {
                      const agent = c.details?.agentName;
                      const isAgent = c.actorType === 'agent';
                      return (
                        <div key={c.id} style={{
                          padding: '12px 16px', borderRadius: 14,
                          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {isAgent ? <Bot size={14} color="#8B5CF6" /> : <User size={14} color="#3B82F6" />}
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.text }}>
                              {agent || c.actorId}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: colors.textMuted }}>{relativeTime(c.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {(c.details as any)?.bodySnippet || (c.details as any)?.body || 'Comment'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subtasks' && (
              <div>
                {subtasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
                    No sub-tasks
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {subtasks.map(sub => {
                      const subStatus = STATUS_COLORS[sub.status] || '#6B7280';
                      const subPriority = PRIORITY_COLORS[sub.priority] || '#6B7280';
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigateTask(sub.identifier)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            color: colors.text, width: '100%', textAlign: 'left',
                            transition: 'background 0.15s',
                          }}
                        >
                          <Circle size={8} fill={subStatus} color={subStatus} />
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.textMuted, fontFamily: 'monospace', minWidth: 52 }}>
                            {sub.identifier}
                          </span>
                          <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500 }}>{sub.title}</span>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                            background: `${subPriority}22`, color: subPriority, textTransform: 'uppercase',
                          }}>
                            {sub.priority}
                          </span>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                            background: `${subStatus}22`, color: subStatus, textTransform: 'uppercase',
                          }}>
                            {STATUS_LABELS[sub.status] || sub.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div>
                {loadingActivity ? (
                  <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : activityItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
                    No activity
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activityItems.map(a => {
                      const actionLabel = a.action.replace('issue.', '').replace('agent.', '').replace(/_/g, ' ');
                      const actor = a.details?.agentName || a.actorId;
                      const details = a.details as any;
                      let extra = '';
                      if (a.action === 'issue.updated' && details?.status && details?._previous?.status) {
                        extra = ` (${details._previous.status} → ${details.status})`;
                      }
                      return (
                        <div key={a.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 8, fontSize: '0.8rem',
                        }}>
                          <Activity size={12} color={colors.textMuted} />
                          <span style={{ flex: 1, color: colors.textSecondary }}>
                            <strong style={{ color: colors.text }}>{actor}</strong>
                            {' '}{actionLabel}{extra}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: colors.textMuted }}>{relativeTime(a.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Properties Sidebar */}
        <div style={{ ...glassSurface, borderRadius: 20, padding: 20, alignSelf: 'start' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: colors.text, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Properties
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Status */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Status</div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                background: `${statusColor}22`, color: statusColor,
              }}>
                <Circle size={8} fill={statusColor} color={statusColor} />
                {STATUS_LABELS[issue.status] || issue.status}
              </span>
            </div>

            {/* Priority */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Priority</div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px', borderRadius: 8,
                background: `${priorityColor}22`, color: priorityColor, textTransform: 'capitalize',
              }}>
                {issue.priority}
              </span>
            </div>

            {/* Labels */}
            {issue.labels.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Labels</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {issue.labels.map(l => (
                    <span key={l.id} style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '2px 10px', borderRadius: 6,
                      background: l.color ? `${l.color}22` : 'rgba(255,255,255,0.06)',
                      color: l.color || colors.textSecondary,
                    }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Assignee */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Assignee</div>
              {assignee ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={14} color="#8B5CF6" />
                  <span style={{ fontSize: '0.8rem', color: colors.text, fontWeight: 500 }}>{assignee.name}</span>
                </div>
              ) : (
                <span style={{ fontSize: '0.8rem', color: colors.textMuted }}>Unassigned</span>
              )}
            </div>

            {/* Created by */}
            {creator && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Created by</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={14} color="#8B5CF6" />
                  <span style={{ fontSize: '0.8rem', color: colors.text, fontWeight: 500 }}>{creator.name}</span>
                </div>
              </div>
            )}

            {/* Dates */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Created</div>
              <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{formatDate(issue.createdAt)}</span>
            </div>

            {issue.startedAt && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Started</div>
                <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{formatDate(issue.startedAt)}</span>
              </div>
            )}

            {issue.completedAt && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Completed</div>
                <span style={{ fontSize: '0.8rem', color: '#10B981' }}>{formatDate(issue.completedAt)}</span>
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Updated</div>
              <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{relativeTime(issue.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
