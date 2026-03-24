export interface DashboardStats {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
}

export interface PaperclipAgent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string;
  icon: string;
  status: 'idle' | 'running' | 'paused' | 'error' | 'disabled';
  reportsTo: string | null;
  teamId: string | null;
  capabilities: string | null;
  adapterType: string;
  budgetMonthlyCents?: number;
  spentMonthlyCents?: number;
  lastHeartbeatAt?: string | null;
  urlKey?: string;
  metadata?: { team?: string; projectId?: string; nanobotName?: string; [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipIssue {
  id: string;
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'backlog';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
  issueNumber: number;
  identifier: string;
  labels: Array<{ id: string; name: string; color?: string }>;
  startedAt?: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt?: string | null;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  companyId: string;
  actorType: 'agent' | 'user' | 'system';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: {
    agentName?: string;
    model?: string;
    tokens?: number;
    session?: string;
    responseLength?: number;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface LiveRun {
  id: string;
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  issueId?: string;
  issueTitle?: string;
}

export interface HeartbeatRun {
  id: string;
  companyId: string;
  agentId: string;
  invocationSource: 'on_demand' | 'automation' | 'assignment' | 'timer';
  triggerDetail: string;
  status: 'succeeded' | 'failed' | 'running';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  stdoutExcerpt: string | null;
  stderrExcerpt: string | null;
  logBytes: number | null;
  usageJson: unknown;
  resultJson: unknown;
  contextSnapshot: {
    actorId?: string;
    projectId?: string;
    wakeSource?: string;
    triggeredBy?: string;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipGoal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: 'company' | 'team';
  status: 'active' | 'completed' | 'archived';
  parentId: string | null;
  ownerAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperclipLabel {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ── ClickUp Hierarchy Types ──

export interface ClickUpSpace {
  id: string;
  name: string;
  folders: ClickUpFolder[];
  totalTasks: number;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
  taskCount: number;
}

export interface ClickUpList {
  id: string;
  name: string;
  taskCount: number;
  agentId?: string;
}

export interface FilterState {
  statuses: string[];
  priorities: string[];
  assignees: string[];
  labels: string[];
  search: string;
}

export type ViewMode = 'list' | 'board' | 'calendar';

export interface DispatchRequest {
  agentName: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DispatchResponse {
  status: string;
  issue: {
    id: string;
    identifier: string;
    title: string;
    assignee: string;
  };
}
