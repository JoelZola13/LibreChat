/**
 * Assignments API adapter for LibreChat (Vite).
 */

import { sbFetch } from '../../shared/sbFetch';

const BASE = '/api/academy';

// =============================================================================
// Types
// =============================================================================

export interface FileAttachment {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  moduleId?: string;
  lessonId?: string;
  title: string;
  description?: string;
  instructions?: string;
  assignmentType: 'file_upload' | 'text' | 'document' | 'mixed';
  maxPoints: number;
  passingScore: number;
  dueDate?: string;
  availableFrom?: string;
  availableUntil?: string;
  allowLateSubmissions: boolean;
  latePenaltyPercent: number;
  maxLateDays: number;
  maxAttempts?: number;
  peerReviewEnabled: boolean;
  peerReviewsRequired: number;
  rubricId?: string;
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  maxFiles: number;
  calendarEventId?: string;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
  gradedCount?: number;
  averageScore?: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  userId: string;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'grading' | 'graded' | 'returned' | 'regrade_requested';
  submissionType?: 'file' | 'text' | 'document_link' | 'mixed';
  textContent?: string;
  documentId?: string;
  fileUrls: FileAttachment[];
  wordCount?: number;
  submittedAt?: string;
  isLate: boolean;
  daysLate: number;
  latePenaltyApplied: number;
  gradedAt?: string;
  gradedBy?: string;
  score?: number;
  adjustedScore?: number;
  letterGrade?: string;
  feedback?: string;
  feedbackAttachments: FileAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentAvailability {
  isAvailable: boolean;
  reason?: string;
  availableFrom?: string;
  availableUntil?: string;
  dueDate?: string;
  attemptsRemaining?: number;
  maxAttempts?: number;
  currentAttempt?: number;
}

export interface SubmissionCreate {
  textContent?: string;
  documentId?: string;
  fileUrls?: FileAttachment[];
}

export interface GradingQueueItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  userName: string;
  userEmail?: string;
  attemptNumber: number;
  submittedAt: string;
  isLate: boolean;
  daysLate: number;
  status: 'submitted' | 'grading' | 'regrade_requested';
  dueDate?: string;
  maxPoints: number;
  rubricId?: string;
  gradingLockedBy?: string;
}

export interface RubricLevel {
  id: string;
  criterionId: string;
  levelName: string;
  pointValue: number;
  description?: string;
  orderIndex: number;
}

export interface RubricCriterion {
  id: string;
  rubricId: string;
  criterionName: string;
  description?: string;
  maxPoints: number;
  orderIndex: number;
  levels: RubricLevel[];
}

export interface RubricWithCriteria {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  totalPoints: number;
  isTemplate: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  criteria: RubricCriterion[];
}

export interface CriterionGrade {
  criterionId: string;
  criterionName: string;
  maxPoints: number;
  levelId?: string;
  levelName?: string;
  pointsEarned: number;
  feedback?: string;
}

export interface RubricGradeSummary {
  rubricId: string;
  rubricTitle: string;
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  criterionGrades: CriterionGrade[];
}

export interface GradeSubmissionData {
  score: number;
  feedback?: string;
  feedbackAttachments?: FileAttachment[];
}

export interface CriterionGradeInput {
  criterionId: string;
  levelId?: string;
  pointsEarned: number;
  feedback?: string;
}

// =============================================================================
// Transform helpers
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformFile(api: any): FileAttachment {
  return { url: api.url, filename: api.filename, sizeBytes: api.size_bytes, mimeType: api.mime_type, uploadedAt: api.uploaded_at };
}

function transformAssignment(api: any): Assignment {
  return {
    id: api.id, courseId: api.course_id, moduleId: api.module_id, lessonId: api.lesson_id,
    title: api.title, description: api.description, instructions: api.instructions,
    assignmentType: api.assignment_type, maxPoints: api.max_points, passingScore: api.passing_score,
    dueDate: api.due_date, availableFrom: api.available_from, availableUntil: api.available_until,
    allowLateSubmissions: api.allow_late_submissions, latePenaltyPercent: api.late_penalty_percent,
    maxLateDays: api.max_late_days, maxAttempts: api.max_attempts,
    peerReviewEnabled: api.peer_review_enabled, peerReviewsRequired: api.peer_reviews_required,
    rubricId: api.rubric_id, allowedFileTypes: api.allowed_file_types || [],
    maxFileSizeMb: api.max_file_size_mb, maxFiles: api.max_files,
    calendarEventId: api.calendar_event_id, isPublished: api.is_published,
    createdBy: api.created_by, createdAt: api.created_at, updatedAt: api.updated_at,
    submissionCount: api.submission_count, gradedCount: api.graded_count, averageScore: api.average_score,
  };
}

