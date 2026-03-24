import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Circle, CheckCheck, Flag, User, Calendar, MessageSquare,
  Plus, ChevronDown, ChevronRight, Loader2, CirclePlus,
  Link2, Paperclip,
} from 'lucide-react';
import { GlassBackground } from '../shared/GlassBackground';
import { BoardView } from '../tasks/BoardView';
import { CalendarView } from '../tasks/CalendarView';
import { DEFAULT_STATUSES, DEFAULT_COLORS } from '../tasks/constants';
import { useClickUpData } from './useClickUpData';
import { issueToTask } from './paperclipAdapter';
import ClickUpSidebar from './ClickUpSidebar';
import ClickUpToolbar from './ClickUpToolbar';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskModal from './CreateTaskModal';
import AgentDetailView from './AgentDetailView';
import FieldsPanel, { ALL_FIELDS } from './FieldsPanel';
import { AssigneePicker, getCellEditor, formatCellValue, getFieldValue, setFieldValue } from './InlineCellEditors';
import { useGlassStyles } from '../shared/useGlassStyles';
import type { PaperclipIssue } from './types';
import type { Task } from '@/lib/api/tasks';
import type { UserInfo } from '../tasks/constants';

const C = DEFAULT_COLORS;

// ── Route parsing ──

type ViewState =
  | { view: 'main' }
  | { view: 'agent'; slug: string };

function parseView(pathname: string): ViewState {
  const agentMatch = pathname.match(/\/tasks\/agent\/([^/]+)/);
  if (agentMatch) return { view: 'agent', slug: agentMatch[1] };
  return { view: 'main' };
}

// ── Status config ──

const STATUS_ORDER = ['in_progress', 'todo', 'done'];
const STATUS_COLORS: Record<string, string> = {
  in_progress: '#eab308', todo: '#6b7280', done: '#22c55e',
};
const STATUS_LABELS: Record<string, string> = {
  in_progress: 'IN PROGRESS', todo: 'TO DO', done: 'COMPLETE',
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
};

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ── Custom fields storage ──

function loadActiveFields(): string[] {
  try { return JSON.parse(localStorage.getItem('sv-active-fields') || '[]'); }
  catch { return []; }
}

// ── Status-grouped List View with configurable columns ──

