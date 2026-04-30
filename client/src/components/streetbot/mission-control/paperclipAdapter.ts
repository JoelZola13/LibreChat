/**
 * Adapter layer: transforms Paperclip API data → existing Task/UserInfo interfaces
 * so we can reuse BoardView, CalendarView, and other tasks/ components directly.
 */
import type { Task, Label } from '@/lib/api/tasks';
import type { UserInfo } from '../tasks/constants';
import type {
  PaperclipAgent, PaperclipIssue, PaperclipLabel,
  ClickUpSpace, ClickUpFolder, ClickUpList, HumanAssigneeOption,
} from './types';

// ── Priority mapping (Paperclip → tasks/ component) ──

const PRIORITY_MAP: Record<string, string> = {
  critical: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export const CUSTOM_OTHER_ASSIGNEE_ID = 'custom-other';

const CUSTOM_ASSIGNEE_PREFIX = '[custom-assignee:';
const TASK_META_PREFIX = '[task-meta:';

export interface IssueDescriptionMetadata {
  notes?: string | null;
  url?: string | null;
  files?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  attachments?: TaskAttachment[] | null;
}

export interface TaskAttachment {
  file_id: string;
  filename: string;
  filepath: string;
  user: string;
  source?: string | null;
  type?: string | null;
}

export const HUMAN_ASSIGNEES: HumanAssigneeOption[] = [
  { id: 'joel-zola', name: 'Joel Zola' },
  { id: 'ayse-barut', name: 'Ayse Barut' },
  { id: 'selina-mccallum', name: 'Selina McCallum' },
  { id: 'sam-walters', name: 'Sam Walters' },
  { id: 'nathania-mbeshi', name: 'Nathania Mbeshi' },
  { id: CUSTOM_OTHER_ASSIGNEE_ID, name: 'Other' },
];

function getIssueAssigneeId(issue: PaperclipIssue): string | null {
  if (issue.assigneeAgentId) return issue.assigneeAgentId;
  if (!issue.assigneeUserId) return null;
  if (issue.assigneeUserId === CUSTOM_OTHER_ASSIGNEE_ID) {
    const customName = extractCustomAssigneeName(issue.description);
    if (customName) return `${CUSTOM_OTHER_ASSIGNEE_ID}:${issue.id}`;
  }
  return issue.assigneeUserId;
}

function getHumanAssignee(id: string): HumanAssigneeOption | undefined {
  return HUMAN_ASSIGNEES.find((option) => option.id === id);
}

function normalizeAttachments(value: unknown): TaskAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      file_id: typeof item.file_id === 'string' ? item.file_id : '',
      filename: typeof item.filename === 'string' ? item.filename : '',
      filepath: typeof item.filepath === 'string' ? item.filepath : '',
      user: typeof item.user === 'string' ? item.user : '',
      source: typeof item.source === 'string' ? item.source : null,
      type: typeof item.type === 'string' ? item.type : null,
    }))
    .filter((item) => item.file_id && item.filename && item.filepath && item.user);
}

function parseIssueDescription(description?: string | null): {
  customAssigneeName: string | null;
  metadata: IssueDescriptionMetadata;
  content: string | null;
} {
  if (!description) {
    return { customAssigneeName: null, metadata: {}, content: null };
  }

  const lines = description.split('\n');
  let cursor = 0;
  let customAssigneeName: string | null = null;
  let metadata: IssueDescriptionMetadata = {};
  let foundMarker = false;

  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    if (!line) {
      if (!foundMarker) {
        break;
      }
      cursor += 1;
      continue;
    }

    if (line.startsWith(CUSTOM_ASSIGNEE_PREFIX) && line.endsWith(']')) {
      customAssigneeName = line.slice(CUSTOM_ASSIGNEE_PREFIX.length, -1).trim() || null;
      foundMarker = true;
      cursor += 1;
      continue;
    }

    if (line.startsWith(TASK_META_PREFIX) && line.endsWith(']')) {
      const rawJson = line.slice(TASK_META_PREFIX.length, -1);
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === 'object') {
          metadata = {
            notes: typeof parsed.notes === 'string' ? parsed.notes : null,
            url: typeof parsed.url === 'string' ? parsed.url : null,
            files: typeof parsed.files === 'string' ? parsed.files : null,
            startAt: typeof parsed.startAt === 'string' ? parsed.startAt : null,
            dueAt: typeof parsed.dueAt === 'string' ? parsed.dueAt : null,
            attachments: normalizeAttachments(parsed.attachments),
          };
        }
      } catch {
        metadata = {};
      }
      foundMarker = true;
      cursor += 1;
      continue;
    }

    break;
  }

  const content = lines.slice(cursor).join('\n').replace(/^\n+/, '').trim();
  return {
    customAssigneeName,
    metadata,
    content: content || null,
  };
}

function cleanMetadata(metadata: IssueDescriptionMetadata): IssueDescriptionMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      if (key === 'attachments' && Array.isArray(value)) {
        return value.length > 0;
      }
      return false;
    }),
  );
}