function transformSubmission(api: any): Submission {
  return {
    id: api.id, assignmentId: api.assignment_id, userId: api.user_id,
    attemptNumber: api.attempt_number, status: api.status,
    submissionType: api.submission_type, textContent: api.text_content,
    documentId: api.document_id, fileUrls: (api.file_urls || []).map(transformFile),
    wordCount: api.word_count, submittedAt: api.submitted_at,
    isLate: api.is_late, daysLate: api.days_late, latePenaltyApplied: api.late_penalty_applied,
    gradedAt: api.graded_at, gradedBy: api.graded_by, score: api.score,
    adjustedScore: api.adjusted_score, letterGrade: api.letter_grade,
    feedback: api.feedback, feedbackAttachments: (api.feedback_attachments || []).map(transformFile),
    createdAt: api.created_at, updatedAt: api.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// =============================================================================
// Mock data
// =============================================================================

function getMockAssignments(courseId: string): Assignment[] {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  return [
    { id: 'assign-1', courseId, title: 'Introduction Reflection Paper', description: 'Write a 500-word reflection.', assignmentType: 'file_upload', maxPoints: 100, passingScore: 70, dueDate: nextWeek.toISOString(), availableFrom: lastWeek.toISOString(), allowLateSubmissions: true, latePenaltyPercent: 10, maxLateDays: 7, maxAttempts: 2, peerReviewEnabled: false, peerReviewsRequired: 0, allowedFileTypes: ['pdf','docx'], maxFileSizeMb: 10, maxFiles: 1, isPublished: true, createdBy: 'instructor-1', createdAt: lastWeek.toISOString(), updatedAt: lastWeek.toISOString(), submissionCount: 12, gradedCount: 8, averageScore: 85 },
    { id: 'assign-2', courseId, title: 'Case Study Analysis', description: 'Analyze the provided case study.', assignmentType: 'text', maxPoints: 50, passingScore: 60, dueDate: new Date(now.getTime() + 14 * 86400000).toISOString(), allowLateSubmissions: true, latePenaltyPercent: 5, maxLateDays: 3, maxAttempts: 1, peerReviewEnabled: true, peerReviewsRequired: 2, allowedFileTypes: [], maxFileSizeMb: 0, maxFiles: 0, isPublished: true, createdBy: 'instructor-1', createdAt: lastWeek.toISOString(), updatedAt: lastWeek.toISOString(), submissionCount: 5, gradedCount: 0 },
  ];
}

function getMockSubmission(assignmentId: string, userId: string): Submission {
  const now = new Date();
  return { id: `sub-${assignmentId}`, assignmentId, userId, attemptNumber: 1, status: 'draft', submissionType: 'text', textContent: '', fileUrls: [], isLate: false, daysLate: 0, latePenaltyApplied: 0, feedbackAttachments: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

// =============================================================================
// API Functions
// =============================================================================

export async function getCourseAssignments(courseId: string, includeUnpublished = false): Promise<Assignment[]> {
  try {
    let url = `${BASE}/courses/${courseId}/assignments`;
    if (includeUnpublished) url += '?include_unpublished=true';
    const response = await sbFetch(url);
    if (!response.ok) return getMockAssignments(courseId);
    const data = await response.json();
    return data.map(transformAssignment);
  } catch (error) {
    console.warn('Assignments API unavailable:', error);
    return getMockAssignments(courseId);
  }
}

export async function getAssignment(assignmentId: string): Promise<Assignment | null> {
  try {
    const response = await sbFetch(`${BASE}/assignments/${assignmentId}`);
    if (!response.ok) return null;
    return transformAssignment(await response.json());
  } catch { return null; }
}

export async function getAssignmentWithStats(assignmentId: string): Promise<Assignment | null> {
  try {
    const response = await sbFetch(`${BASE}/assignments/${assignmentId}/stats`);
    if (!response.ok) return getAssignment(assignmentId);
    return transformAssignment(await response.json());
  } catch { return getAssignment(assignmentId); }
}

export async function checkAssignmentAvailability(assignmentId: string, userId: string): Promise<AssignmentAvailability> {
  try {
    const response = await sbFetch(`${BASE}/assignments/${assignmentId}/availability?user_id=${userId}`);
    if (!response.ok) return { isAvailable: true };
    const data = await response.json();
    return { isAvailable: data.is_available, reason: data.reason, availableFrom: data.available_from, availableUntil: data.available_until, dueDate: data.due_date, attemptsRemaining: data.attempts_remaining, maxAttempts: data.max_attempts, currentAttempt: data.current_attempt };
  } catch { return { isAvailable: true }; }
}

export async function getUserAvailableAssignments(userId: string, courseId: string): Promise<Assignment[]> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/available-assignments?course_id=${courseId}`);
    if (!response.ok) return getMockAssignments(courseId);
    const data = await response.json();
    return data.map(transformAssignment);
  } catch { return getMockAssignments(courseId); }
}

export async function createSubmission(assignmentId: string, userId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/assignments/${assignmentId}/submissions?user_id=${userId}`, { method: 'POST' });
    if (!response.ok) return getMockSubmission(assignmentId, userId);
    return transformSubmission(await response.json());
  } catch { return getMockSubmission(assignmentId, userId); }
}

export async function getMySubmission(assignmentId: string, userId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/assignments/${assignmentId}/my-submission?user_id=${userId}`);
    if (!response.ok) return response.status === 404 ? null : getMockSubmission(assignmentId, userId);
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function updateSubmission(submissionId: string, data: SubmissionCreate): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_content: data.textContent, document_id: data.documentId, file_urls: data.fileUrls?.map(f => ({ url: f.url, filename: f.filename, size_bytes: f.sizeBytes, mime_type: f.mimeType, uploaded_at: f.uploadedAt })) }),
    });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function submitAssignment(submissionId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/submit`, { method: 'POST' });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function requestRegrade(submissionId: string, reason: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/request-regrade`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function getUserAssignmentStats(userId: string, courseId: string): Promise<{ totalAssignments: number; submitted: number; graded: number; averageScore: number; onTime: number; late: number }> {
  try {
    const response = await sbFetch(`${BASE}/users/${userId}/assignment-stats?course_id=${courseId}`);
    if (!response.ok) throw new Error('fail');
    const d = await response.json();
    return { totalAssignments: d.total_assignments || 0, submitted: d.submitted || 0, graded: d.graded || 0, averageScore: d.average_score || 0, onTime: d.on_time || 0, late: d.late || 0 };
  } catch { return { totalAssignments: 3, submitted: 2, graded: 1, averageScore: 85, onTime: 2, late: 0 }; }
}

// Grading
export async function getGradingQueue(instructorId: string, courseId?: string): Promise<GradingQueueItem[]> {
  try {
    const params = new URLSearchParams({ instructor_id: instructorId });
    if (courseId) params.set('course_id', courseId);
    const response = await sbFetch(`${BASE}/grading/queue?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((api: any) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
      submissionId: api.submission_id, assignmentId: api.assignment_id, assignmentTitle: api.assignment_title,
      courseId: api.course_id, courseTitle: api.course_title, userId: api.user_id, userName: api.user_name,
      userEmail: api.user_email, attemptNumber: api.attempt_number, submittedAt: api.submitted_at,
      isLate: api.is_late, daysLate: api.days_late, status: api.status, dueDate: api.due_date,
      maxPoints: api.max_points, rubricId: api.rubric_id, gradingLockedBy: api.grading_locked_by,
    }));
  } catch { return []; }
}

