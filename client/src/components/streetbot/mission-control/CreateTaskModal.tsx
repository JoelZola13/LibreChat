import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { useAuthContext } from '~/hooks/AuthContext';
import type { PaperclipAgent } from './types';
import { CUSTOM_OTHER_ASSIGNEE_ID, HUMAN_ASSIGNEES } from './paperclipAdapter';

const C = DEFAULT_COLORS;

interface Props {
  agents: PaperclipAgent[];
  onSubmit: (payload: {
    title: string;
    description?: string;
    priority?: string;
    status?: 'todo' | 'in_progress' | 'done';
    agentName?: string;
    agentId?: string;
    assigneeUserId?: string;
    customAssigneeName?: string;
  }) => Promise<void>;
  initialStatus?: 'todo' | 'in_progress' | 'done';
  onClose: () => void;
}

export default function CreateTaskModal({ agents, onSubmit, initialStatus = 'todo', onClose }: Props) {
  const { user } = useAuthContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeValue, setAssigneeValue] = useState('');
  const [customAssigneeName, setCustomAssigneeName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const sortedAgents = useMemo(() =>
    [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents]
  );
  const matchedHumanAssignee = useMemo(() => {
    const normalizedUserName = user?.name?.trim().toLowerCase();
    const matchedAssignee = normalizedUserName ? HUMAN_ASSIGNEES.find((assignee) =>
      assignee.id !== CUSTOM_OTHER_ASSIGNEE_ID && assignee.name.trim().toLowerCase() === normalizedUserName
    ) : null;
    return matchedAssignee
      || HUMAN_ASSIGNEES.find((assignee) => assignee.id === 'ayse-barut')
      || null;
  }, [user?.name]);
  const otherAssigneeSelected = assigneeValue === `human:${CUSTOM_OTHER_ASSIGNEE_ID}`;

  useEffect(() => {
    if (initialStatus !== 'in_progress' || assigneeValue || !matchedHumanAssignee) {
      return;
    }
    setAssigneeValue(`human:${matchedHumanAssignee.id}`);
  }, [initialStatus, assigneeValue, matchedHumanAssignee]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    if (otherAssigneeSelected && !customAssigneeName.trim()) {
      setError('Enter a name for the Other assignee');
      return;
    }
    if (initialStatus === 'in_progress' && !assigneeValue) {
      setError('In Progress tasks need an assignee');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Parameters<Props['onSubmit']>[0] = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status: initialStatus,
      };
      if (assigneeValue.startsWith('agent:')) {
        payload.agentId = assigneeValue.slice('agent:'.length);
      } else if (assigneeValue.startsWith('human:')) {
        payload.assigneeUserId = assigneeValue.slice('human:'.length);
        if (payload.assigneeUserId === CUSTOM_OTHER_ASSIGNEE_ID) {
          payload.customAssigneeName = customAssigneeName.trim();
        }
      }
      await onSubmit({
        ...payload,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, priority, initialStatus, assigneeValue, customAssigneeName, otherAssigneeSelected, onSubmit, onClose]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: '0.8rem',
    background: C.surface, border: `1px solid ${C.border}`, color: C.text,
    outline: 'none', transition: 'border-color 0.12s', fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 480, maxWidth: '90vw', borderRadius: 16,
        background: C.sidebar, border: `1px solid ${C.border}`,
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.text, margin: 0 }}>
            New Task
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
          >
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              Title *
            </label>
            <input
              ref={titleRef}
              type="text"
              placeholder="Task title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSubmit(); }}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              Description
            </label>
            <textarea
              placeholder="Add description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
                Assignee
              </label>
              <select
                value={assigneeValue}
                onChange={e => {
                  setAssigneeValue(e.target.value);
                  if (e.target.value !== `human:${CUSTOM_OTHER_ASSIGNEE_ID}`) {
                    setCustomAssigneeName('');
                  }
                }}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Unassigned</option>
                <optgroup label="People">
                  {HUMAN_ASSIGNEES.map((assignee) => (
                    <option key={assignee.id} value={`human:${assignee.id}`}>{assignee.name}</option>
                  ))}
                </optgroup>
                {sortedAgents.length > 0 && (
                  <optgroup label="Agents">
                {sortedAgents.map(a => (
                    <option key={a.id} value={`agent:${a.id}`}>{a.name} — {a.title || a.role}</option>
                ))}
                  </optgroup>
                )}
              </select>
              {otherAssigneeSelected && (
                <input
                  type="text"
                  placeholder="Type assignee name..."
                  value={customAssigneeName}
                  onChange={e => setCustomAssigneeName(e.target.value)}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
              )}
            </div>

            <div style={{ width: 120 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: '0.75rem',
              background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 500,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textSecondary, cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting || (otherAssigneeSelected && !customAssigneeName.trim())}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: (!title.trim() || (otherAssigneeSelected && !customAssigneeName.trim())) ? C.surface : C.accent,
              color: (!title.trim() || (otherAssigneeSelected && !customAssigneeName.trim())) ? C.textMuted : '#000',
              fontSize: '0.8rem', fontWeight: 700,
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.12s',
            }}
          >
            {submitting ? (
              <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', verticalAlign: -2, marginRight: 4 }} /> Creating...</>
            ) : (
              'Create Task'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
