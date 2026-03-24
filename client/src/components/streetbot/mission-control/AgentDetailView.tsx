import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Circle, Bot, Activity, Clock, CheckCircle2, XCircle,
  Loader2, ListTodo, Zap, Play, Timer, GitBranch,
} from 'lucide-react';
import { paperclipFetch } from './config';
import type { PaperclipAgent, PaperclipIssue, HeartbeatRun, ActivityItem } from './types';

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

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#10B981', running: '#3B82F6', paused: '#F59E0B', error: '#EF4444', disabled: '#6B7280',
};

const SOURCE_COLORS: Record<string, string> = {
  on_demand: '#8B5CF6', timer: '#3B82F6', assignment: '#10B981', automation: '#F59E0B',
};

interface Props {
  slug: string;
  allAgents: PaperclipAgent[];
  allIssues: PaperclipIssue[];
  colors: any;
  glassSurface: React.CSSProperties;
  isDark: boolean;
  onBack: () => void;
  onNavigateTask: (identifier: string) => void;
}

export default function AgentDetailView({ slug, allAgents, allIssues, colors, glassSurface, isDark, onBack, onNavigateTask }: Props) {
  const [activeTab, setActiveTab] = useState<'runs' | 'tasks' | 'activity'>('runs');
  const [runs, setRuns] = useState<HeartbeatRun[]>([]);
  const [agentActivity, setAgentActivity] = useState<ActivityItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [selectedRun, setSelectedRun] = useState<HeartbeatRun | null>(null);

  const agent = useMemo(() =>
    allAgents.find(a => {
      const agentSlug = (a.urlKey || a.name.toLowerCase().replace(/\s+/g, '-'));
      return agentSlug === slug;
    }),
    [allAgents, slug]
  );

  // Agent's assigned tasks
  const agentTasks = useMemo(() =>
    agent ? allIssues.filter(i => i.assigneeAgentId === agent.id) : [],
    [agent, allIssues]
  );

  // Subordinate agents
  const subordinates = useMemo(() =>
    agent ? allAgents.filter(a => a.reportsTo === agent.id) : [],
    [agent, allAgents]
  );

  // Load runs and activity
  useEffect(() => {
    if (!agent) return;
    setLoadingRuns(true);
    setLoadingActivity(true);
    paperclipFetch<HeartbeatRun[]>(`/heartbeat-runs?agentId=${agent.id}&limit=50`)
      .then(items => { setRuns(items); if (items.length > 0) setSelectedRun(items[0]); })
      .catch(() => setRuns([]))
      .finally(() => setLoadingRuns(false));
    paperclipFetch<ActivityItem[]>(`/activity?entityId=${agent.id}`)
      .then(items => setAgentActivity(items))
      .catch(() => setAgentActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [agent]);

  if (!agent) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Bot size={32} color="#EF4444" style={{ marginBottom: 12 }} />
        <div style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 600 }}>Agent not found</div>
        <div style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: 4 }}>{slug}</div>
        <button onClick={onBack} style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 10, border: `1px solid ${colors.border}`,
          background: 'transparent', color: colors.text, cursor: 'pointer', fontSize: '0.85rem',
        }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[agent.status] || '#6B7280';
  const succeededRuns = runs.filter(r => r.status === 'succeeded').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
    color: active ? colors.text : colors.textMuted,
  });

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
        border: 'none', background: 'transparent', color: colors.textSecondary, cursor: 'pointer',
        fontSize: '0.85rem', marginBottom: 16,
      }}>
        <ArrowLeft size={16} />
        <span>Agents</span>
        <span style={{ color: colors.textMuted }}>/</span>
        <span style={{ color: colors.text, fontWeight: 600 }}>{agent.name}</span>
      </button>

      {/* Agent Header */}
      <div style={{ ...glassSurface, borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${statusColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={24} color={statusColor} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: colors.text, margin: 0 }}>{agent.name}</h2>
            <p style={{ fontSize: '0.85rem', color: colors.textMuted, margin: '2px 0 0' }}>
              {agent.title || agent.role}
            </p>
          </div>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, padding: '4px 14px', borderRadius: 8,
            background: `${statusColor}22`, color: statusColor, textTransform: 'uppercase',
          }}>
            {agent.status}
          </span>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
          {[
            { label: 'Total Runs', value: runs.length, color: '#3B82F6' },
            { label: 'Succeeded', value: succeededRuns, color: '#10B981' },
            { label: 'Failed', value: failedRuns, color: '#EF4444' },
            { label: 'Assigned Tasks', value: agentTasks.length, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '12px 16px', borderRadius: 12, textAlign: 'center',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: colors.textMuted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Subordinates */}
        {subordinates.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
              Direct Reports ({subordinates.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {subordinates.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    const subSlug = sub.urlKey || sub.name.toLowerCase().replace(/\s+/g, '-');
                    window.history.pushState(null, '', `/tasks/agent/${subSlug}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
                    background: 'transparent', color: colors.text, cursor: 'pointer', fontSize: '0.75rem',
                  }}
                >
                  <Circle size={6} fill={STATUS_COLORS[sub.status] || '#6B7280'} color={STATUS_COLORS[sub.status] || '#6B7280'} />
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setActiveTab('runs')} style={tabStyle(activeTab === 'runs')}>
          <Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Runs ({runs.length})
        </button>
        <button onClick={() => setActiveTab('tasks')} style={tabStyle(activeTab === 'tasks')}>
          <ListTodo size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Tasks ({agentTasks.length})
        </button>
        <button onClick={() => setActiveTab('activity')} style={tabStyle(activeTab === 'activity')}>
          <Activity size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Activity
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'runs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          {/* Run list */}
          <div style={{ ...glassSurface, borderRadius: 20, padding: 16, maxHeight: 600, overflowY: 'auto' }}>
            {loadingRuns ? (
              <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : runs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
                No runs found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {runs.slice(0, 30).map(run => {
                  const isSelected = selectedRun?.id === run.id;
                  const isOk = run.status === 'succeeded';
                  return (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: isSelected
                          ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')
                          : 'transparent',
                        color: colors.text, width: '100%', textAlign: 'left',
                        transition: 'background 0.15s',
                      }}
                    >
                      {isOk ? <CheckCircle2 size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {run.id.slice(0, 8)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{
                            fontSize: '0.55rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: `${SOURCE_COLORS[run.invocationSource] || '#6B7280'}22`,
                            color: SOURCE_COLORS[run.invocationSource] || '#6B7280',
                            textTransform: 'capitalize',
                          }}>
                            {run.invocationSource.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>{relativeTime(run.startedAt)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Run detail */}
          <div style={{ ...glassSurface, borderRadius: 20, padding: 20 }}>
            {selectedRun ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  {selectedRun.status === 'succeeded'
                    ? <CheckCircle2 size={18} color="#10B981" />
                    : <XCircle size={18} color="#EF4444" />
                  }
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 700, padding: '3px 12px', borderRadius: 8,
                    background: selectedRun.status === 'succeeded' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: selectedRun.status === 'succeeded' ? '#10B981' : '#EF4444',
                    textTransform: 'uppercase',
                  }}>
                    {selectedRun.status}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: colors.textMuted, fontFamily: 'monospace' }}>
                    {selectedRun.id.slice(0, 12)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Started</div>
                    <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{formatDate(selectedRun.startedAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Duration</div>
                    <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{formatDuration(selectedRun.startedAt, selectedRun.finishedAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Source</div>
                    <div style={{ fontSize: '0.8rem', color: colors.textSecondary, textTransform: 'capitalize' }}>
                      {selectedRun.invocationSource.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Trigger</div>
                    <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>{selectedRun.triggerDetail || '—'}</div>
                  </div>
                </div>

                {selectedRun.error && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#EF4444', textTransform: 'uppercase', marginBottom: 4 }}>Error</div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: '0.75rem', color: '#EF4444', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                    }}>
                      {selectedRun.error}
                    </div>
                  </div>
                )}

                {selectedRun.stderrExcerpt && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>stderr</div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 10, maxHeight: 200, overflowY: 'auto',
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                      fontSize: '0.7rem', color: colors.textSecondary, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}>
                      {selectedRun.stderrExcerpt}
                    </div>
                  </div>
                )}

                {selectedRun.stdoutExcerpt && (
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>stdout</div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 10, maxHeight: 200, overflowY: 'auto',
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                      fontSize: '0.7rem', color: colors.textSecondary, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}>
                      {selectedRun.stdoutExcerpt}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
                Select a run to view details
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div style={{ ...glassSurface, borderRadius: 20, padding: 20 }}>
          {agentTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
              No assigned tasks
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agentTasks.map(task => {
                const sc = ({ todo: '#F59E0B', in_progress: '#3B82F6', done: '#10B981', backlog: '#6B7280' } as any)[task.status] || '#6B7280';
                const pc = ({ critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#6B7280' } as any)[task.priority] || '#6B7280';
                return (
                  <button
                    key={task.id}
                    onClick={() => onNavigateTask(task.identifier)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      color: colors.text, width: '100%', textAlign: 'left', transition: 'background 0.15s',
                    }}
                  >
                    <Circle size={8} fill={sc} color={sc} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.textMuted, fontFamily: 'monospace', minWidth: 52 }}>
                      {task.identifier}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${pc}22`, color: pc, textTransform: 'uppercase' }}>
                      {task.priority}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div style={{ ...glassSurface, borderRadius: 20, padding: 20 }}>
          {loadingActivity ? (
            <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : agentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: '0.85rem' }}>
              No activity
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
              {agentActivity.slice(0, 50).map(a => {
                const actionLabel = a.action.replace('agent.', '').replace('issue.', '').replace(/_/g, ' ');
                const details = a.details as any;
                let extra = '';
                if (details?.tokens) extra = ` (${details.tokens} tokens)`;
                if (details?.model) extra += ` [${details.model}]`;
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8, fontSize: '0.8rem',
                  }}>
                    <Zap size={12} color="#8B5CF6" />
                    <span style={{ flex: 1, color: colors.textSecondary }}>
                      {actionLabel}{extra}
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
  );
}