export async function getSubmissionForGrading(submissionId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}`);
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function startGrading(submissionId: string, graderId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/start-grading?grader_id=${graderId}`, { method: 'POST' });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function gradeSubmission(submissionId: string, graderId: string, data: GradeSubmissionData): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/grade?grader_id=${graderId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: data.score, feedback: data.feedback, feedback_attachments: data.feedbackAttachments?.map(f => ({ url: f.url, filename: f.filename, size_bytes: f.sizeBytes, mime_type: f.mimeType, uploaded_at: f.uploadedAt })) }),
    });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

export async function getRubric(rubricId: string): Promise<RubricWithCriteria | null> {
  try {
    const response = await sbFetch(`${BASE}/rubrics/${rubricId}`);
    if (!response.ok) return null;
    const api = await response.json();
    return {
      id: api.id, title: api.title, description: api.description, courseId: api.course_id,
      totalPoints: api.total_points, isTemplate: api.is_template, isActive: api.is_active,
      createdBy: api.created_by, createdAt: api.created_at, updatedAt: api.updated_at,
      criteria: (api.criteria || []).map((c: any) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
        id: c.id, rubricId: c.rubric_id, criterionName: c.criterion_name,
        description: c.description, maxPoints: c.max_points, orderIndex: c.order_index,
        levels: (c.levels || []).map((l: any) => ({  // eslint-disable-line @typescript-eslint/no-explicit-any
          id: l.id, criterionId: l.criterion_id, levelName: l.level_name,
          pointValue: l.point_value, description: l.description, orderIndex: l.order_index,
        })),
      })),
    };
  } catch { return null; }
}

