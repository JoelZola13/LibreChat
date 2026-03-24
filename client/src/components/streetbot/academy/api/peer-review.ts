/**
 * Peer Review API adapter for LibreChat (Vite).
 * Re-exports types and provides sbFetch-based API functions.
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/academy/peer-review';

// =============================================================================
// Types
// =============================================================================

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
  status: 'assigned' | 'in_progress' | 'completed' | 'expired';
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

// =============================================================================
// Transform helpers (snake_case API -> camelCase frontend)
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformCriterionScore(api: any): PeerReviewCriterionScore {
  return { id: api.id, peerReviewId: api.peer_review_id, criterionId: api.criterion_id, score: api.score, feedback: api.feedback, createdAt: api.created_at };
}

function transformAssignment(api: any): PeerReviewAssignment {
  return {
    id: api.id, assignmentId: api.assignment_id, submissionId: api.submission_id,
    reviewerId: api.reviewer_id, revieweeId: api.reviewee_id, status: api.status,
    assignedAt: api.assigned_at, dueDate: api.due_date, startedAt: api.started_at,
    completedAt: api.completed_at, createdAt: api.created_at, updatedAt: api.updated_at,
    assignmentTitle: api.assignment_title, revieweeName: api.reviewee_name,
    submissionPreview: api.submission_preview,
  };
}

function transformReview(api: any): PeerReview {
  return {
    id: api.id, peerReviewAssignmentId: api.peer_review_assignment_id,
    submissionId: api.submission_id, reviewerId: api.reviewer_id,
    revieweeId: api.reviewee_id, overallScore: api.overall_score,
    overallFeedback: api.overall_feedback, strengths: api.strengths,
    improvements: api.improvements, isAnonymous: api.is_anonymous,
    isHelpful: api.is_helpful, helpfulnessRating: api.helpfulness_rating,
    reviewerPointsEarned: api.reviewer_points_earned,
    reviewQualityScore: api.review_quality_score,
    submittedAt: api.submitted_at, createdAt: api.created_at, updatedAt: api.updated_at,
    criteriaScores: api.criteria_scores?.map(transformCriterionScore),
  };
}

function transformReviewForReviewee(api: any): PeerReviewForReviewee {
  return {
    id: api.id, overallScore: api.overall_score, overallFeedback: api.overall_feedback,
    strengths: api.strengths, improvements: api.improvements,
    reviewerName: api.reviewer_name,
    criteriaScores: (api.criteria_scores || []).map(transformCriterionScore),
    submittedAt: api.submitted_at,
  };
}

function transformStats(api: any): ReviewerStats {
  return {
    userId: api.user_id, reviewsCompleted: api.reviews_completed,
    reviewsPending: api.reviews_pending, averageQualityScore: api.average_quality_score,
    totalPointsEarned: api.total_points_earned, helpfulnessRatingAvg: api.helpfulness_rating_avg,
  };
}

function transformDashboard(api: any): UserPeerReviewDashboard {
  return {
    userId: api.user_id,
    pendingReviews: (api.pending_reviews || []).map(transformAssignment),
    completedReviews: api.completed_reviews,
    reviewsReceived: (api.reviews_received || []).map(transformReviewForReviewee),
    totalPointsEarned: api.total_points_earned,
    averageGivenScore: api.average_given_score,
    averageReceivedScore: api.average_received_score,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// =============================================================================
// Sample data (fallback)
// =============================================================================

const SAMPLE_PENDING: PeerReviewAssignment[] = [
  { id: 'pr-assign-1', assignmentId: 'assign-1', submissionId: 'sub-1', reviewerId: 'demo-user', revieweeId: 'user-2', status: 'assigned', assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(), dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), assignmentTitle: 'Resume Writing Exercise', revieweeName: 'Anonymous', submissionPreview: 'I have extensive experience in customer service and retail management...' },
];

const SAMPLE_RECEIVED: PeerReviewForReviewee[] = [
  { id: 'review-1', overallScore: 85, overallFeedback: 'Great work on your resume!', strengths: 'Clear formatting, strong action verbs', improvements: 'Consider adding more industry-specific keywords', reviewerName: 'Anonymous', criteriaScores: [], submittedAt: new Date(Date.now() - 86400000).toISOString() },
];

const SAMPLE_STATS: ReviewerStats = { userId: 'demo-user', reviewsCompleted: 5, reviewsPending: 2, averageQualityScore: 82, totalPointsEarned: 75, helpfulnessRatingAvg: 4.2 };

const SAMPLE_CONFIG: PeerReviewConfig = { id: 'config-1', assignmentId: 'assign-1', reviewsRequired: 3, reviewsToComplete: 3, reviewDeadlineDays: 7, allowSelfReview: false, isAnonymous: true, rubricRequired: false, minFeedbackLength: 50, pointsForReviewing: 15, bonusForQuality: 10, weightInGrade: 0.1, autoAssign: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

function getSampleDashboard(userId: string): UserPeerReviewDashboard {
  return { userId, pendingReviews: SAMPLE_PENDING, completedReviews: 5, reviewsReceived: SAMPLE_RECEIVED, totalPointsEarned: 75, averageGivenScore: 78, averageReceivedScore: 78.5 };
}

// =============================================================================
// API Functions
// =============================================================================

export async function getUserDashboard(userId: string): Promise<UserPeerReviewDashboard> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/dashboard`);
    if (!response.ok) return getSampleDashboard(userId);
    const data = await response.json();
    return transformDashboard(data);
  } catch (error) {
    console.warn('Failed to fetch peer review dashboard:', error);
    return getSampleDashboard(userId);
  }
}

export async function getReviewerStats(userId: string): Promise<ReviewerStats> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/reviewer-stats`);
    if (!response.ok) return { ...SAMPLE_STATS, userId };
    return transformStats(await response.json());
  } catch (error) {
    console.warn('Failed to fetch reviewer stats:', error);
    return { ...SAMPLE_STATS, userId };
  }
}

export async function getUserReviewAssignments(userId: string, assignmentId?: string, status?: string): Promise<PeerReviewAssignment[]> {
  const params = new URLSearchParams();
  if (assignmentId) params.append('assignment_id', assignmentId);
  if (status) params.append('status', status);
  const qs = params.toString();
  const response = await sbFetch(`${BASE}/users/${userId}/assignments${qs ? '?' + qs : ''}`);
  if (!response.ok) throw new Error('Failed to fetch review assignments');
  const data = await response.json();
  return data.map(transformAssignment);
}

export async function startReview(reviewAssignmentId: string): Promise<PeerReviewAssignment> {
  try {
    const response = await sbFetch(`${BASE}/review-assignments/${reviewAssignmentId}/start`, { method: 'POST' });
    if (!response.ok) return { ...SAMPLE_PENDING[0], status: 'in_progress', startedAt: new Date().toISOString() };
    return transformAssignment(await response.json());
  } catch (error) {
    console.warn('Failed to start review:', error);
    return { ...SAMPLE_PENDING[0], status: 'in_progress', startedAt: new Date().toISOString() };
  }
}

export async function submitReview(review: PeerReviewCreate, reviewerId: string): Promise<PeerReview> {
  const payload = {
    peer_review_assignment_id: review.peerReviewAssignmentId,
    submission_id: review.submissionId,
    overall_score: review.overallScore,
    overall_feedback: review.overallFeedback,
    strengths: review.strengths,
    improvements: review.improvements,
    criteria_scores: review.criteriaScores?.map((c) => ({ criterion_id: c.criterionId, score: c.score, feedback: c.feedback })),
  };
  const response = await sbFetch(`${BASE}/reviews?reviewer_id=${reviewerId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to submit review');
  return transformReview(await response.json());
}

export async function getReviewsForSubmission(submissionId: string, userId: string, isReviewee = false): Promise<PeerReviewForReviewee[]> {
  const params = new URLSearchParams({ user_id: userId, is_reviewee: isReviewee.toString() });
  const response = await sbFetch(`${BASE}/submissions/${submissionId}/reviews?${params}`);
  if (!response.ok) throw new Error('Failed to fetch reviews');
  const data = await response.json();
  return data.map(transformReviewForReviewee);
}

export async function getSubmissionReviewSummary(submissionId: string): Promise<PeerReviewSummary> {
  const response = await sbFetch(`${BASE}/submissions/${submissionId}/summary`);
  if (!response.ok) throw new Error('Failed to fetch review summary');
  const data = await response.json();
  return {
    submissionId: data.submission_id, totalReviews: data.total_reviews, reviewsNeeded: data.reviews_needed,
    averageScore: data.average_score, minScore: data.min_score, maxScore: data.max_score,
    reviews: data.reviews.map(transformReviewForReviewee),
  };
}

export async function rateReviewHelpfulness(reviewId: string, revieweeId: string, rating: HelpfulnessRating): Promise<PeerReview> {
  const response = await sbFetch(`${BASE}/reviews/${reviewId}/rate-helpfulness?reviewee_id=${revieweeId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_helpful: rating.isHelpful, rating: rating.rating, comment: rating.comment }),
  });
  if (!response.ok) throw new Error('Failed to rate review');
  return transformReview(await response.json());
}

export async function getReviewsByReviewer(userId: string, assignmentId?: string): Promise<PeerReview[]> {
  const qs = assignmentId ? `?assignment_id=${assignmentId}` : '';
  const response = await sbFetch(`${BASE}/users/${userId}/given-reviews${qs}`);
  if (!response.ok) throw new Error('Failed to fetch given reviews');
  const data = await response.json();
  return data.map(transformReview);
}

export async function getPeerReviewConfig(assignmentId: string): Promise<PeerReviewConfig | null> {
  try {
    const response = await sbFetch(`${BASE}/config/${assignmentId}`);
    if (response.status === 404) return { ...SAMPLE_CONFIG, assignmentId };
    if (!response.ok) return { ...SAMPLE_CONFIG, assignmentId };
    const api = await response.json();
    return {
      id: api.id, assignmentId: api.assignment_id, reviewsRequired: api.reviews_required,
      reviewsToComplete: api.reviews_to_complete, reviewDeadlineDays: api.review_deadline_days,
      allowSelfReview: api.allow_self_review, isAnonymous: api.is_anonymous,
      rubricRequired: api.rubric_required, minFeedbackLength: api.min_feedback_length,
      pointsForReviewing: api.points_for_reviewing, bonusForQuality: api.bonus_for_quality,
      weightInGrade: api.weight_in_grade, autoAssign: api.auto_assign,
      createdAt: api.created_at, updatedAt: api.updated_at,
    };
  } catch {
    return { ...SAMPLE_CONFIG, assignmentId };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getStatusColor(status: PeerReviewAssignment['status']): string {
  const map: Record<string, string> = { assigned: '#3B82F6', in_progress: '#F59E0B', completed: '#10B981', expired: '#EF4444' };
  return map[status] || '#6B7280';
}

export function getStatusLabel(status: PeerReviewAssignment['status']): string {
  const map: Record<string, string> = { assigned: 'Pending', in_progress: 'In Progress', completed: 'Completed', expired: 'Expired' };
  return map[status] || status;
}

export function getTimeRemaining(dueDate: string): string {
  const diff = new Date(dueDate).getTime() - Date.now();
  if (diff < 0) { const d = Math.floor(Math.abs(diff) / 86400000); return d === 0 ? 'Due today' : `${d} day${d > 1 ? 's' : ''} overdue`; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d > 0 ? `${d} day${d > 1 ? 's' : ''} left` : `${h} hour${h > 1 ? 's' : ''} left`;
}

export function isOverdue(dueDate?: string): boolean {
  return dueDate ? new Date(dueDate) < new Date() : false;
}

export function formatScore(score?: number): string {
  if (score === undefined || score === null) return 'N/A';
  return `${Math.round(score)}%`;
}
