import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Circle, Bot, User, Activity, ListTodo, MessageSquare,
  Loader2, Clock, ChevronDown, ChevronRight, Flag, Calendar,
  Link2, Plus, FileText, CheckSquare, GitBranch, Bell,
  Paperclip, AtSign, Send,
} from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { paperclipFetch } from './config';
import type { PaperclipIssue, PaperclipAgent, ActivityItem } from './types';
import type { UserInfo } from '../tasks/constants';

const C = DEFAULT_COLORS;

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatFullDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' at ' + new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280', in_progress: '#eab308', done: '#22c55e',
};
const STATUS_LABELS: Record<string, string> = {
  todo: 'TO DO', in_progress: 'IN PROGRESS', done: 'COMPLETE',
};
const STATUS_BG: Record<string, string> = {
  todo: '#374151', in_progress: '#92400e', done: '#166534',
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444', critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
};

interface Props {
  issue: PaperclipIssue;
  allIssues: PaperclipIssue[];
  agentMap: Record<string, UserInfo>;
  onClose: () => void;
  onNavigateTask: (identifier: string) => void;
}

export default function TaskDetailPanel({ issue, allIssues, agentMap, onClose, onNavigateTask }: Props) {
  const [issueActivity, setIssueActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [commentText, setCommentText] = useState('');

  const subtasks = useMemo(() => allIssues.filter(i => i.parentId === issue.id), [issue, allIssues]);
  const parentTask = useMemo(() => issue.parentId ? allIssues.find(i => i.id === issue.parentId) : null, [issue, allIssues]);
  const assignee = issue.assigneeAgentId ? agentMap[issue.assigneeAgentId] : null;

  useEffect(() => {
    setLoadingActivity(true);
    paperclipFetch<ActivityItem[]>(`/activity?entityId=${issue.id}`)
      .then(setIssueActivity)
      .catch(() => setIssueActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [issue.id]);

  const comments = useMemo(() => issueActivity.filter(a => a.action === 'issue.comment_added'), [issueActivity]);
  const activityItems = useMemo(() => issueActivity.filter(a => a.action !== 'issue.comment_added'), [issueActivity]);

  // Remap backlog → todo (backlog removed from UI)
  const displayStatus = issue.status === 'backlog' ? 'todo' : issue.status;
  const statusColor = STATUS_COLORS[displayStatus] || '#6b7280';
  const statusBg = STATUS_BG[displayStatus] || '#374151';
  const priorityColor = PRIORITY_COLORS[issue.priority] || '#6b7280';

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Property row component — ClickUp-style two-column
  const PropRow = ({ icon, label, children, empty }: { icon: React.ReactNode; label: string; children: React.ReactNode; empty?: boolean }) => {
    if (empty && !showEmptyFields) return null;
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center',
        padding: '7px 0', minHeight: 34, gap: 8, width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ color: C.textMuted, display: 'flex', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: '0.78rem', color: C.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>{children}</div>
      </div>
    );
  };

  // Count empty fields
  const emptyFieldCount = [
    !issue.dueDate,
    !issue.priority || issue.priority === 'none',
    issue.labels.length === 0,
  ].filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 1000, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: 16, bottom: 16, left: 70, right: 16,
        zIndex: 1001, display: 'flex', flexDirection: 'column',
        background: '#1a1a24', borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderBottom: `1px solid ${C.border}`,
          fontSize: '0.75rem', color: C.textMuted,
          background: '#16161e',
        }}>
          {/* Breadcrumb */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link2 size={12} />
          </span>
          <span>Street Voices</span>
          <span>/</span>
          <span>Tasks</span>
          {parentTask && (
            <>
              <span>/</span>
              <button
                onClick={() => onNavigateTask(parentTask.identifier)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.accent, fontSize: '0.75rem', padding: 0,
                }}
              >
                {parentTask.title}
              </button>
            </>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: '0.7rem', color: C.textMuted }}>
            Created {formatDate(issue.createdAt)}
          </span>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 4, display: 'flex', marginLeft: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.sidebarHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        {/* Content: Main + Activity sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: Main content */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px 24px' }}>

            {/* Task type + subtask count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.text,
              }}>
                <Circle size={8} fill={statusColor} color={statusColor} />
                Task
                <ChevronDown size={12} color={C.textMuted} />
              </div>
              {subtasks.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: C.textMuted }}>
                  <ListTodo size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                  {subtasks.length}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: '1.3rem', fontWeight: 700, color: C.text,
              margin: '0 0 24px', lineHeight: 1.3,
            }}>
              {issue.title}
            </h1>

            {/* Properties */}
            <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 16, marginBottom: 16 }}>
              {/* Status */}
              <PropRow icon={<Circle size={14} />} label="Status">
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 4,
                  background: statusBg, color: statusColor,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  {STATUS_LABELS[displayStatus] || displayStatus}
                  <span style={{ fontSize: '0.8rem' }}>&#9654;</span>
                </span>
              </PropRow>

              {/* Assignees */}
              <PropRow icon={<User size={14} />} label="Assignees">
                {assignee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: assignee.avatar,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.55rem', fontWeight: 700, color: '#fff',
                    }}>
                      {assignee.initials}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: C.text }}>{assignee.name}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: C.textMuted }}>Empty</span>
                )}
              </PropRow>

              {/* Dates */}
              <PropRow icon={<Calendar size={14} />} label="Dates">
                {issue.dueDate ? (
                  <span style={{ fontSize: '0.8rem', color: C.text }}>
                    {formatDate(issue.dueDate)}
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: C.textMuted }}>
                    <Calendar size={13} /> Start
                    <span style={{ margin: '0 4px' }}>&rarr;</span>
                    <Calendar size={13} /> Due
                  </div>
                )}
              </PropRow>

              {/* Priority */}
              <PropRow icon={<Flag size={14} />} label="Priority" empty={!issue.priority || issue.priority === 'none'}>
                {issue.priority && issue.priority !== 'none' ? (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                    background: `${priorityColor}22`, color: priorityColor, textTransform: 'capitalize',
                  }}>
                    {issue.priority}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: C.textMuted }}>Empty</span>
                )}
              </PropRow>

              {/* Tags / Labels */}
              <PropRow icon={<span style={{ fontSize: 14 }}>🏷</span>} label="Tags" empty={issue.labels.length === 0}>
                {issue.labels.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {issue.labels.map(l => (
                      <span key={l.id} style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '2px 10px', borderRadius: 4,
                        background: l.color ? `${l.color}22` : 'rgba(255,255,255,0.06)',
                        color: l.color || C.textSecondary,
                      }}>
                        {l.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: C.textMuted }}>Empty</span>
                )}
              </PropRow>

              {/* Empty fields toggle moved below properties */}
            </div>

            {/* "Collapse empty fields" toggle — ClickUp style */}
            {emptyFieldCount > 0 && (
              <button
                onClick={() => setShowEmptyFields(!showEmptyFields)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.72rem', color: C.textMuted, padding: '2px 0 12px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {showEmptyFields ? '⤴' : '⤵'} {showEmptyFields ? 'Collapse' : 'Show'} empty fields
              </button>
            )}

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              {issue.description ? (
                <div style={{
                  fontSize: '0.85rem', color: C.textSecondary, lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {issue.description}
                </div>
              ) : (
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.textMuted, fontSize: '0.8rem', padding: '8px 0',
                }}>
                  <FileText size={14} />
                  Add description
                </button>
              )}
            </div>

            {/* Fields section — ClickUp-style collapsible custom fields */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowFields(!showFields)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {showFields ? <ChevronDown size={14} color={C.textMuted} /> : <ChevronRight size={14} color={C.textMuted} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>Fields</span>
                <div style={{ flex: 1 }} />
                <Plus size={14} color={C.textMuted} />
              </button>

              {showFields && (
                <div style={{ padding: '8px 0' }}>
                  {[
                    { icon: <FileText size={14} />, label: 'Notes', value: null },
                    { icon: <Link2 size={14} />, label: 'URL', value: null },
                    { icon: <Flag size={14} />, label: 'Status', value: null },
                    { icon: <Paperclip size={14} />, label: 'Files', value: null },
                  ].map(field => (
                    <div key={field.label} style={{
                      display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center',
                      padding: '7px 0', minHeight: 32, gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.textMuted, display: 'flex' }}>{field.icon}</span>
                        <span style={{ fontSize: '0.78rem', color: C.textMuted }}>{field.label}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: C.textMuted }}>—</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtasks section */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', cursor: 'pointer',
                fontSize: '0.8rem', color: C.textMuted,
              }}>
                <ListTodo size={16} />
                <span style={{ fontWeight: 600 }}>Add subtask</span>
              </div>

              {subtasks.length > 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  marginTop: 8, marginLeft: 4,
                }}>
                  {subtasks.map(sub => {
                    const sc = STATUS_COLORS[sub.status] || '#6b7280';
                    return (
                      <button
                        key={sub.id}
                        onClick={() => onNavigateTask(sub.identifier)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'transparent', color: C.text, width: '100%', textAlign: 'left',
                          transition: 'background 0.12s', fontSize: '0.8rem',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.rowHover; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4,
                          border: `2px solid ${sc}`,
                          background: sub.status === 'done' ? sc : 'transparent',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: sub.status === 'done' ? 'line-through' : 'none',
                          opacity: sub.status === 'done' ? 0.6 : 1,
                        }}>
                          {sub.title}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: C.textMuted, fontFamily: 'monospace' }}>
                          {sub.identifier}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textMuted, fontSize: '0.8rem', padding: '8px 0',
              }}>
                <GitBranch size={16} />
                Relate items or add dependencies
              </button>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textMuted, fontSize: '0.8rem', padding: '8px 0',
              }}>
                <CheckSquare size={16} />
                Create checklist
              </button>
            </div>
          </div>

          {/* Right: Activity sidebar */}
          <div style={{
            flex: '0 0 38%', maxWidth: 360, borderLeft: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', background: '#16161e',
          }}>
            {/* Activity header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>Activity</span>
              <div style={{ flex: 1 }} />
              {activityItems.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.7rem', color: C.textMuted,
                }}>
                  <Bell size={14} />
                  <span style={{
                    background: C.accent, color: '#000', borderRadius: '50%',
                    width: 18, height: 18, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700,
                  }}>
                    {activityItems.length}
                  </span>
                </div>
              )}
            </div>

            {/* Activity list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {loadingActivity ? (
                <div style={{ textAlign: 'center', padding: 24, color: C.textMuted }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Combined activity + comments, sorted by date */}
                  {[...activityItems, ...comments]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map(item => {
                      const isComment = item.action === 'issue.comment_added';
                      return (
                        <div key={item.id} style={{ display: 'flex', gap: 10 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isComment ? '#8B5CF6' : C.textMuted,
                            marginTop: 6, flexShrink: 0,
                          }} />
                          <div style={{ flex: 1 }}>
                            {isComment ? (
                              <>
                                <div style={{
                                  fontSize: '0.75rem', color: C.text, marginBottom: 4,
                                }}>
                                  <span style={{ fontWeight: 600 }}>
                                    {(item.details as any)?.agentName || 'Agent'}
                                  </span>
                                  <span style={{ color: C.textMuted }}> commented</span>
                                </div>
                                <div style={{
                                  fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5,
                                  padding: '8px 10px', borderRadius: 6, background: C.surface,
                                }}>
                                  {(item.details as any)?.bodySnippet || (item.details as any)?.body || 'Comment'}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: C.textSecondary }}>
                                <span style={{ color: C.text, fontWeight: 500 }}>You</span>
                                {' '}
                                {formatActivityAction(item)}
                              </div>
                            )}
                            <div style={{ fontSize: '0.65rem', color: C.textMuted, marginTop: 4 }}>
                              {formatFullDate(item.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {activityItems.length === 0 && comments.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: C.textMuted, fontSize: '0.8rem' }}>
                      No activity yet
                    </div>
                  )}

                  {activityItems.length > 3 && (
                    <button style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.textMuted, fontSize: '0.75rem', padding: '4px 0',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <ChevronRight size={12} />
                      Show more
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Comment input */}
            <div style={{
              padding: '12px 16px', borderTop: `1px solid ${C.border}`,
            }}>
              <div style={{
                border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
              }}>
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  style={{
                    width: '100%', padding: '10px 12px', background: 'transparent',
                    border: 'none', outline: 'none', color: C.text,
                    fontSize: '0.8rem', fontFamily: 'inherit',
                  }}
                />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  padding: '4px 8px', borderTop: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: '0.7rem', color: C.textMuted, fontWeight: 600 }}>Comment</span>
                  <ChevronDown size={10} color={C.textMuted} />
                  <div style={{ flex: 1 }} />
                  {[
                    <Plus size={14} />,
                    <Paperclip size={14} />,
                    <AtSign size={14} />,
                  ].map((icon, i) => (
                    <button key={i} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.textMuted, display: 'flex', padding: 4, borderRadius: 3,
                    }}>
                      {icon}
                    </button>
                  ))}
                  <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
                  <button style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: commentText.trim() ? C.accent : C.textMuted,
                    display: 'flex', padding: 4, borderRadius: 3,
                  }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatActivityAction(item: ActivityItem): string {
  const action = item.action.replace('issue.', '').replace('agent.', '');
  switch (action) {
    case 'created': return 'created this task';
    case 'status_changed': {
      const from = (item.details as any)?.from || '';
      const to = (item.details as any)?.to || '';
      return `changed status${from ? ` from ${from}` : ''} to ${to}`;
    }
    case 'assigned': return 'assigned this task';
    case 'unassigned': return 'unassigned this task';
    case 'priority_changed': return `changed priority to ${(item.details as any)?.to || ''}`;
    case 'updated': return 'updated this task';
    default: return action.replace(/_/g, ' ');
  }
}