function ClickUpListView({ tasksByStatus, allTasks, agentMap, onTaskClick, onAddTask, activeFields, onAssign, onCreateSubtask }: {
  tasksByStatus: Record<string, Task[]>;
  allTasks: Task[];
  agentMap: Record<string, { name: string; avatar: string; initials: string }>;
  onTaskClick: (task: Task) => void;
  onAddTask: () => void;
  activeFields: string[];
  onAssign: (taskId: string, agentId: string | null) => void;
  onCreateSubtask: (parentId: string, title: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [fieldsPanel, setFieldsPanel] = useState<{ x: number; y: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ taskId: string; fieldId: string } | null>(null);
  const [assigningTask, setAssigningTask] = useState<string | null>(null);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [, forceUpdate] = useState(0); // trigger re-render after cell edits

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
        setAddingSubtaskFor(null);
        setSubtaskTitle('');
      } else {
        next.add(taskId);
        // Auto-open add subtask input if no subtasks yet
      }
      return next;
    });
  }, []);

  const getSubtasks = useCallback((parentId: string): Task[] => {
    return allTasks.filter(t => t.parentTaskId === parentId);
  }, [allTasks]);

  // Build the agent list for the picker
  const agentList = useMemo(() =>
    Object.entries(agentMap).map(([id, info]) => ({ id, ...info })).sort((a, b) => a.name.localeCompare(b.name)),
    [agentMap]
  );

  // Build grid columns: checkbox + name + assignee + due_date + priority + custom fields + add button
  const customFieldDefs = activeFields.map(id => ALL_FIELDS.find(f => f.id === id)).filter(Boolean);
  const extraCols = customFieldDefs.map(f => `${f!.defaultWidth || 100}px`).join(' ');
  const gridCols = `40px minmax(200px, 1fr) 100px 80px 60px ${extraCols} 36px`;

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0' }}>
      {STATUS_ORDER.map(statusId => {
        const tasks = tasksByStatus[statusId] || [];
        const isCollapsed = collapsed[statusId];
        const color = STATUS_COLORS[statusId] || '#6b7280';
        const label = STATUS_LABELS[statusId] || statusId.toUpperCase();

        return (
          <div key={statusId}>
            {/* Status header */}
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [statusId]: !prev[statusId] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: 'transparent', borderBottom: `1px solid ${C.border}`,
                color: C.text, fontSize: '0.75rem', fontWeight: 700,
              }}
            >
              {isCollapsed ? <ChevronRight size={14} color={C.textMuted} /> : <ChevronDown size={14} color={C.textMuted} />}
              <Circle size={8} fill={color} color={color} />
              <span style={{ color }}>{label}</span>
              <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: 4 }}>{tasks.length}</span>
            </button>

            {/* Column headers */}
            {!isCollapsed && tasks.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: gridCols,
                padding: '4px 16px',
                borderBottom: `1px solid ${C.border}`,
                fontSize: '0.6rem', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase',
                alignItems: 'center',
              }}>
                <span />
                <span>Name</span>
                <span>Assignee</span>
                <span>Due date</span>
                <span>Priority</span>
                {customFieldDefs.map(f => (
                  <span key={f!.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: f!.iconColor, display: 'flex' }}>{React.cloneElement(f!.icon as React.ReactElement, { size: 10 })}</span>
                    {f!.label}
                  </span>
                ))}
                {/* Add field button */}
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setFieldsPanel({ x: rect.right - 280, y: rect.bottom + 4 });
                  }}
                  title="Add field"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.textMuted, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 0, borderRadius: 4,
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.text; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
                >
                  <CirclePlus size={14} />
                </button>
              </div>
            )}

            {/* Task rows */}
            {!isCollapsed && tasks.map(task => {
              const assigneeId = task.assignees[0];
              const assignee = assigneeId ? agentMap[assigneeId] : null;
              const priColor = PRIORITY_COLORS[task.priority] || '#6b7280';
              const hasSubtasks = task.subtaskCount > 0;
              const isExpanded = expandedTasks.has(task.id);
              const subtasks = isExpanded ? getSubtasks(task.id) : [];

              return (
                <React.Fragment key={task.id}>
                  <div
                    className="clickup-task-row"
                    onClick={() => onTaskClick(task)}
                    style={{
                      display: 'grid', gridTemplateColumns: gridCols,
                      alignItems: 'center',
                      padding: '8px 16px', width: '100%', textAlign: 'left',
                      border: 'none', cursor: 'pointer',
                      borderBottom: `1px solid ${C.border}`,
                      background: 'transparent', color: C.text,
                      fontSize: '0.8rem', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.rowHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Checkbox + expand triangle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4,
                        border: `2px solid ${color}`,
                        background: task.status === 'done' ? color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {task.status === 'done' && <CheckCheck size={10} color="#fff" />}
                      </div>
                      {/* ClickUp-style filled triangle */}
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          toggleTaskExpand(task.id);
                          if (!isExpanded && !hasSubtasks) {
                            setAddingSubtaskFor(task.id);
                          }
                        }}
                        title="Create subtask"
                        style={{
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center',
                          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${C.textMuted}33`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" style={{
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                        }}>
                          <path d="M2 1 L6 4 L2 7 Z" fill={hasSubtasks ? C.textMuted : `${C.textMuted}55`} />
                        </svg>
                      </div>
                    </div>

                    {/* Title + hover action buttons */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      overflow: 'hidden',
                    }}>
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: 500,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        opacity: task.status === 'done' ? 0.6 : 1,
                      }}>
                        {task.title}
                      </span>
                      {hasSubtasks && (
                        <span style={{ fontSize: '0.6rem', color: C.textMuted, flexShrink: 0 }}>
                          ({task.completedSubtasks}/{task.subtaskCount})
                        </span>
                      )}
                      {/* ClickUp-style hover action buttons */}
                      <div className="task-row-actions" style={{
                        display: 'none', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto',
                      }}>
                        {[
                          { icon: <Plus size={13} />, title: 'Add subtask', action: (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (!isExpanded) toggleTaskExpand(task.id);
                            setAddingSubtaskFor(task.id);
                          }},
                          { icon: <Link2 size={13} />, title: 'Copy link' },
                          { icon: <Paperclip size={13} />, title: 'Attach' },
                          { icon: <MessageSquare size={13} />, title: 'Comment' },
                        ].map((btn, i) => (
                          <button
                            key={i}
                            title={btn.title}
                            onClick={btn.action || (e => e.stopPropagation())}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: C.textMuted, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', padding: 3, borderRadius: 3,
                              transition: 'color 0.1s, background 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = `${C.textMuted}22`; }}
                            onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'none'; }}
                          >
                            {btn.icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Assignee — clickable */}
                    <div
                      style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setAssigningTask(assigningTask === task.id ? null : task.id); }}
                    >
                      {assignee ? (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: assignee.avatar,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.5rem', fontWeight: 700, color: '#fff',
                          transition: 'outline 0.12s',
                          outline: assigningTask === task.id ? `2px solid ${C.accent}` : 'none',
                          outlineOffset: 2,
                        }}>
                          {assignee.initials}
                        </div>
                      ) : (
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          border: `1.5px dashed ${assigningTask === task.id ? C.accent : C.border}`,
                          transition: 'border-color 0.12s',
                        }} />
                      )}
                      {assigningTask === task.id && (
                        <AssigneePicker
                          agents={agentList}
                          currentAssigneeId={assigneeId}
                          onSelect={(agentId) => onAssign(task.id, agentId)}
                          onClose={() => setAssigningTask(null)}
                        />
                      )}
                    </div>

                    {/* Due date */}
                    <span style={{ fontSize: '0.7rem', color: C.textMuted }}>
                      {relativeTime(task.updatedAt)}
                    </span>

                    {/* Priority */}
                    <div>
                      <Flag size={14} color={priColor} fill={task.priority !== 'none' ? `${priColor}44` : 'transparent'} />
                    </div>

                    {/* Custom field cells — clickable inline editors */}
                    {customFieldDefs.map(f => {
                      const isEditing = editingCell?.taskId === task.id && editingCell?.fieldId === f!.id;
                      const displayVal = formatCellValue(f!.id, task.id);
                      const hasValue = getFieldValue(task.id, f!.id) !== '';
                      const Editor = isEditing ? getCellEditor(f!.id) : null;

                      return (
                        <div
                          key={f!.id}
                          style={{
                            position: 'relative', cursor: 'pointer',
                            fontSize: '0.7rem',
                            color: hasValue ? C.text : C.textMuted,
                            fontWeight: hasValue ? 500 : 400,
                            padding: '2px 4px', borderRadius: 4,
                            transition: 'background 0.1s',
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            if (f!.id === 'checkbox') {
                              const cur = getFieldValue(task.id, f!.id) === 'true';
                              setFieldValue(task.id, f!.id, (!cur).toString());
                              forceUpdate(n => n + 1);
                            } else {
                              setEditingCell(isEditing ? null : { taskId: task.id, fieldId: f!.id });
                            }
                          }}
                        >
                          {displayVal}
                          {Editor && (
                            <Editor
                              taskId={task.id}
                              fieldId={f!.id}
                              onClose={() => { setEditingCell(null); forceUpdate(n => n + 1); }}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Spacer for add column */}
                    <div />
                  </div>

                  {/* Subtask rows — indented under parent */}
                  {isExpanded && (
                    <div style={{
                      borderLeft: `2px solid ${color}`,
                      marginLeft: 28,
                    }}>
                      {subtasks.map(sub => {
                        const subAssigneeId = sub.assignees[0];
                        const subAssignee = subAssigneeId ? agentMap[subAssigneeId] : null;
                        const subPriColor = PRIORITY_COLORS[sub.priority] || '#6b7280';
                        const subStatusColor = STATUS_COLORS[sub.status] || '#6b7280';

                        return (
                          <button
                            key={sub.id}
                            onClick={() => onTaskClick(sub)}
                            style={{
                              display: 'grid', gridTemplateColumns: gridCols,
                              alignItems: 'center',
                              padding: '6px 16px', width: '100%', textAlign: 'left',
                              border: 'none', cursor: 'pointer',
                              borderBottom: `1px solid ${C.border}`,
                              background: 'transparent', color: C.text,
                              fontSize: '0.75rem', transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.rowHover; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            {/* Checkbox */}
                            <div style={{ paddingLeft: 8 }}>
                              <div style={{
                                width: 14, height: 14, borderRadius: 3,
                                border: `2px solid ${subStatusColor}`,
                                background: sub.status === 'done' ? subStatusColor : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {sub.status === 'done' && <CheckCheck size={8} color="#fff" />}
                              </div>
                            </div>

                            {/* Title */}
                            <div style={{
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontWeight: 400,
                              textDecoration: sub.status === 'done' ? 'line-through' : 'none',
                              opacity: sub.status === 'done' ? 0.6 : 1,
                              color: C.textMuted,
                            }}>
                              {sub.title}
                            </div>

                            {/* Assignee */}
                            <div>
                              {subAssignee ? (
                                <div style={{
                                  width: 20, height: 20, borderRadius: '50%',
                                  background: subAssignee.avatar,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.45rem', fontWeight: 700, color: '#fff',
                                }}>
                                  {subAssignee.initials}
                                </div>
                              ) : (
                                <div style={{
                                  width: 20, height: 20, borderRadius: '50%',
                                  border: `1.5px dashed ${C.border}`,
                                }} />
                              )}
                            </div>

                            {/* Due date */}
                            <span style={{ fontSize: '0.65rem', color: C.textMuted }}>
                              {relativeTime(sub.updatedAt)}
                            </span>

                            {/* Priority */}
                            <div>
                              <Flag size={12} color={subPriColor} fill={sub.priority !== 'none' ? `${subPriColor}44` : 'transparent'} />
                            </div>

                            {/* Custom fields spacers */}
                            {customFieldDefs.map(f => <div key={f!.id} />)}
                            <div />
                          </button>
                        );
                      })}

                      {/* Add subtask row — ClickUp-style inline input */}
                      {addingSubtaskFor === task.id ? (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 12px 6px 8px', width: '100%',
                            borderBottom: `1px solid ${C.border}`,
                            background: C.rowHover,
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4,
                            border: `2px solid ${color}`,
                            flexShrink: 0,
                          }} />
                          <input
                            autoFocus
                            value={subtaskTitle}
                            onChange={e => setSubtaskTitle(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === 'Enter' && subtaskTitle.trim()) {
                                await onCreateSubtask(task.id, subtaskTitle.trim());
                                setSubtaskTitle('');
                              }
                              if (e.key === 'Escape') {
                                setAddingSubtaskFor(null);
                                setSubtaskTitle('');
                              }
                            }}
                            onBlur={() => {
                              if (!subtaskTitle.trim()) {
                                setAddingSubtaskFor(null);
                                setSubtaskTitle('');
                              }
                            }}
                            placeholder="Task Name or type '/' for commands"
                            style={{
                              flex: 1, background: 'transparent', border: 'none',
                              outline: 'none', color: C.text, fontSize: '0.78rem',
                              fontFamily: 'inherit',
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setAddingSubtaskFor(task.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 16px 4px 8px', width: '100%',
                            borderBottom: `1px solid ${C.border}`,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: C.textMuted, fontSize: '0.7rem',
                            transition: 'color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.rowHover; }}
                          onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Plus size={10} />
                          Add subtask
                        </button>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Add Task row */}
            {!isCollapsed && (
              <button
                onClick={onAddTask}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px 6px 56px', width: '100%',
                  borderBottom: `1px solid ${C.border}`,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: C.textMuted, fontSize: '0.75rem',
                  transition: 'color 0.12s, background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.rowHover; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus size={12} />
                Add Task
              </button>
            )}
          </div>
        );
      })}

      {/* Fields panel portal */}
      {fieldsPanel && (
        <FieldsPanelPortal
          position={fieldsPanel}
          activeFields={activeFields}
          onClose={() => setFieldsPanel(null)}
        />
      )}
    </div>
  );
}

// Wrapper to allow FieldsPanel to update parent's activeFields state
function FieldsPanelPortal({ position, activeFields, onClose }: {
  position: { x: number; y: number };
  activeFields: string[];
  onClose: () => void;
}) {
  // We need to manage state here and sync to localStorage
  const [fields, setFields] = useState(activeFields);

  const handleToggle = useCallback((fieldId: string) => {
    setFields(prev => {
      const next = prev.includes(fieldId)
        ? prev.filter(f => f !== fieldId)
        : [...prev, fieldId];
      localStorage.setItem('sv-active-fields', JSON.stringify(next));
      // Force a re-render of the parent by dispatching a storage event
      window.dispatchEvent(new Event('sv-fields-changed'));
      return next;
    });
  }, []);

  return (
    <FieldsPanel
      position={position}
      activeFields={fields}
      onToggleField={handleToggle}
      onClose={onClose}
    />
  );
}

// ── Main Page ──

export default function MissionControlPage() {
  const { isDark, colors, glassSurface } = useGlassStyles();
  const data = useClickUpData();
  const location = useLocation();
  const navigate = useNavigate();

  // Active custom fields
  const [activeFields, setActiveFields] = useState<string[]>(loadActiveFields);

  // Listen for field changes from the FieldsPanel
  useEffect(() => {
    const handler = () => setActiveFields(loadActiveFields());
    window.addEventListener('sv-fields-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('sv-fields-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const viewState = useMemo(() => parseView(location.pathname), [location.pathname]);

  const selectedIssue = useMemo(() => {
    if (!data.selectedTaskId || !data.raw.issues.data) return null;
    return data.raw.issues.data.find(i => i.identifier === data.selectedTaskId) || null;
  }, [data.selectedTaskId, data.raw.issues.data]);

  const selectedListName = useMemo(() => {
    if (!data.selectedListId || !data.hierarchy) return undefined;
    for (const folder of data.hierarchy.folders) {
      for (const list of folder.lists) {
        if (list.id === data.selectedListId) return list.name;
      }
    }
    return undefined;
  }, [data.selectedListId, data.hierarchy]);

  const handleTaskClick = useCallback((task: Task) => {
    const issue = data.raw.issues.data?.find(i => i.id === task.id);
    if (issue) data.setSelectedTaskId(issue.identifier);
  }, [data]);

  const handleNavigateTask = useCallback((identifier: string) => {
    data.setSelectedTaskId(identifier);
  }, [data]);

  const navigateToAgent = useCallback((slug: string) => {
    navigate(`/tasks/agent/${slug}`);
  }, [navigate]);

  const navigateToDashboard = useCallback(() => {
    navigate('/tasks');
  }, [navigate]);

  // All tasks including subtasks (for subtask expansion in list view)
  const allTasks = useMemo(() => {
    if (!data.raw.issues.data) return [];
    return data.raw.issues.data.map(i => issueToTask(i, data.raw.issues.data!));
  }, [data.raw.issues.data]);

  const handleAddTask = useCallback(() => {
    data.setShowCreateModal(true);
  }, [data]);

  const handleCreateSubtask = useCallback(async (parentId: string, title: string) => {
    await data.createTask({ title, parentId });
  }, [data]);

  // Assign agent to task via Paperclip internal API (PATCH /api/issues/:id)
  const handleAssign = useCallback(async (taskId: string, agentId: string | null) => {
    try {
      const body: Record<string, unknown> = {
        assigneeAgentId: agentId,
      };

      // Use the internal Paperclip route that supports PATCH
      await fetch(`/paperclip-internal/api/issues/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Refresh to get updated data
      data.refresh();
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  }, [data]);

  // Agent detail view
  if (viewState.view === 'agent') {
    return (
      <div style={{ position: 'relative', minHeight: '100%' }}>
        <GlassBackground />
        <div style={{ position: 'relative', zIndex: 1, padding: '32px 20px 60px', maxWidth: 1200, margin: '0 auto' }}>
          <AgentDetailView
            slug={viewState.slug}
            allAgents={data.raw.agents.data || []}
            allIssues={data.raw.issues.data || []}
            colors={colors}
            glassSurface={glassSurface}
            isDark={isDark}
            onBack={navigateToDashboard}
            onNavigateTask={handleNavigateTask}
          />
        </div>
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Main ClickUp view
  const statuses = DEFAULT_STATUSES.map(s => ({ id: s.id, name: s.name, color: s.color, category: s.category }));

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#14141c', color: C.text,
    }}>
      {/* Sidebar */}
      <ClickUpSidebar
        hierarchy={data.hierarchy}
        selectedListId={data.selectedListId}
        onSelectList={data.setSelectedListId}
        onCreateTask={handleAddTask}
        loading={data.loading}
      />

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <ClickUpToolbar
          viewMode={data.viewMode}
          onViewChange={data.setViewMode}
          filters={data.filters}
          onFiltersChange={data.setFilters}
          onCreateTask={handleAddTask}
          taskCount={data.filteredTasks.length}
          listName={selectedListName}
        />

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {data.loading && !data.raw.issues.data ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12,
              }}>
                <Loader2 size={28} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.85rem', color: C.textMuted }}>Loading tasks...</span>
              </div>
            ) : data.viewMode === 'list' ? (
              <ClickUpListView
                tasksByStatus={data.tasksByStatus}
                allTasks={allTasks}
                agentMap={data.agentMap}
                onTaskClick={handleTaskClick}
                onAddTask={handleAddTask}
                activeFields={activeFields}
                onAssign={handleAssign}
                onCreateSubtask={handleCreateSubtask}
              />
            ) : data.viewMode === 'board' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <BoardView
                  tasks={data.filteredTasks}
                  statuses={statuses}
                  labels={data.labels}
                  users={data.agentMap}
                  onTaskClick={handleTaskClick}
                />
              </div>
            ) : data.viewMode === 'calendar' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <CalendarView
                  tasks={data.filteredTasks}
                  labels={data.labels}
                  users={data.agentMap}
                  onTaskClick={handleTaskClick}
                />
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* Task detail modal overlay */}
      {selectedIssue && (
        <TaskDetailPanel
          issue={selectedIssue}
          allIssues={data.raw.issues.data || []}
          agentMap={data.agentMap}
          onClose={() => data.setSelectedTaskId(null)}
          onNavigateTask={handleNavigateTask}
        />
      )}

      {/* Create modal */}
      {data.showCreateModal && (
        <CreateTaskModal
          agents={data.raw.agents.data || []}
          onSubmit={data.createTask}
          onClose={() => data.setShowCreateModal(false)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .clickup-task-row:hover .task-row-actions { display: flex !important; }
      `}</style>
    </div>
  );
}
