import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import type { PaperclipAgent } from './types';

const C = DEFAULT_COLORS;

interface Props {
  agents: PaperclipAgent[];
  onSubmit: (payload: { title: string; description?: string; priority?: string; agentName?: string }) => Promise<void>;
  onClose: () => void;
}

export default function CreateTaskModal({ agents, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [agentName, setAgentName] = useState('');
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

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        agentName: agentName || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, priority, agentName, onSubmit, onClose]);

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
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Unassigned</option>
                {sortedAgents.map(a => (
                  <option key={a.id} value={a.name}>{a.name} — {a.title || a.role}</option>
                ))}
              </select>
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
            disabled={!title.trim() || submitting}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: !title.trim() ? C.surface : C.accent,
              color: !title.trim() ? C.textMuted : '#000',
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
