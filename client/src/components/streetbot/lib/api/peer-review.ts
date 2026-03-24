/**
 * Peer Review API service - connects frontend to backend peer review system
 */

const API_BASE = '/sbapi';
const PEER_REVIEW_API = `${API_BASE}/academy/peer-review`;

// ============================================================================
// TYPES - API Response (snake_case from backend)
// ============================================================================

interface PeerReviewConfigApi {
  id: string;
  assignment_id: string;
  reviews_required: number;
  reviews_to_complete: number;
  review_deadline_days: number;
  allow_self_review: boolean;
  is_anonymous: boolean;
  rubric_required: boolean;
  min_feedback_length: number;
  points_for_reviewing: number;
  bonus_for_quality: number;
  weight_in_grade: number;
  auto_assign: boolean;
  created_at: string;
  updated_at: string;
}

interface PeerReviewAssignmentApi {
  id: string;
  assignment_id: string;
  submission_id: string;
  reviewer_id: string;
  reviewee_id: string;
  status: "assigned" | "in_progress" | "completed" | "expired";
  assigned_at: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  assignment_title?: string;
  reviewee_name?: string;
  submission_preview?: string;
}

interface PeerReviewCriterionScoreApi {
  id: string;
  peer_review_id: string;
  criterion_id: string;
  score: number;
  feedback?: string;
  created_at: string;
}

interface PeerReviewApi {
  id: string;
  peer_review_assignment_id: string;
  submission_id: string;
  reviewer_id: string;
  reviewee_id: string;
  overall_score?: number;
  overall_feedback?: string;
  strengths?: string;
  improvements?: string;
  is_anonymous: boolean;
  is_helpful?: boolean;
  helpfulness_rating?: number;
  reviewer_points_earned: number;
  review_quality_score?: number;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  criteria_scores?: PeerReviewCriterionScoreApi[];
}

interface PeerReviewForRevieweeApi {
  id: string;
  overall_score?: number;
  overall_feedback?: string;
  strengths?: string;
  improvements?: string;
  reviewer_name?: string;
  criteria_scores: PeerReviewCriterionScoreApi[];
  submitted_at: string;
}

interface ReviewerStatsApi {
  user_id: string;
  reviews_completed: number;
  reviews_pending: number;
  average_quality_score?: number;
  total_points_earned: number;
  helpfulness_rating_avg?: number;
}

interface PeerReviewSummaryApi {
  submission_id: string;
  total_reviews: number;
  reviews_needed: number;
  average_score?: number;
  min_score?: number;
  max_score?: number;
  reviews: PeerReviewForRevieweeApi[];
}

interface UserPeerReviewDashboardApi {
  user_id: string;
  pending_reviews: PeerReviewAssignmentApi[];
  completed_reviews: number;
  reviews_received: PeerReviewForRevieweeApi[];
  total_points_earned: number;
  average_given_score?: number;
  average_received_score?: number;
}

// ============================================================================
// TYPES - Frontend (camelCase for React)
// ============================================================================