export function buildIssueDescription({
  content,
  customAssigneeName,
  metadata,
}: {
  content?: string | null;
  customAssigneeName?: string | null;
  metadata?: IssueDescriptionMetadata;
}): string {
  const markers: string[] = [];
  const cleanContent = content?.trim() || '';
  const cleanName = customAssigneeName?.trim();
  const cleanMeta = cleanMetadata(metadata || {});

  if (cleanName) {
    markers.push(`${CUSTOM_ASSIGNEE_PREFIX}${cleanName}]`);
  }

  if (Object.keys(cleanMeta).length > 0) {
    markers.push(`${TASK_META_PREFIX}${JSON.stringify(cleanMeta)}]`);
  }

  if (markers.length === 0) {
    return cleanContent;
  }

  return cleanContent ? `${markers.join('\n')}\n\n${cleanContent}` : markers.join('\n');
}

export function extractCustomAssigneeName(description?: string | null): string | null {
  return parseIssueDescription(description).customAssigneeName;
}

export function extractIssueMetadata(description?: string | null): IssueDescriptionMetadata {
  return parseIssueDescription(description).metadata;
}

export function stripCustomAssigneeMarker(description?: string | null): string | null {
  return parseIssueDescription(description).content;
}

export function prependCustomAssigneeMarker(
  description: string | undefined,
  customAssigneeName: string | undefined,
): string {
  const parsed = parseIssueDescription(description);
  return buildIssueDescription({
    content: parsed.content,
    customAssigneeName,
    metadata: parsed.metadata,
  });
}

export function replaceIssueDescriptionContent(
  description: string | undefined | null,
  content: string | undefined | null,
): string {
  const parsed = parseIssueDescription(description);
  return buildIssueDescription({
    content,
    customAssigneeName: parsed.customAssigneeName,
    metadata: parsed.metadata,
  });
}

export function replaceIssueDescriptionMetadata(
  description: string | undefined | null,
  metadata: IssueDescriptionMetadata,
): string {
  const parsed = parseIssueDescription(description);
  return buildIssueDescription({
    content: parsed.content,
    customAssigneeName: parsed.customAssigneeName,
    metadata,
  });
}

// ── Issue → Task ──

export function issueToTask(issue: PaperclipIssue, allIssues: PaperclipIssue[]): Task {
  const subtasks = allIssues.filter(i => i.parentId === issue.id);
  const completedSubtasks = subtasks.filter(i => i.status === 'done').length;
  const assigneeId = getIssueAssigneeId(issue);
  const parsed = parseIssueDescription(issue.description);

  return {
    id: issue.id,
    projectId: issue.projectId || '',
    parentTaskId: issue.parentId,
    title: issue.title,
    description: parsed.content || undefined,
    status: issue.status === 'backlog' ? 'todo' : issue.status,
    priority: PRIORITY_MAP[issue.priority] || 'none',
    dueAt: issue.dueDate || parsed.metadata.dueAt || undefined,
    startAt: issue.startedAt || parsed.metadata.startAt || undefined,
    completedAt: issue.completedAt || undefined,
    assignees: assigneeId ? [assigneeId] : [],
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

function humanAssigneeToUserInfo(assignee: HumanAssigneeOption): UserInfo {
  return {
    name: assignee.name,
    avatar: hashColor(assignee.id),
    initials: getInitials(assignee.name),
  };
}

export function getIssueAssigneeName(issue: PaperclipIssue): string | null {
  if (issue.assigneeUserId === CUSTOM_OTHER_ASSIGNEE_ID) {
    return extractCustomAssigneeName(issue.description) || getHumanAssignee(CUSTOM_OTHER_ASSIGNEE_ID)?.name || 'Other';
  }
  if (issue.assigneeUserId) {
    return getHumanAssignee(issue.assigneeUserId)?.name || issue.assigneeUserId;
  }
  return null;
}

export function buildAgentMap(agents: PaperclipAgent[], issues: PaperclipIssue[] = []): Record<string, UserInfo> {
  const map: Record<string, UserInfo> = {};
  agents.forEach(a => { map[a.id] = agentToUserInfo(a); });
  HUMAN_ASSIGNEES.forEach((assignee) => {
    map[assignee.id] = humanAssigneeToUserInfo(assignee);
  });
  issues.forEach((issue) => {
    if (issue.assigneeUserId !== CUSTOM_OTHER_ASSIGNEE_ID) return;
    const customName = extractCustomAssigneeName(issue.description);
    if (!customName) return;
    const syntheticId = `${CUSTOM_OTHER_ASSIGNEE_ID}:${issue.id}`;
    map[syntheticId] = humanAssigneeToUserInfo({ id: syntheticId, name: customName });
  });
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
    } else if (!issue.assigneeUserId) {
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
    result = result.filter(i => !i.assigneeAgentId && !i.assigneeUserId);
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
    result = result.filter(i => {
      const assigneeId = getIssueAssigneeId(i);
      return assigneeId ? opts.assignees!.includes(assigneeId) : false;
    });
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
