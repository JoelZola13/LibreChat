/**
 * Grant Writer Proposals API service
 * Connects frontend to backend proposal management
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/sbapi";

// ============================================================================
// Types matching the backend API responses (snake_case from API)
// ============================================================================

interface ProposalApiResponse {
  id: string;
  title: string;
  status: string;
  grant_id?: string;
  organization_id?: string;
  executive_summary?: string;
  amount_requested?: number;
  amount_awarded?: number;
  submission_deadline?: string;
  submitted_at?: string;
  project_start_date?: string;
  project_end_date?: string;
  outcome?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
  document_count: number;
  version_count: number;
}

interface ProposalStatsApiResponse {
  total: number;
  draft: number;
  in_progress: number;
  review: number;
  submitted: number;
  awarded: number;
  rejected: number;
  total_requested: number;
  total_awarded: number;
}

// ============================================================================
// Frontend types (camelCase for React)
// ============================================================================

export interface Proposal {
  id: string;
  title: string;
  status: string;
  grantId?: string;
  organizationId?: string;
  executiveSummary?: string;
  amountRequested?: number;
  amountAwarded?: number;
  submissionDeadline?: string;
  submittedAt?: string;
  projectStartDate?: string;
  projectEndDate?: string;
  outcome?: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedTaskCount: number;
  documentCount: number;
  versionCount: number;
}

export interface ProposalStats {
  total: number;
  draft: number;
  inProgress: number;
  review: number;
  submitted: number;
  awarded: number;
  rejected: number;
  totalRequested: number;
  totalAwarded: number;
}

export interface ProposalCreateData {
  title: string;
  grantId?: string;
  organizationId?: string;
  executiveSummary?: string;
  problemStatement?: string;
  projectDescription?: string;
  goalsObjectives?: string;
  methodology?: string;
  evaluationPlan?: string;
  sustainabilityPlan?: string;
  organizationalCapacity?: string;
  budget?: Record<string, unknown>;
  amountRequested?: number;
  totalProjectCost?: number;
  matchingFunds?: number;
  projectStartDate?: string;
  projectEndDate?: string;
  submissionDeadline?: string;
  status?: string;
}

export interface ProposalUpdateData {
  title?: string;
  status?: string;
  executiveSummary?: string;
  problemStatement?: string;
  projectDescription?: string;
  goalsObjectives?: string;
  methodology?: string;
  evaluationPlan?: string;
  sustainabilityPlan?: string;
  organizationalCapacity?: string;
  budget?: Record<string, unknown>;
  amountRequested?: number;
  submissionDeadline?: string;
  outcome?: string;
  amountAwarded?: number;
  feedback?: string;
}

export interface ProposalFilters {
  userId?: string;
  status?: string;
  search?: string;
  sort?: "updated" | "deadline" | "title" | "created";
  skip?: number;
  limit?: number;
}

// ============================================================================
// Conversion helpers
// ============================================================================

function proposalFromApi(api: ProposalApiResponse): Proposal {
  return {
    id: api.id,
    title: api.title,
    status: api.status,
    grantId: api.grant_id,
    organizationId: api.organization_id,
    executiveSummary: api.executive_summary,
    amountRequested: api.amount_requested,
    amountAwarded: api.amount_awarded,
    submissionDeadline: api.submission_deadline,
    submittedAt: api.submitted_at,
    projectStartDate: api.project_start_date,
    projectEndDate: api.project_end_date,
    outcome: api.outcome,
    assignedTo: api.assigned_to,
    createdBy: api.created_by,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    taskCount: api.task_count,
    completedTaskCount: api.completed_task_count,
    documentCount: api.document_count,
    versionCount: api.version_count,
  };
}

function statsFromApi(api: ProposalStatsApiResponse): ProposalStats {
  return {
    total: api.total,
    draft: api.draft,
    inProgress: api.in_progress,
    review: api.review,
    submitted: api.submitted,
    awarded: api.awarded,
    rejected: api.rejected,
    totalRequested: api.total_requested,
    totalAwarded: api.total_awarded,
  };
}

function createDataToApi(data: ProposalCreateData): Record<string, unknown> {
  return {
    title: data.title,
    grant_id: data.grantId,
    organization_id: data.organizationId,
    executive_summary: data.executiveSummary,
    problem_statement: data.problemStatement,
    project_description: data.projectDescription,
    goals_objectives: data.goalsObjectives,
    methodology: data.methodology,
    evaluation_plan: data.evaluationPlan,
    sustainability_plan: data.sustainabilityPlan,
    organizational_capacity: data.organizationalCapacity,
    budget: data.budget,
    amount_requested: data.amountRequested,
    total_project_cost: data.totalProjectCost,
    matching_funds: data.matchingFunds,
    project_start_date: data.projectStartDate,
    project_end_date: data.projectEndDate,
    submission_deadline: data.submissionDeadline,
    status: data.status || "draft",
  };
}

function updateDataToApi(data: ProposalUpdateData): Record<string, unknown> {
  const apiData: Record<string, unknown> = {};

  if (data.title !== undefined) apiData.title = data.title;
  if (data.status !== undefined) apiData.status = data.status;
  if (data.executiveSummary !== undefined) apiData.executive_summary = data.executiveSummary;
  if (data.problemStatement !== undefined) apiData.problem_statement = data.problemStatement;
  if (data.projectDescription !== undefined) apiData.project_description = data.projectDescription;
  if (data.goalsObjectives !== undefined) apiData.goals_objectives = data.goalsObjectives;
  if (data.methodology !== undefined) apiData.methodology = data.methodology;
  if (data.evaluationPlan !== undefined) apiData.evaluation_plan = data.evaluationPlan;
  if (data.sustainabilityPlan !== undefined) apiData.sustainability_plan = data.sustainabilityPlan;
  if (data.organizationalCapacity !== undefined) apiData.organizational_capacity = data.organizationalCapacity;
  if (data.budget !== undefined) apiData.budget = data.budget;
  if (data.amountRequested !== undefined) apiData.amount_requested = data.amountRequested;
  if (data.submissionDeadline !== undefined) apiData.submission_deadline = data.submissionDeadline;
  if (data.outcome !== undefined) apiData.outcome = data.outcome;
  if (data.amountAwarded !== undefined) apiData.amount_awarded = data.amountAwarded;
  if (data.feedback !== undefined) apiData.feedback = data.feedback;

  return apiData;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch proposals with optional filters
 */
