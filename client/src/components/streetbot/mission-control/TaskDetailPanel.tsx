import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dataService } from 'librechat-data-provider';
import {
  X, Circle, User, Loader2, ChevronDown, ChevronRight, Flag, Calendar,
  Link2, Plus, FileText, GitBranch, Bell, Paperclip, AtSign, Send,
  Trash2, ListTodo,
} from 'lucide-react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { paperclipFetch } from './config';
import type { PaperclipIssue, PaperclipAgent, ActivityItem } from './types';
import type { UserInfo } from '../tasks/constants';
import {
  buildIssueDescription,
  CUSTOM_OTHER_ASSIGNEE_ID,
  extractCustomAssigneeName,
  extractIssueMetadata,
  HUMAN_ASSIGNEES,
  stripCustomAssigneeMarker,
  type TaskAttachment,
} from './paperclipAdapter';

const C = DEFAULT_COLORS;

const STATUS_COLORS: Record<string, string> = {
  todo: '#ef4444',
  in_progress: '#eab308',
  done: '#22c55e',
};

const STATUS_BG: Record<string, string> = {
  todo: '#7f1d1d',
  in_progress: '#92400e',
  done: '#166534',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

interface Props {
  issue: PaperclipIssue;
  allIssues: PaperclipIssue[];
  agentMap: Record<string, UserInfo>;
  agents: PaperclipAgent[];
  onClose: () => void;
  onNavigateTask: (identifier: string) => void;
  onDeleteIssue: (issueId: string) => Promise<void>;
  onRefreshIssue: () => void;
}

function formatFullDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  return `${new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTimeInput(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60000);
  return normalized.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatActivityAction(item: ActivityItem): string {
  const action = item.action.replace('issue.', '').replace('agent.', '');
  switch (action) {
    case 'created':
      return 'created this task';
    case 'status_changed': {
      const from = (item.details as any)?.from || '';
      const to = (item.details as any)?.to || '';
      return `changed status${from ? ` from ${from}` : ''} to ${to}`;
    }
    case 'assigned':
      return 'assigned this task';
    case 'unassigned':
      return 'unassigned this task';
    case 'priority_changed':
      return `changed priority to ${(item.details as any)?.to || ''}`;
    case 'updated':
      return 'updated this task';
    default:
      return action.replace(/_/g, ' ');
  }
}

function propertyValueStyle(): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 38,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    fontSize: '0.8rem',
    padding: '8px 10px',
    outline: 'none',
    fontFamily: 'inherit',
  };
}

function actionButtonStyle(active = false): React.CSSProperties {
  return {
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(255,215,0,0.12)' : 'transparent',
    color: active ? C.accent : C.textMuted,
    fontSize: '0.72rem',
    fontWeight: 700,
    borderRadius: 6,
    padding: '7px 10px',
    cursor: 'pointer',
  };
}

function buildTaskAttachmentHref(attachment: TaskAttachment): string {
  if (attachment.filepath.startsWith('http://') || attachment.filepath.startsWith('https://')) {
    return attachment.filepath;
  }
  return `/api/files/download/${encodeURIComponent(attachment.user)}/${encodeURIComponent(attachment.file_id)}`;
}

function PropRow({
  icon,
  label,
  children,
  empty,
  showEmptyFields,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  empty?: boolean;
  showEmptyFields: boolean;
}) {
  if (empty && !showEmptyFields) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        alignItems: 'start',
        padding: '8px 0',
        minHeight: 42,
        gap: 10,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', paddingTop: 10 }}>
        <span style={{ color: C.textMuted, display: 'flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: '0.78rem', color: C.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

export default function TaskDetailPanel({
  issue,
  allIssues,
  agentMap,
  agents,
  onClose,
  onNavigateTask,
  onDeleteIssue,
  onRefreshIssue,
}: Props) {
  const [issueActivity, setIssueActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subtasks = useMemo(() => allIssues.filter((i) => i.parentId === issue.id), [issue.id, allIssues]);
  const parentTask = useMemo(
    () => (issue.parentId ? allIssues.find((i) => i.id === issue.parentId) || null : null),
    [issue.parentId, allIssues],
  );

  const issueAssigneeValue = issue.assigneeAgentId
    ? `agent:${issue.assigneeAgentId}`
    : issue.assigneeUserId
      ? `human:${issue.assigneeUserId}`
      : '';

  const initialDescription = stripCustomAssigneeMarker(issue.description) || '';
  const initialMetadata = extractIssueMetadata(issue.description);
  const initialAttachments = initialMetadata.attachments || [];
  const initialAttachmentsKey = JSON.stringify(initialAttachments);
  const initialCustomAssigneeName = issue.assigneeUserId === CUSTOM_OTHER_ASSIGNEE_ID
    ? extractCustomAssigneeName(issue.description) || ''
    : '';

  const [titleValue, setTitleValue] = useState(issue.title);
  const [statusValue, setStatusValue] = useState<'todo' | 'in_progress' | 'done'>(
    issue.status === 'backlog' ? 'todo' : issue.status,
  );
  const [priorityValue, setPriorityValue] = useState<PaperclipIssue['priority']>(issue.priority || 'medium');
  const [assigneeValue, setAssigneeValue] = useState(issueAssigneeValue);
  const [customAssigneeName, setCustomAssigneeName] = useState(initialCustomAssigneeName);
  const [startedAtValue, setStartedAtValue] = useState(formatDateTimeInput(issue.startedAt));
  const [dueDateValue, setDueDateValue] = useState(formatDateTimeInput(issue.dueDate));
  const [descriptionValue, setDescriptionValue] = useState(initialDescription);
  const [notesValue, setNotesValue] = useState(initialMetadata.notes || '');
  const [urlValue, setUrlValue] = useState(initialMetadata.url || '');
  const [filesValue, setFilesValue] = useState(initialMetadata.files || '');
  const [attachmentsValue, setAttachmentsValue] = useState<TaskAttachment[]>(initialAttachments);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const items = await paperclipFetch<ActivityItem[]>(`/activity?entityId=${issue.id}`);
      setIssueActivity(items);
    } catch {
      setIssueActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, [issue.id]);

  useEffect(() => {
    setTitleValue(issue.title);
    setStatusValue(issue.status === 'backlog' ? 'todo' : issue.status);
    setPriorityValue(issue.priority || 'medium');
    setAssigneeValue(issueAssigneeValue);
    setCustomAssigneeName(initialCustomAssigneeName);
    setStartedAtValue(formatDateTimeInput(issue.startedAt));
    setDueDateValue(formatDateTimeInput(issue.dueDate));
    setDescriptionValue(initialDescription);
    setNotesValue(initialMetadata.notes || '');
    setUrlValue(initialMetadata.url || '');
    setFilesValue(initialMetadata.files || '');
    setAttachmentsValue(initialAttachments);
    setSaveError(null);
    setDeleteError(null);
    setConfirmDelete(false);
    setNewSubtaskTitle('');
  }, [
    issue.id,
    issue.updatedAt,
    issue.title,
    issue.status,
    issue.priority,
    issueAssigneeValue,
    initialCustomAssigneeName,
    issue.startedAt,
    issue.dueDate,
    initialDescription,
    initialMetadata.notes,
    initialMetadata.url,
    initialMetadata.files,
    initialAttachmentsKey,
  ]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const comments = useMemo(() => issueActivity.filter((a) => a.action === 'issue.comment_added'), [issueActivity]);
  const activityItems = useMemo(() => issueActivity.filter((a) => a.action !== 'issue.comment_added'), [issueActivity]);

  const displayStatus = statusValue;
  const statusColor = STATUS_COLORS[displayStatus] || '#6b7280';
  const statusBg = STATUS_BG[displayStatus] || '#374151';
  const priorityColor = PRIORITY_COLORS[priorityValue] || '#6b7280';

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  const selectedAssignee = assigneeValue.startsWith('agent:')
    ? agentMap[assigneeValue.slice('agent:'.length)]
    : assigneeValue.startsWith('human:')
      ? (
          assigneeValue === `human:${CUSTOM_OTHER_ASSIGNEE_ID}`
            ? agentMap[`${CUSTOM_OTHER_ASSIGNEE_ID}:${issue.id}`]
            : agentMap[assigneeValue.slice('human:'.length)]
        )
      : null;

  const emptyFieldCount = [
    !startedAtValue && !dueDateValue,
    !priorityValue,
    !notesValue.trim(),
    !urlValue.trim(),
    !filesValue.trim(),
  ].filter(Boolean).length;

  const buildCurrentDescription = useCallback((overrides?: {
    description?: string;
    notes?: string;
    url?: string;
    files?: string;
    attachments?: TaskAttachment[];
    assignee?: string;
    customAssigneeName?: string;
  }) => {
    const nextAssignee = overrides?.assignee ?? assigneeValue;
    const nextCustomName = overrides?.customAssigneeName ?? customAssigneeName;
    const customName = nextAssignee === `human:${CUSTOM_OTHER_ASSIGNEE_ID}` ? nextCustomName : '';

    return buildIssueDescription({
      content: overrides?.description ?? descriptionValue,
      customAssigneeName: customName,
      metadata: {
        notes: overrides?.notes ?? notesValue,
        url: overrides?.url ?? urlValue,
        files: overrides?.files ?? filesValue,
        attachments: overrides?.attachments ?? attachmentsValue,
      },
    });
  }, [assigneeValue, attachmentsValue, customAssigneeName, descriptionValue, notesValue, urlValue, filesValue]);

  const patchIssue = useCallback(async (field: string, body: Record<string, unknown>) => {
    setSavingField(field);
    setSaveError(null);
    try {
      const response = await fetch(`/paperclip-internal/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = (await response.text()).trim();
        throw new Error(text || `${response.status} ${response.statusText}`);
      }

      onRefreshIssue();
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to update task');
      throw error;
    } finally {
      setSavingField((current) => (current === field ? null : current));
    }
  }, [issue.id, onRefreshIssue]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setDeleteError(null);
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteIssue(issue.id);
    } catch (error: any) {
      setDeleteError(error?.message || 'Failed to delete task');
      setDeleting(false);
    }
  }, [confirmDelete, issue.id, onDeleteIssue]);

  const saveTitle = useCallback(async () => {
    const nextTitle = titleValue.trim();
    if (!nextTitle || nextTitle === issue.title) return;
    await patchIssue('title', { title: nextTitle });
  }, [titleValue, issue.title, patchIssue]);

  const saveDescription = useCallback(async () => {
    if (descriptionValue.trim() === initialDescription.trim()) return;
    await patchIssue('description', { description: buildCurrentDescription({ description: descriptionValue }) });
  }, [descriptionValue, initialDescription, buildCurrentDescription, patchIssue]);

  const saveAssignee = useCallback(async () => {
    if (
      assigneeValue === issueAssigneeValue
      && customAssigneeName.trim() === initialCustomAssigneeName.trim()
    ) {
      return;
    }

    if (statusValue === 'in_progress' && !assigneeValue) {
      setSaveError('In Progress tasks need an assignee');
      return;
    }

    if (assigneeValue === `human:${CUSTOM_OTHER_ASSIGNEE_ID}` && !customAssigneeName.trim()) {
      setSaveError('Type a name for the Other assignee');
      return;
    }

    const body: Record<string, unknown> = {
      assigneeAgentId: null,
      assigneeUserId: null,
      description: buildCurrentDescription(),
    };

    if (assigneeValue.startsWith('agent:')) {
      body.assigneeAgentId = assigneeValue.slice('agent:'.length);
    } else if (assigneeValue.startsWith('human:')) {
      body.assigneeUserId = assigneeValue.slice('human:'.length);
    }

    await patchIssue('assignee', body);
  }, [
    assigneeValue,
    issueAssigneeValue,
    customAssigneeName,
    initialCustomAssigneeName,
    statusValue,
    buildCurrentDescription,
    patchIssue,
  ]);

  const savePriority = useCallback(async (nextPriority: PaperclipIssue['priority']) => {
    setPriorityValue(nextPriority);
    if (nextPriority === issue.priority) return;
    await patchIssue('priority', { priority: nextPriority });
  }, [issue.priority, patchIssue]);

  const saveStatus = useCallback(async (nextStatus: 'todo' | 'in_progress' | 'done') => {
    const fallbackAssignee = HUMAN_ASSIGNEES.find((assignee) => assignee.id === 'ayse-barut');
    let nextAssigneeValue = assigneeValue;
    const body: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'in_progress' && !nextAssigneeValue && fallbackAssignee) {
      nextAssigneeValue = `human:${fallbackAssignee.id}`;
      setAssigneeValue(nextAssigneeValue);
      body.assigneeAgentId = null;
      body.assigneeUserId = fallbackAssignee.id;
      body.description = buildCurrentDescription({ assignee: nextAssigneeValue });
    }

    if (nextStatus === 'in_progress' && !nextAssigneeValue) {
      setSaveError('In Progress tasks need an assignee');
      return;
    }

    setStatusValue(nextStatus);
    body.completedAt = nextStatus === 'done' ? new Date().toISOString() : null;
    if (nextStatus === 'in_progress' && !startedAtValue) {
      const now = new Date().toISOString();
      body.startedAt = now;
      setStartedAtValue(formatDateTimeInput(now));
    }

    if (nextStatus !== issue.status) {
      await patchIssue('status', body);
    }
  }, [assigneeValue, buildCurrentDescription, issue.status, patchIssue, startedAtValue]);

  const saveDates = useCallback(async () => {
    const nextStartedAt = toIsoDateTime(startedAtValue);
    const nextDueDate = toIsoDateTime(dueDateValue);
    if ((nextStartedAt || null) === (issue.startedAt || null) && (nextDueDate || null) === (issue.dueDate || null)) {
      return;
    }
    await patchIssue('dates', {
      startedAt: nextStartedAt,
      dueDate: nextDueDate,
    });
  }, [startedAtValue, dueDateValue, issue.startedAt, issue.dueDate, patchIssue]);

  const saveMetadataField = useCallback(async (
    field: 'notes' | 'url' | 'files',
    value: string,
    initialValue: string,
  ) => {
    if (value.trim() === initialValue.trim()) return;
    await patchIssue(field, {
      description: buildCurrentDescription({ [field]: value }),
    });
  }, [buildCurrentDescription, patchIssue]);

  const saveAttachments = useCallback(async (nextAttachments: TaskAttachment[]) => {
    setAttachmentsValue(nextAttachments);
    await patchIssue('attachments', {
      description: buildCurrentDescription({ attachments: nextAttachments }),
    });
  }, [buildCurrentDescription, patchIssue]);

  const handleUploadAttachment = useCallback(async (file: File) => {
    const fileId = globalThis.crypto?.randomUUID?.() || `task-file-${Date.now()}`;
    const formData = new FormData();
    formData.append('endpoint', 'default');
    formData.append('endpointType', '');
    formData.append('file', file, encodeURIComponent(file.name));
    formData.append('file_id', fileId);
    formData.append('message_file', 'true');

    setSavingField('file-upload');
    setSaveError(null);
    try {
      const uploaded = await dataService.uploadFile(formData);
      const nextAttachments = [
        ...attachmentsValue,
        {
          file_id: uploaded.file_id,
          filename: uploaded.filename,
          filepath: uploaded.filepath,
          user: uploaded.user,
          source: uploaded.source || null,
          type: uploaded.type || null,
        } satisfies TaskAttachment,
      ];

      await saveAttachments(nextAttachments);
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to upload file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSavingField((current) => (current === 'file-upload' ? null : current));
    }
  }, [attachmentsValue, saveAttachments]);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    const nextAttachments = attachmentsValue.filter((attachment) => attachment.file_id !== attachmentId);
    await saveAttachments(nextAttachments);
  }, [attachmentsValue, saveAttachments]);

  const handleCreateSubtask = useCallback(async () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;

    setSavingField('subtasks');
    setSaveError(null);
    try {
      await paperclipFetch('/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          parentId: issue.id,
          status: 'todo',
          priority: 'medium',
          description: '',
        }),
      });
      setNewSubtaskTitle('');
      onRefreshIssue();
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to create subtask');
    } finally {
      setSavingField((current) => (current === 'subtasks' ? null : current));
    }
  }, [issue.id, newSubtaskTitle, onRefreshIssue]);

  const handleToggleSubtask = useCallback(async (subtask: PaperclipIssue) => {
    const nextStatus: 'todo' | 'done' = subtask.status === 'done' ? 'todo' : 'done';
    const body: Record<string, unknown> = {
      status: nextStatus,
      completedAt: nextStatus === 'done' ? new Date().toISOString() : null,
    };

    setSavingField(`subtask:${subtask.id}`);
    setSaveError(null);
    try {
      const response = await fetch(`/paperclip-internal/api/issues/${subtask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = (await response.text()).trim();
        throw new Error(text || `${response.status} ${response.statusText}`);
      }
      onRefreshIssue();
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to update subtask');
    } finally {
      setSavingField((current) => (current === `subtask:${subtask.id}` ? null : current));
    }
  }, [onRefreshIssue]);

  const handleSubmitComment = useCallback(async () => {
    const body = commentText.trim();
    if (!body) return;

    setSavingField('comment');
    setSaveError(null);
    try {
      const response = await fetch(`/paperclip-internal/api/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const text = (await response.text()).trim();
        throw new Error(text || `${response.status} ${response.statusText}`);
      }

      setCommentText('');
      await loadActivity();
      onRefreshIssue();
    } catch (error: any) {
      setSaveError(error?.message || 'Failed to add comment');
    } finally {
      setSavingField((current) => (current === 'comment' ? null : current));
    }
  }, [commentText, issue.id, loadActivity, onRefreshIssue]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: 16,
          bottom: 16,
          left: 70,
          right: 16,
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          background: '#1a1a24',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: '0.75rem',
            color: C.textMuted,
            background: '#16161e',
          }}
        >
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
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.accent,
                  fontSize: '0.75rem',
                  padding: 0,
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

          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: confirmDelete ? 'rgba(239,68,68,0.16)' : 'transparent',
              border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.45)' : C.border}`,
              color: confirmDelete ? '#f87171' : C.textMuted,
              cursor: deleting ? 'default' : 'pointer',
              padding: '6px 10px',
              borderRadius: 6,
              marginLeft: 10,
              fontSize: '0.72rem',
              fontWeight: 600,
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
              display: 'flex',
              marginLeft: 8,
            }}
          >
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        {(deleteError || saveError) && (
          <div
            style={{
              padding: '8px 16px',
              borderBottom: `1px solid ${C.border}`,
              background: 'rgba(239,68,68,0.08)',
              color: '#f87171',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {deleteError || saveError}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontSize: '0.75rem',
                  color: C.text,
                }}
              >
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

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24 }}>
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={() => { void saveTitle(); }}
                style={{
                  ...propertyValueStyle(),
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  minHeight: 52,
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  padding: '10px 14px',
                }}
              />
              <button
                onClick={() => { void saveTitle(); }}
                disabled={savingField === 'title' || titleValue.trim() === issue.title}
                style={actionButtonStyle(titleValue.trim() !== issue.title)}
              >
                {savingField === 'title' ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 16, marginBottom: 16 }}>
              <PropRow icon={<Circle size={14} />} label="Status" showEmptyFields={showEmptyFields}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select
                    value={statusValue}
                    onChange={(e) => { void saveStatus(e.target.value as 'todo' | 'in_progress' | 'done'); }}
                    style={{
                      ...propertyValueStyle(),
                      maxWidth: 240,
                      background: statusBg,
                      color: statusColor,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    <option value="todo">TO DO</option>
                    <option value="in_progress">IN PROGRESS</option>
                    <option value="done">COMPLETE</option>
                  </select>
                  {savingField === 'status' && <Loader2 size={14} color={C.textMuted} style={{ animation: 'spin 1s linear infinite' }} />}
                </div>
              </PropRow>

              <PropRow icon={<User size={14} />} label="Assignees" showEmptyFields={showEmptyFields}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select
                      value={assigneeValue}
                      onChange={(e) => {
                        setAssigneeValue(e.target.value);
                        if (e.target.value !== `human:${CUSTOM_OTHER_ASSIGNEE_ID}`) {
                          setCustomAssigneeName('');
                        }
                      }}
                      style={{ ...propertyValueStyle(), maxWidth: 340 }}
                    >
                      <option value="">Unassigned</option>
                      <optgroup label="People">
                        {HUMAN_ASSIGNEES.map((assignee) => (
                          <option key={assignee.id} value={`human:${assignee.id}`}>
                            {assignee.name}
                          </option>
                        ))}
                      </optgroup>
                      {sortedAgents.length > 0 && (
                        <optgroup label="Agents">
                          {sortedAgents.map((agent) => (
                            <option key={agent.id} value={`agent:${agent.id}`}>
                              {agent.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      onClick={() => { void saveAssignee(); }}
                      disabled={savingField === 'assignee'}
                      style={actionButtonStyle(
                        assigneeValue !== issueAssigneeValue || customAssigneeName.trim() !== initialCustomAssigneeName.trim(),
                      )}
                    >
                      {savingField === 'assignee' ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  {assigneeValue === `human:${CUSTOM_OTHER_ASSIGNEE_ID}` && (
                    <input
                      value={customAssigneeName}
                      onChange={(e) => setCustomAssigneeName(e.target.value)}
                      onBlur={() => { void saveAssignee(); }}
                      placeholder="Type assignee name..."
                      style={{ ...propertyValueStyle(), maxWidth: 340 }}
                    />
                  )}

                  {selectedAssignee && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: selectedAssignee.avatar,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        {selectedAssignee.initials}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: C.text }}>{selectedAssignee.name}</span>
                    </div>
                  )}
                </div>
              </PropRow>

              <PropRow icon={<Calendar size={14} />} label="Dates" empty={!startedAtValue && !dueDateValue} showEmptyFields={showEmptyFields}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <input
                    type="datetime-local"
                    value={startedAtValue}
                    onChange={(e) => setStartedAtValue(e.target.value)}
                    style={{ ...propertyValueStyle(), maxWidth: 220 }}
                  />
                  <span style={{ color: C.textMuted, fontSize: '0.85rem' }}>&rarr;</span>
                  <input
                    type="datetime-local"
                    value={dueDateValue}
                    onChange={(e) => setDueDateValue(e.target.value)}
                    style={{ ...propertyValueStyle(), maxWidth: 220 }}
                  />
                  <button
                    onClick={() => { void saveDates(); }}
                    disabled={savingField === 'dates'}
                    style={actionButtonStyle(
                      startedAtValue !== formatDateTimeInput(issue.startedAt)
                      || dueDateValue !== formatDateTimeInput(issue.dueDate),
                    )}
                  >
                    {savingField === 'dates' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </PropRow>

              <PropRow icon={<Flag size={14} />} label="Priority" empty={!priorityValue} showEmptyFields={showEmptyFields}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select
                    value={priorityValue}
                    onChange={(e) => { void savePriority(e.target.value as PaperclipIssue['priority']); }}
                    style={{
                      ...propertyValueStyle(),
                      maxWidth: 180,
                      color: priorityColor,
                      fontWeight: 700,
                      textTransform: 'capitalize',
                    }}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {savingField === 'priority' && <Loader2 size={14} color={C.textMuted} style={{ animation: 'spin 1s linear infinite' }} />}
                </div>
              </PropRow>
            </div>

            {emptyFieldCount > 0 && (
              <button
                onClick={() => setShowEmptyFields(!showEmptyFields)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: C.textMuted,
                  padding: '2px 0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showEmptyFields ? '⤴' : '⤵'} {showEmptyFields ? 'Collapse' : 'Show'} empty fields
              </button>
            )}

            <div style={{ marginBottom: 20 }}>
              <textarea
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onBlur={() => { void saveDescription(); }}
                placeholder="Add description"
                rows={descriptionValue ? Math.max(4, descriptionValue.split('\n').length + 1) : 4}
                style={{
                  ...propertyValueStyle(),
                  minHeight: 120,
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: '0.72rem', color: C.textMuted }}>
                  Updated {formatFullDate(issue.updatedAt)}
                </span>
                <button
                  onClick={() => { void saveDescription(); }}
                  disabled={savingField === 'description'}
                  style={actionButtonStyle(descriptionValue.trim() !== initialDescription.trim())}
                >
                  {savingField === 'description' ? 'Saving...' : 'Save Description'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowFields(!showFields)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
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
                  <PropRow icon={<FileText size={14} />} label="Notes" empty={!notesValue.trim()} showEmptyFields={showEmptyFields}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <textarea
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => { void saveMetadataField('notes', notesValue, initialMetadata.notes || ''); }}
                        placeholder="Add notes..."
                        rows={3}
                        style={{ ...propertyValueStyle(), minHeight: 86, resize: 'vertical' }}
                      />
                      <button
                        onClick={() => { void saveMetadataField('notes', notesValue, initialMetadata.notes || ''); }}
                        disabled={savingField === 'notes'}
                        style={actionButtonStyle(notesValue.trim() !== (initialMetadata.notes || '').trim())}
                      >
                        {savingField === 'notes' ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </PropRow>

                  <PropRow icon={<Link2 size={14} />} label="Add link" empty={!urlValue.trim()} showEmptyFields={showEmptyFields}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        value={urlValue}
                        onChange={(e) => setUrlValue(e.target.value)}
                        onBlur={() => { void saveMetadataField('url', urlValue, initialMetadata.url || ''); }}
                        placeholder="Paste a link for this task..."
                        style={propertyValueStyle()}
                      />
                      <button
                        onClick={() => { void saveMetadataField('url', urlValue, initialMetadata.url || ''); }}
                        disabled={savingField === 'url'}
                        style={actionButtonStyle(urlValue.trim() !== (initialMetadata.url || '').trim())}
                      >
                        {savingField === 'url' ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </PropRow>

                  <PropRow icon={<ListTodo size={14} />} label="Subtasks" showEmptyFields={showEmptyFields}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleCreateSubtask();
                            }
                          }}
                          placeholder="Add a subtask..."
                          style={propertyValueStyle()}
                        />
                        <button
                          onClick={() => { void handleCreateSubtask(); }}
                          disabled={savingField === 'subtasks' || !newSubtaskTitle.trim()}
                          style={actionButtonStyle(Boolean(newSubtaskTitle.trim()))}
                        >
                          {savingField === 'subtasks' ? 'Adding...' : 'Add'}
                        </button>
                      </div>

                      {subtasks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {subtasks.map((subtask) => {
                            const checked = subtask.status === 'done';
                            const isSaving = savingField === `subtask:${subtask.id}`;
                            return (
                              <label
                                key={subtask.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${C.border}`,
                                  background: C.surface,
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => { void handleToggleSubtask(subtask); }}
                                  disabled={isSaving}
                                  style={{ width: 16, height: 16, accentColor: STATUS_COLORS.done }}
                                />
                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: '0.8rem',
                                    color: checked ? C.textMuted : C.text,
                                    textDecoration: checked ? 'line-through' : 'none',
                                  }}
                                >
                                  {subtask.title}
                                </span>
                                {isSaving && (
                                  <Loader2 size={14} color={C.textMuted} style={{ animation: 'spin 1s linear infinite' }} />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: C.textMuted }}>
                          No subtasks yet
                        </span>
                      )}
                    </div>
                  </PropRow>

                  <PropRow
                    icon={<Paperclip size={14} />}
                    label="Add file"
                    empty={!filesValue.trim() && attachmentsValue.length === 0}
                    showEmptyFields={showEmptyFields}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleUploadAttachment(file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={savingField === 'file-upload'}
                          style={actionButtonStyle(true)}
                        >
                          {savingField === 'file-upload' ? 'Uploading...' : 'Upload From Device'}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: C.textMuted }}>
                          Choose a file from your laptop to attach it to this task.
                        </span>
                      </div>

                      {attachmentsValue.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {attachmentsValue.map((attachment) => (
                            <div
                              key={attachment.file_id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: `1px solid ${C.border}`,
                                background: C.surface,
                              }}
                            >
                              <a
                                href={buildTaskAttachmentHref(attachment)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  flex: 1,
                                  color: C.accent,
                                  fontSize: '0.78rem',
                                  textDecoration: 'none',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {attachment.filename}
                              </a>
                              <button
                                onClick={() => { void handleRemoveAttachment(attachment.file_id); }}
                                disabled={savingField === 'attachments'}
                                style={actionButtonStyle(false)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <textarea
                          value={filesValue}
                          onChange={(e) => setFilesValue(e.target.value)}
                          onBlur={() => { void saveMetadataField('files', filesValue, initialMetadata.files || ''); }}
                          placeholder="Optional file notes..."
                          rows={2}
                          style={{ ...propertyValueStyle(), minHeight: 70, resize: 'vertical' }}
                        />
                        <button
                          onClick={() => { void saveMetadataField('files', filesValue, initialMetadata.files || ''); }}
                          disabled={savingField === 'files'}
                          style={actionButtonStyle(filesValue.trim() !== (initialMetadata.files || '').trim())}
                        >
                          {savingField === 'files' ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </PropRow>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.textMuted,
                  fontSize: '0.8rem',
                  padding: '8px 0',
                }}
              >
                <GitBranch size={16} />
                Relate items or add dependencies
              </button>
            </div>
          </div>

          <div
            style={{
              flex: '0 0 38%',
              maxWidth: 360,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              background: '#16161e',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 16px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text }}>Activity</span>
              <div style={{ flex: 1 }} />
              {activityItems.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.7rem',
                    color: C.textMuted,
                  }}
                >
                  <Bell size={14} />
                  <span
                    style={{
                      background: C.accent,
                      color: '#000',
                      borderRadius: '50%',
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                    }}
                  >
                    {activityItems.length}
                  </span>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {loadingActivity ? (
                <div style={{ textAlign: 'center', padding: 24, color: C.textMuted }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[...activityItems, ...comments]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((item) => {
                      const isComment = item.action === 'issue.comment_added';
                      return (
                        <div key={item.id} style={{ display: 'flex', gap: 10 }}>
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isComment ? '#8B5CF6' : C.textMuted,
                              marginTop: 6,
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            {isComment ? (
                              <>
                                <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: 4 }}>
                                  <span style={{ fontWeight: 600 }}>
                                    {(item.details as any)?.agentName || 'Agent'}
                                  </span>
                                  <span style={{ color: C.textMuted }}> commented</span>
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    color: C.textSecondary,
                                    lineHeight: 1.5,
                                    padding: '8px 10px',
                                    borderRadius: 6,
                                    background: C.surface,
                                  }}
                                >
                                  {(item.details as any)?.bodySnippet || (item.details as any)?.body || 'Comment'}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: C.textSecondary }}>
                                <span style={{ color: C.text, fontWeight: 500 }}>You</span>{' '}
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
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                  placeholder="Write a comment..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: C.text,
                    fontSize: '0.8rem',
                    fontFamily: 'inherit',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '4px 8px',
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: C.textMuted, fontWeight: 600 }}>Comment</span>
                  <ChevronDown size={10} color={C.textMuted} />
                  <div style={{ flex: 1 }} />
                  {[<Plus size={14} />, <Paperclip size={14} />, <AtSign size={14} />].map((icon, index) => (
                    <button
                      key={index}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: C.textMuted,
                        display: 'flex',
                        padding: 4,
                        borderRadius: 3,
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                  <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
                  <button
                    onClick={() => { void handleSubmitComment(); }}
                    disabled={!commentText.trim() || savingField === 'comment'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: !commentText.trim() || savingField === 'comment' ? 'default' : 'pointer',
                      color: commentText.trim() ? C.accent : C.textMuted,
                      display: 'flex',
                      padding: 4,
                      borderRadius: 3,
                      opacity: savingField === 'comment' ? 0.7 : 1,
                    }}
                  >
                    {savingField === 'comment'
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Send size={14} />}
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
