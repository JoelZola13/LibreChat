/**
 * Adapter layer: transforms Paperclip API data → existing Task/UserInfo interfaces
 * so we can reuse BoardView, CalendarView, and other tasks/ components directly.
 */
import type { Task, Label } from '@/lib/api/tasks';
import type { UserInfo } from '../tasks/constants';
import type {
  PaperclipAgent, PaperclipIssue, PaperclipLabel,
  ClickUpSpace, ClickUpFolder, ClickUpList,
} from './types';

// ── Priority mapping (Paperclip → tasks/ component) ──

const PRIORITY_MAP: Record<string, string> = {
  critical: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

// ── Issue → Task ──

export function issueToTask(issue: PaperclipIssue, allIssues: PaperclipIssue[]): Task {
  const subtasks = allIssues.filter(i => i.parentId === issue.id);
  const completedSubtasks = subtasks.filter(i => i.status === 'done').length;

  return {
    id: issue.id,
    projectId: issue.projectId || '',
    parentTaskId: issue.parentId,
    title: issue.title,
    description: issue.description || undefined,
    status: issue.status === 'backlog' ? 'todo' : issue.status,
    priority: PRIORITY_MAP[issue.priority] || 'none',
    dueAt: undefined, // Paperclip has no due date
    startAt: issue.startedAt || undefined,
    completedAt: issue.completedAt || undefined,
    assignees: issue.assigneeAgentId ? [issue.assigneeAgentId] : [],
    labels: issue.labels.map(l => l.id),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    position: issue.issueNumber,
    subtaskCount: subtasks.length,
    completedSubtasks,
    commentCount: 0,
    milestoneId: null,
    recurrenceRule: null,
  };
}

export function issuesToTasks(issues: PaperclipIssue[]): Task[] {
  return issues.map(i => issueToTask(i, issues));
}

// ── Agent → UserInfo ──

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 55%)`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function agentToUserInfo(agent: PaperclipAgent): UserInfo {
  return {
    name: agent.name,
    avatar: hashColor(agent.id),
    initials: getInitials(agent.name),
  };
}

export function buildAgentMap(agents: PaperclipAgent[]): Record<string, UserInfo> {
  const map: Record<string, UserInfo> = {};
  agents.forEach(a => { map[a.id] = agentToUserInfo(a); });
  return map;
}

// ── Label mapping ──

export function paperclipLabelsToLabels(labels: PaperclipLabel[]): Label[] {
  return labels.map(l => ({ id: l.id, name: l.name, color: l.color }));
}

// ── Hierarchy builder ──

export function buildHierarchy(
  agents: PaperclipAgent[],
  issues: PaperclipIssue[],
): ClickUpSpace {
  // Count tasks per agent
  const tasksByAgent = new Map<string, number>();
  let unassignedCount = 0;
  const topLevelIssues = issues.filter(i => !i.parentId);

  for (const issue of topLevelIssues) {
    if (issue.assigneeAgentId) {
      tasksByAgent.set(issue.assigneeAgentId, (tasksByAgent.get(issue.assigneeAgentId) || 0) + 1);
    } else {
      unassignedCount++;
    }
  }

  // Build a single "Team" folder containing all agents who have tasks assigned,
  // plus a flat list of all other agents for assignment purposes
  const agentsWithTasks: ClickUpList[] = [];
  const agentsWithoutTasks: ClickUpList[] = [];

  // Sort agents alphabetically
  const sorted = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  for (const agent of sorted) {
    const count = tasksByAgent.get(agent.id) || 0;
    const list: ClickUpList = {
      id: `agent-${agent.id}`,
      name: agent.name,
      taskCount: count,
      agentId: agent.id,
    };
    if (count > 0) {
      agentsWithTasks.push(list);
    } else {
      agentsWithoutTasks.push(list);
    }
  }

  const folders: ClickUpFolder[] = [];

  // "Active" folder: agents who currently have tasks
  if (agentsWithTasks.length > 0) {
    folders.push({
      id: 'active-members',
      name: 'Active Members',
      lists: agentsWithTasks,
      taskCount: agentsWithTasks.reduce((s, l) => s + l.taskCount, 0),
    });
  }

  // "All Members" folder: everyone else (collapsed by default in sidebar)
  if (agentsWithoutTasks.length > 0) {
    folders.push({
      id: 'all-members',
      name: 'All Members',
      lists: agentsWithoutTasks,
      taskCount: 0,
    });
  }

  // Unassigned
  if (unassignedCount > 0) {
    folders.push({
      id: 'unassigned-folder',
      name: 'Unassigned',
      lists: [{ id: 'unassigned', name: 'Unassigned Tasks', taskCount: unassignedCount }],
      taskCount: unassignedCount,
    });
  }

  return {
    id: 'street-voices',
    name: 'Street Voices',
    folders,
    totalTasks: topLevelIssues.length,
  };
}

// ── Filter helpers ──

export function filterIssues(
  issues: PaperclipIssue[],
  opts: {
    listId?: string | null;
    statuses?: string[];
    priorities?: string[];
    assignees?: string[];
    labels?: string[];
    search?: string;
  },
): PaperclipIssue[] {
  let result = issues.filter(i => !i.parentId); // top-level only

  // List filter
  if (opts.listId === 'unassigned') {
    result = result.filter(i => !i.assigneeAgentId);
  } else if (opts.listId?.startsWith('agent-')) {
    const agentId = opts.listId.replace('agent-', '');
    result = result.filter(i => i.assigneeAgentId === agentId);
  }
  // "all" or null = no list filter

  // Status filter
  if (opts.statuses && opts.statuses.length > 0) {
    result = result.filter(i => opts.statuses!.includes(i.status));
  }

  // Priority filter
  if (opts.priorities && opts.priorities.length > 0) {
    const mapped = opts.priorities.map(p => {
      if (p === 'urgent') return 'critical';
      return p;
    });
    result = result.filter(i => mapped.includes(i.priority));
  }

  // Assignee filter
  if (opts.assignees && opts.assignees.length > 0) {
    result = result.filter(i => i.assigneeAgentId && opts.assignees!.includes(i.assigneeAgentId));
  }

  // Label filter
  if (opts.labels && opts.labels.length > 0) {
    result = result.filter(i => i.labels.some(l => opts.labels!.includes(l.id)));
  }

  // Search filter
  if (opts.search && opts.search.trim()) {
    const q = opts.search.toLowerCase();
    result = result.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.identifier.toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q))
    );
  }

  return result;
}

export function groupByStatus(issues: PaperclipIssue[], allIssues: PaperclipIssue[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {
    todo: [], in_progress: [], done: [],
  };
  for (const issue of issues) {
    const task = issueToTask(issue, allIssues);
    // Remap backlog → todo (backlog removed from UI)
    const status = issue.status === 'backlog' ? 'todo' : issue.status;
    if (groups[status]) {
      groups[status].push(task);
    } else {
      groups.todo.push(task);
    }
  }
  // Sort each group by position (issueNumber)
  for (const key in groups) {
    groups[key].sort((a, b) => b.position - a.position);
  }
  return groups;
}