export interface PeerReviewConfig {
  id: string;
  assignmentId: string;
  reviewsRequired: number;
  reviewsToComplete: number;
  reviewDeadlineDays: number;
  allowSelfReview: boolean;
  isAnonymous: boolean;
  rubricRequired: boolean;
  minFeedbackLength: number;
  pointsForReviewing: number;
  bonusForQuality: number;
  weightInGrade: number;
  autoAssign: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PeerReviewAssignment {
  id: string;
  assignmentId: string;
  submissionId: string;
  reviewerId: string;
  revieweeId: string;
  status: "assigned" | "in_progress" | "completed" | "expired";
  assignedAt: string;
  dueDate?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  assignmentTitle?: string;
  revieweeName?: string;
  submissionPreview?: string;
}

export interface PeerReviewCriterionScore {
  id: string;
  peerReviewId: string;
  criterionId: string;
  score: number;
  feedback?: string;
  createdAt: string;
}

export interface PeerReview {
  id: string;
  peerReviewAssignmentId: string;
  submissionId: string;
  reviewerId: string;
  revieweeId: string;
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string;
  improvements?: string;
  isAnonymous: boolean;
  isHelpful?: boolean;
  helpfulnessRating?: number;
  reviewerPointsEarned: number;
  reviewQualityScore?: number;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  criteriaScores?: PeerReviewCriterionScore[];
}

export interface PeerReviewForReviewee {
  id: string;
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string;
  improvements?: string;
  reviewerName?: string;
  criteriaScores: PeerReviewCriterionScore[];
  submittedAt: string;
}

export interface ReviewerStats {
  userId: string;
  reviewsCompleted: number;
  reviewsPending: number;
  averageQualityScore?: number;
  totalPointsEarned: number;
  helpfulnessRatingAvg?: number;
}

export interface PeerReviewSummary {
  submissionId: string;
  totalReviews: number;
  reviewsNeeded: number;
  averageScore?: number;
  minScore?: number;
  maxScore?: number;
  reviews: PeerReviewForReviewee[];
}

export interface UserPeerReviewDashboard {
  userId: string;
  pendingReviews: PeerReviewAssignment[];
  completedReviews: number;
  reviewsReceived: PeerReviewForReviewee[];
  totalPointsEarned: number;
  averageGivenScore?: number;
  averageReceivedScore?: number;
}

export interface PeerReviewCreate {
  peerReviewAssignmentId: string;
  submissionId: string;
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string;
  improvements?: string;
  criteriaScores?: { criterionId: string; score: number; feedback?: string }[];
}

export interface HelpfulnessRating {
  isHelpful: boolean;
  rating: number;
  comment?: string;
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

function transformCriterionScore(api: PeerReviewCriterionScoreApi): PeerReviewCriterionScore {
  return {
    id: api.id,
    peerReviewId: api.peer_review_id,
    criterionId: api.criterion_id,
    score: api.score,
    feedback: api.feedback,
    createdAt: api.created_at,
  };
}

function transformConfig(api: PeerReviewConfigApi): PeerReviewConfig {
  return {
    id: api.id,
    assignmentId: api.assignment_id,
    reviewsRequired: api.reviews_required,
    reviewsToComplete: api.reviews_to_complete,
    reviewDeadlineDays: api.review_deadline_days,
    allowSelfReview: api.allow_self_review,
    isAnonymous: api.is_anonymous,
    rubricRequired: api.rubric_required,
    minFeedbackLength: api.min_feedback_length,
    pointsForReviewing: api.points_for_reviewing,
    bonusForQuality: api.bonus_for_quality,
    weightInGrade: api.weight_in_grade,
    autoAssign: api.auto_assign,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformAssignment(api: PeerReviewAssignmentApi): PeerReviewAssignment {
  return {
    id: api.id,
    assignmentId: api.assignment_id,
    submissionId: api.submission_id,
    reviewerId: api.reviewer_id,
    revieweeId: api.reviewee_id,
    status: api.status,
    assignedAt: api.assigned_at,
    dueDate: api.due_date,
    startedAt: api.started_at,
    completedAt: api.completed_at,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    assignmentTitle: api.assignment_title,
    revieweeName: api.reviewee_name,
    submissionPreview: api.submission_preview,
  };
}

function transformReview(api: PeerReviewApi): PeerReview {
  return {
    id: api.id,
    peerReviewAssignmentId: api.peer_review_assignment_id,
    submissionId: api.submission_id,
    reviewerId: api.reviewer_id,
    revieweeId: api.reviewee_id,
    overallScore: api.overall_score,
    overallFeedback: api.overall_feedback,
    strengths: api.strengths,
    improvements: api.improvements,
    isAnonymous: api.is_anonymous,
    isHelpful: api.is_helpful,
    helpfulnessRating: api.helpfulness_rating,
    reviewerPointsEarned: api.reviewer_points_earned,
    reviewQualityScore: api.review_quality_score,
    submittedAt: api.submitted_at,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    criteriaScores: api.criteria_scores?.map(transformCriterionScore),
  };
}

function transformReviewForReviewee(api: PeerReviewForRevieweeApi): PeerReviewForReviewee {
  return {
    id: api.id,
    overallScore: api.overall_score,
    overallFeedback: api.overall_feedback,
    strengths: api.strengths,
    improvements: api.improvements,
    reviewerName: api.reviewer_name,
    criteriaScores: api.criteria_scores.map(transformCriterionScore),
    submittedAt: api.submitted_at,
  };
}

function transformStats(api: ReviewerStatsApi): ReviewerStats {
  return {
    userId: api.user_id,
    reviewsCompleted: api.reviews_completed,
    reviewsPending: api.reviews_pending,
    averageQualityScore: api.average_quality_score,
    totalPointsEarned: api.total_points_earned,
    helpfulnessRatingAvg: api.helpfulness_rating_avg,
  };
}

function transformDashboard(api: UserPeerReviewDashboardApi): UserPeerReviewDashboard {
  return {
    userId: api.user_id,
    pendingReviews: api.pending_reviews.map(transformAssignment),
    completedReviews: api.completed_reviews,
    reviewsReceived: api.reviews_received.map(transformReviewForReviewee),
    totalPointsEarned: api.total_points_earned,
    averageGivenScore: api.average_given_score,
    averageReceivedScore: api.average_received_score,
  };
}

// ============================================================================
// SAMPLE DATA (Fallback when API unavailable)
// ============================================================================

const SAMPLE_PENDING_REVIEWS: PeerReviewAssignment[] = [
  {
    id: "pr-assign-1",
    assignmentId: "assign-1",
    submissionId: "sub-1",
    reviewerId: "demo-user",
    revieweeId: "user-2",
    status: "assigned",
    assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentTitle: "Resume Writing Exercise",
    revieweeName: "Anonymous",
    submissionPreview: "I have extensive experience in customer service and retail management...",
  },
  {
    id: "pr-assign-2",
    assignmentId: "assign-2",
    submissionId: "sub-2",
    reviewerId: "demo-user",
    revieweeId: "user-3",
    status: "in_progress",
    assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    assignmentTitle: "Cover Letter Draft",
    revieweeName: "Anonymous",
    submissionPreview: "Dear Hiring Manager, I am writing to express my interest in the position...",
  },
];

const SAMPLE_RECEIVED_REVIEWS: PeerReviewForReviewee[] = [
  {
    id: "review-1",
    overallScore: 85,
    overallFeedback: "Great work on your resume! Your experience section is well-organized and highlights your key achievements effectively.",
    strengths: "Clear formatting, strong action verbs, quantifiable achievements",
    improvements: "Consider adding more industry-specific keywords and expanding on your technical skills section.",
    reviewerName: "Anonymous",
    criteriaScores: [],
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "review-2",
    overallScore: 72,
    overallFeedback: "Solid foundation but could use some refinement. The content is good but the structure could be improved.",
    strengths: "Good content, relevant experience highlighted",
    improvements: "Work on the flow between sections and add a stronger summary statement at the top.",
    reviewerName: "Anonymous",
    criteriaScores: [],
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const SAMPLE_STATS: ReviewerStats = {
  userId: "demo-user",
  reviewsCompleted: 5,
  reviewsPending: 2,
  averageQualityScore: 82,
  totalPointsEarned: 75,
  helpfulnessRatingAvg: 4.2,
};

const SAMPLE_CONFIG: PeerReviewConfig = {
  id: "config-1",
  assignmentId: "assign-1",
  reviewsRequired: 3,
  reviewsToComplete: 3,
  reviewDeadlineDays: 7,
  allowSelfReview: false,
  isAnonymous: true,
  rubricRequired: false,
  minFeedbackLength: 50,
  pointsForReviewing: 15,
  bonusForQuality: 10,
  weightInGrade: 0.1,
  autoAssign: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function getSampleDashboard(userId: string): UserPeerReviewDashboard {
  return {
    userId,
    pendingReviews: SAMPLE_PENDING_REVIEWS,
    completedReviews: 5,
    reviewsReceived: SAMPLE_RECEIVED_REVIEWS,
    totalPointsEarned: 75,
    averageGivenScore: 78,
    averageReceivedScore: 78.5,
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get user's peer review dashboard
 */
export async function getUserDashboard(userId: string): Promise<UserPeerReviewDashboard> {
  try {
    const response = await fetch(`${PEER_REVIEW_API}/users/${userId}/dashboard`);
    if (!response.ok) {
      console.warn("Peer review API unavailable, using sample data");
      return getSampleDashboard(userId);
    }
    const data: UserPeerReviewDashboardApi = await response.json();
    return transformDashboard(data);
  } catch (error) {
    console.warn("Failed to fetch peer review dashboard, using sample data:", error);
    return getSampleDashboard(userId);
  }
}

/**
 * Get reviewer statistics
 */
export async function getReviewerStats(userId: string): Promise<ReviewerStats> {
  try {
    const response = await fetch(`${PEER_REVIEW_API}/users/${userId}/reviewer-stats`);
    if (!response.ok) {
      console.warn("Reviewer stats API unavailable, using sample data");
      return { ...SAMPLE_STATS, userId };
    }
    const data: ReviewerStatsApi = await response.json();
    return transformStats(data);
  } catch (error) {
    console.warn("Failed to fetch reviewer stats, using sample data:", error);
    return { ...SAMPLE_STATS, userId };
  }
}

/**
 * Get user's pending review assignments
 */
export async function getUserReviewAssignments(
  userId: string,
  assignmentId?: string,
  status?: string
): Promise<PeerReviewAssignment[]> {
  const params = new URLSearchParams();
  if (assignmentId) params.append("assignment_id", assignmentId);
  if (status) params.append("status", status);

  const url = `${PEER_REVIEW_API}/users/${userId}/assignments${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch review assignments");
  }
  const data: PeerReviewAssignmentApi[] = await response.json();
  return data.map(transformAssignment);
}

/**
 * Start a review (marks it as in_progress)
 */
export async function startReview(reviewAssignmentId: string): Promise<PeerReviewAssignment> {
  try {
    const response = await fetch(`${PEER_REVIEW_API}/review-assignments/${reviewAssignmentId}/start`, {
      method: "POST",
    });
    if (!response.ok) {
      // Return a mock in-progress assignment for demo mode
      const assignment = SAMPLE_PENDING_REVIEWS.find(a => a.id === reviewAssignmentId) || SAMPLE_PENDING_REVIEWS[0];
      return { ...assignment, status: "in_progress", startedAt: new Date().toISOString() };
    }
    const data: PeerReviewAssignmentApi = await response.json();
    return transformAssignment(data);
  } catch (error) {
    console.warn("Failed to start review, using mock data:", error);
    const assignment = SAMPLE_PENDING_REVIEWS.find(a => a.id === reviewAssignmentId) || SAMPLE_PENDING_REVIEWS[0];
    return { ...assignment, status: "in_progress", startedAt: new Date().toISOString() };
  }
}

/**
 * Submit a peer review
 */
export async function submitReview(
  review: PeerReviewCreate,
  reviewerId: string
): Promise<PeerReview> {
  const payload = {
    peer_review_assignment_id: review.peerReviewAssignmentId,
    submission_id: review.submissionId,
    overall_score: review.overallScore,
    overall_feedback: review.overallFeedback,
    strengths: review.strengths,
    improvements: review.improvements,
    criteria_scores: review.criteriaScores?.map((c) => ({
      criterion_id: c.criterionId,
      score: c.score,
      feedback: c.feedback,
    })),
  };

  const response = await fetch(`${PEER_REVIEW_API}/reviews?reviewer_id=${reviewerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to submit review");
  }
  const data: PeerReviewApi = await response.json();
  return transformReview(data);
}

/**
 * Get reviews for a submission
 */
export async function getReviewsForSubmission(
  submissionId: string,
  userId: string,
  isReviewee = false
): Promise<PeerReviewForReviewee[]> {
  const params = new URLSearchParams({
    user_id: userId,
    is_reviewee: isReviewee.toString(),
  });

  const response = await fetch(`${PEER_REVIEW_API}/submissions/${submissionId}/reviews?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch reviews");
  }
  const data: PeerReviewForRevieweeApi[] = await response.json();
  return data.map(transformReviewForReviewee);
}

/**
 * Get review summary for a submission
 */
export async function getSubmissionReviewSummary(submissionId: string): Promise<PeerReviewSummary> {
  const response = await fetch(`${PEER_REVIEW_API}/submissions/${submissionId}/summary`);
  if (!response.ok) {
    throw new Error("Failed to fetch review summary");
  }
  const data: PeerReviewSummaryApi = await response.json();
  return {
    submissionId: data.submission_id,
    totalReviews: data.total_reviews,
    reviewsNeeded: data.reviews_needed,
    averageScore: data.average_score,
    minScore: data.min_score,
    maxScore: data.max_score,
    reviews: data.reviews.map(transformReviewForReviewee),
  };
}

/**
 * Rate how helpful a review was
 */
export async function rateReviewHelpfulness(
  reviewId: string,
  revieweeId: string,
  rating: HelpfulnessRating
): Promise<PeerReview> {
  const response = await fetch(
    `${PEER_REVIEW_API}/reviews/${reviewId}/rate-helpfulness?reviewee_id=${revieweeId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_helpful: rating.isHelpful,
        rating: rating.rating,
        comment: rating.comment,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to rate review");
  }
  const data: PeerReviewApi = await response.json();
  return transformReview(data);
}

/**
 * Get reviews given by a user
 */
export async function getReviewsByReviewer(
  userId: string,
  assignmentId?: string
): Promise<PeerReview[]> {
  const params = assignmentId ? `?assignment_id=${assignmentId}` : "";
  const response = await fetch(`${PEER_REVIEW_API}/users/${userId}/given-reviews${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch given reviews");
  }
  const data: PeerReviewApi[] = await response.json();
  return data.map(transformReview);
}

/**
 * Get peer review config for an assignment
 */
export async function getPeerReviewConfig(assignmentId: string): Promise<PeerReviewConfig | null> {
  try {
    const response = await fetch(`${PEER_REVIEW_API}/config/${assignmentId}`);
    if (response.status === 404) {
      // Return sample config for demo mode
      return { ...SAMPLE_CONFIG, assignmentId };
    }
    if (!response.ok) {
      console.warn("Config API unavailable, using sample data");
      return { ...SAMPLE_CONFIG, assignmentId };
    }
    const data: PeerReviewConfigApi = await response.json();
    return transformConfig(data);
  } catch (error) {
    console.warn("Failed to fetch config, using sample data:", error);
    return { ...SAMPLE_CONFIG, assignmentId };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getStatusColor(status: PeerReviewAssignment["status"]): string {
  switch (status) {
    case "assigned":
      return "#3B82F6"; // blue
    case "in_progress":
      return "#F59E0B"; // amber
    case "completed":
      return "#10B981"; // green
    case "expired":
      return "#EF4444"; // red
    default:
      return "#6B7280"; // gray
  }
}

export function getStatusLabel(status: PeerReviewAssignment["status"]): string {
  switch (status) {
    case "assigned":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

export function getTimeRemaining(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();

  if (diff < 0) {
    const daysAgo = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
    return daysAgo === 0 ? "Due today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} overdue`;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} left`;
  }
  return `${hours} hour${hours > 1 ? "s" : ""} left`;
}

export function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function formatScore(score?: number): string {
  if (score === undefined || score === null) return "N/A";
  return `${Math.round(score)}%`;
}