export async function fetchProposals(filters: ProposalFilters = {}): Promise<Proposal[]> {
  const params = new URLSearchParams();

  if (filters.userId) params.append("user_id", filters.userId);
  if (filters.status) params.append("status", filters.status);
  if (filters.search) params.append("search", filters.search);
  if (filters.sort) params.append("sort", filters.sort);
  if (filters.skip !== undefined) params.append("skip", String(filters.skip));
  if (filters.limit !== undefined) params.append("limit", String(filters.limit));

  const queryString = params.toString();
  const url = `/api/grantwriter/proposals${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch proposals" }));
    throw new Error(error.detail || "Failed to fetch proposals");
  }

  const data: ProposalApiResponse[] = await response.json();
  return data.map(proposalFromApi);
}

/**
 * Get a single proposal by ID
 */
export async function getProposal(id: string): Promise<Proposal> {
  const response = await fetch(`/api/grantwriter/proposals/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Proposal not found");
    }
    const error = await response.json().catch(() => ({ detail: "Failed to fetch proposal" }));
    throw new Error(error.detail || "Failed to fetch proposal");
  }

  const data: ProposalApiResponse = await response.json();
  return proposalFromApi(data);
}

/**
 * Create a new proposal
 */
export async function createProposal(
  data: ProposalCreateData,
  userId?: string
): Promise<Proposal> {
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);

  const queryString = params.toString();
  const url = `/api/grantwriter/proposals${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createDataToApi(data)),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create proposal" }));
    throw new Error(error.detail || "Failed to create proposal");
  }

  const result: ProposalApiResponse = await response.json();
  return proposalFromApi(result);
}

/**
 * Update an existing proposal
 */
export async function updateProposal(
  id: string,
  data: ProposalUpdateData
): Promise<Proposal> {
  const response = await fetch(`/api/grantwriter/proposals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateDataToApi(data)),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update proposal" }));
    throw new Error(error.detail || "Failed to update proposal");
  }

  const result: ProposalApiResponse = await response.json();
  return proposalFromApi(result);
}

/**
 * Delete a proposal
 */
export async function deleteProposal(id: string): Promise<void> {
  const response = await fetch(`/api/grantwriter/proposals/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete proposal" }));
    throw new Error(error.detail || "Failed to delete proposal");
  }
}

/**
 * Get proposal statistics for the dashboard
 */
export async function getProposalStats(userId?: string): Promise<ProposalStats> {
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);

  const queryString = params.toString();
  const url = `/api/grantwriter/proposals/stats${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch stats" }));
    throw new Error(error.detail || "Failed to fetch stats");
  }

  const data: ProposalStatsApiResponse = await response.json();
  return statsFromApi(data);
}