export async function gradeWithRubric(submissionId: string, graderId: string, rubricId: string, criterionGrades: CriterionGradeInput[], overallFeedback?: string): Promise<RubricGradeSummary | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/rubric-grade?grader_id=${graderId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubric_id: rubricId, criterion_grades: criterionGrades.map(g => ({ criterion_id: g.criterionId, level_id: g.levelId, points_earned: g.pointsEarned, feedback: g.feedback })), overall_feedback: overallFeedback }),
    });
    if (!response.ok) return null;
    const d = await response.json();
    return { rubricId: d.rubric_id, rubricTitle: d.rubric_title, totalPoints: d.total_points, earnedPoints: d.earned_points, percentage: d.percentage, criterionGrades: (d.criterion_grades || []).map((g: any) => ({ criterionId: g.criterion_id, criterionName: g.criterion_name, maxPoints: g.max_points, levelId: g.level_id, levelName: g.level_name, pointsEarned: g.points_earned, feedback: g.feedback })) };  // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch { return null; }
}

export async function getSubmissionRubricGrades(submissionId: string, rubricId: string): Promise<RubricGradeSummary | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/rubric-grades?rubric_id=${rubricId}`);
    if (!response.ok) return null;
    const d = await response.json();
    return { rubricId: d.rubric_id, rubricTitle: d.rubric_title, totalPoints: d.total_points, earnedPoints: d.earned_points, percentage: d.percentage, criterionGrades: (d.criterion_grades || []).map((g: any) => ({ criterionId: g.criterion_id, criterionName: g.criterion_name, maxPoints: g.max_points, levelId: g.level_id, levelName: g.level_name, pointsEarned: g.points_earned, feedback: g.feedback })) };  // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch { return null; }
}

export async function returnSubmission(submissionId: string): Promise<Submission | null> {
  try {
    const response = await sbFetch(`${BASE}/submissions/${submissionId}/return`, { method: 'POST' });
    if (!response.ok) return null;
    return transformSubmission(await response.json());
  } catch { return null; }
}

// File upload (simplified - no Supabase in Vite)
export async function uploadSubmissionFile(file: File, _assignmentId: string, _userId: string): Promise<FileAttachment | null> {
  return { url: URL.createObjectURL(file), filename: file.name, sizeBytes: file.size, mimeType: file.type, uploadedAt: new Date().toISOString() };
}

export async function uploadSubmissionFiles(files: File[], assignmentId: string, userId: string): Promise<FileAttachment[]> {
  const results = await Promise.all(files.map(f => uploadSubmissionFile(f, assignmentId, userId)));
  return results.filter((f): f is FileAttachment => f !== null);
}

// =============================================================================
// Utility Functions
// =============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getStatusColor(status: Submission['status']): string {
  const colors: Record<string, string> = { draft: '#6B7280', submitted: '#3B82F6', grading: '#F59E0B', graded: '#10B981', returned: '#8B5CF6', regrade_requested: '#EF4444' };
  return colors[status] || '#6B7280';
}

export function getStatusLabel(status: Submission['status']): string {
  const labels: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', grading: 'Being Graded', graded: 'Graded', returned: 'Returned', regrade_requested: 'Regrade Requested' };
  return labels[status] || status;
}

export function isPastDue(dueDate?: string): boolean {
  return dueDate ? new Date(dueDate) < new Date() : false;
}

export function getTimeRemaining(dueDate?: string): string {
  if (!dueDate) return 'No due date';
  const diff = new Date(dueDate).getTime() - Date.now();
  if (diff < 0) { const d = Math.ceil(Math.abs(diff) / 86400000); return `${d} day${d === 1 ? '' : 's'} overdue`; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d} day${d === 1 ? '' : 's'} remaining`;
  if (h > 0) return `${h} hour${h === 1 ? '' : 's'} remaining`;
  return 'Due soon';
}

export function calculateLetterGrade(percentage: number): string {
  if (percentage >= 97) return 'A+'; if (percentage >= 93) return 'A'; if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+'; if (percentage >= 83) return 'B'; if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+'; if (percentage >= 73) return 'C'; if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+'; if (percentage >= 63) return 'D'; if (percentage >= 60) return 'D-';
  return 'F';
}

export function formatSubmittedTime(submittedAt: string): string {
  const diff = Date.now() - new Date(submittedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(submittedAt).toLocaleDateString();
}
