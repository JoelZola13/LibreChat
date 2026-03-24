/**
 * Assignments API service - connects frontend to backend assignment management
 */

import { getSupabaseAsync, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE = '/sbapi';
const ACADEMY_API = `${API_BASE}/academy`;

// ============================================================================
// TYPES - API Response (snake_case from backend)
// ============================================================================

interface FileAttachmentApi {
  url: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  uploaded_at: string;
}

interface AssignmentApiResponse {
  id: string;
  course_id: string;
  module_id?: string;
  lesson_id?: string;
  title: string;
  description?: string;
  instructions?: string;
  assignment_type: "file_upload" | "text" | "document" | "mixed";
  max_points: number;
  passing_score: number;
  due_date?: string;
  available_from?: string;
  available_until?: string;
  allow_late_submissions: boolean;
  late_penalty_percent: number;
  max_late_days: number;
  max_attempts?: number;
  peer_review_enabled: boolean;
  peer_reviews_required: number;
  rubric_id?: string;
  allowed_file_types: string[];
  max_file_size_mb: number;
  max_files: number;
  calendar_event_id?: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Stats (optional)
  submission_count?: number;
  graded_count?: number;
  average_score?: number;
}

interface SubmissionApiResponse {
  id: string;
  assignment_id: string;
  user_id: string;
  attempt_number: number;
  status: "draft" | "submitted" | "grading" | "graded" | "returned" | "regrade_requested";
  submission_type?: "file" | "text" | "document_link" | "mixed";
  text_content?: string;
  document_id?: string;
  file_urls: FileAttachmentApi[];
  word_count?: number;
  submitted_at?: string;
  is_late: boolean;
  days_late: number;
  late_penalty_applied: number;
  graded_at?: string;
  graded_by?: string;
  score?: number;
  adjusted_score?: number;
  letter_grade?: string;
  feedback?: string;
  feedback_attachments: FileAttachmentApi[];
  created_at: string;
  updated_at: string;
}

interface AvailabilityApiResponse {
  is_available: boolean;
  reason?: string;
  available_from?: string;
  available_until?: string;
  due_date?: string;
  attempts_remaining?: number;
  max_attempts?: number;
  current_attempt?: number;
}

// ============================================================================
// TYPES - Frontend (camelCase for React)
// ============================================================================

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
  assignmentType: "file_upload" | "text" | "document" | "mixed";
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
  // Stats
  submissionCount?: number;
  gradedCount?: number;
  averageScore?: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  userId: string;
  attemptNumber: number;
  status: "draft" | "submitted" | "grading" | "graded" | "returned" | "regrade_requested";
  submissionType?: "file" | "text" | "document_link" | "mixed";
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

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

function transformFileAttachment(api: FileAttachmentApi): FileAttachment {
  return {
    url: api.url,
    filename: api.filename,
    sizeBytes: api.size_bytes,
    mimeType: api.mime_type,
    uploadedAt: api.uploaded_at,
  };
}

function transformAssignment(api: AssignmentApiResponse): Assignment {
  return {
    id: api.id,
    courseId: api.course_id,
    moduleId: api.module_id,
    lessonId: api.lesson_id,
    title: api.title,
    description: api.description,
    instructions: api.instructions,
    assignmentType: api.assignment_type,
    maxPoints: api.max_points,
    passingScore: api.passing_score,
    dueDate: api.due_date,
    availableFrom: api.available_from,
    availableUntil: api.available_until,
    allowLateSubmissions: api.allow_late_submissions,
    latePenaltyPercent: api.late_penalty_percent,
    maxLateDays: api.max_late_days,
    maxAttempts: api.max_attempts,
    peerReviewEnabled: api.peer_review_enabled,
    peerReviewsRequired: api.peer_reviews_required,
    rubricId: api.rubric_id,
    allowedFileTypes: api.allowed_file_types,
    maxFileSizeMb: api.max_file_size_mb,
    maxFiles: api.max_files,
    calendarEventId: api.calendar_event_id,
    isPublished: api.is_published,
    createdBy: api.created_by,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    submissionCount: api.submission_count,
    gradedCount: api.graded_count,
    averageScore: api.average_score,
  };
}

function transformSubmission(api: SubmissionApiResponse): Submission {
  return {
    id: api.id,
    assignmentId: api.assignment_id,
    userId: api.user_id,
    attemptNumber: api.attempt_number,
    status: api.status,
    submissionType: api.submission_type,
    textContent: api.text_content,
    documentId: api.document_id,
    fileUrls: (api.file_urls || []).map(transformFileAttachment),
    wordCount: api.word_count,
    submittedAt: api.submitted_at,
    isLate: api.is_late,
    daysLate: api.days_late,
    latePenaltyApplied: api.late_penalty_applied,
    gradedAt: api.graded_at,
    gradedBy: api.graded_by,
    score: api.score,
    adjustedScore: api.adjusted_score,
    letterGrade: api.letter_grade,
    feedback: api.feedback,
    feedbackAttachments: (api.feedback_attachments || []).map(transformFileAttachment),
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformAvailability(api: AvailabilityApiResponse): AssignmentAvailability {
  return {
    isAvailable: api.is_available,
    reason: api.reason,
    availableFrom: api.available_from,
    availableUntil: api.available_until,
    dueDate: api.due_date,
    attemptsRemaining: api.attempts_remaining,
    maxAttempts: api.max_attempts,
    currentAttempt: api.current_attempt,
  };
}

// ============================================================================
// MOCK DATA (for development when API is unavailable)
// ============================================================================

function getMockAssignments(courseId: string): Assignment[] {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return [
    {
      id: "assign-1",
      courseId,
      title: "Introduction Reflection Paper",
      description: "Write a 500-word reflection on the course introduction materials.",
      instructions: "## Instructions\n\n1. Read all introduction materials\n2. Reflect on key themes\n3. Write 500 words minimum\n4. Submit as PDF or DOCX",
      assignmentType: "file_upload",
      maxPoints: 100,
      passingScore: 70,
      dueDate: nextWeek.toISOString(),
      availableFrom: lastWeek.toISOString(),
      allowLateSubmissions: true,
      latePenaltyPercent: 10,
      maxLateDays: 7,
      maxAttempts: 2,
      peerReviewEnabled: false,
      peerReviewsRequired: 0,
      allowedFileTypes: ["pdf", "docx", "doc"],
      maxFileSizeMb: 10,
      maxFiles: 1,
      isPublished: true,
      createdBy: "instructor-1",
      createdAt: lastWeek.toISOString(),
      updatedAt: lastWeek.toISOString(),
      submissionCount: 12,
      gradedCount: 8,
      averageScore: 85,
    },
    {
      id: "assign-2",
      courseId,
      title: "Case Study Analysis",
      description: "Analyze the provided case study and answer the discussion questions.",
      instructions: "Read the case study attached below and answer all 5 discussion questions in essay format.",
      assignmentType: "text",
      maxPoints: 50,
      passingScore: 60,
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      allowLateSubmissions: true,
      latePenaltyPercent: 5,
      maxLateDays: 3,
      maxAttempts: 1,
      peerReviewEnabled: true,
      peerReviewsRequired: 2,
      allowedFileTypes: [],
      maxFileSizeMb: 0,
      maxFiles: 0,
      isPublished: true,
      createdBy: "instructor-1",
      createdAt: lastWeek.toISOString(),
      updatedAt: lastWeek.toISOString(),
      submissionCount: 5,
      gradedCount: 0,
      averageScore: undefined,
    },
    {
      id: "assign-3",
      courseId,
      title: "Final Project Proposal",
      description: "Submit your final project proposal for approval.",
      instructions: "Include project title, objectives, methodology, and expected outcomes.",
      assignmentType: "mixed",
      maxPoints: 25,
      passingScore: 80,
      dueDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      availableFrom: now.toISOString(),
      allowLateSubmissions: false,
      latePenaltyPercent: 0,
      maxLateDays: 0,
      maxAttempts: 3,
      peerReviewEnabled: false,
      peerReviewsRequired: 0,
      allowedFileTypes: ["pdf", "docx", "pptx"],
      maxFileSizeMb: 25,
      maxFiles: 3,
      isPublished: true,
      createdBy: "instructor-1",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      submissionCount: 0,
      gradedCount: 0,
    },
  ];
}

function getMockSubmission(assignmentId: string, userId: string): Submission {
  const now = new Date();
  return {
    id: `sub-${assignmentId}`,
    assignmentId,
    userId,
    attemptNumber: 1,
    status: "draft",
    submissionType: "text",
    textContent: "",
    fileUrls: [],
    isLate: false,
    daysLate: 0,
    latePenaltyApplied: 0,
    feedbackAttachments: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function getMockGradedSubmission(assignmentId: string, userId: string): Submission {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    id: `sub-graded-${assignmentId}`,
    assignmentId,
    userId,
    attemptNumber: 1,
    status: "graded",
    submissionType: "file",
    textContent: "My reflection on the course introduction...",
    fileUrls: [
      {
        url: "/uploads/reflection-paper.pdf",
        filename: "reflection-paper.pdf",
        sizeBytes: 245000,
        mimeType: "application/pdf",
        uploadedAt: lastWeek.toISOString(),
      },
    ],
    submittedAt: lastWeek.toISOString(),
    isLate: false,
    daysLate: 0,
    latePenaltyApplied: 0,
    gradedAt: new Date(lastWeek.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    gradedBy: "instructor-1",
    score: 88,
    adjustedScore: 88,
    letterGrade: "B+",
    feedback: "Excellent reflection! You demonstrated a strong understanding of the key concepts. Consider adding more specific examples in future assignments.",
    feedbackAttachments: [],
    createdAt: lastWeek.toISOString(),
    updatedAt: lastWeek.toISOString(),
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all assignments for a course
 */
export async function getCourseAssignments(
  courseId: string,
  includeUnpublished = false
): Promise<Assignment[]> {
  try {
    const url = new URL(`${ACADEMY_API}/courses/${courseId}/assignments`);
    if (includeUnpublished) {
      url.searchParams.set("include_unpublished", "true");
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn("Assignments API returned error, using mock data");
      return getMockAssignments(courseId);
    }

    const data: AssignmentApiResponse[] = await response.json();
    return data.map(transformAssignment);
  } catch (error) {
    console.warn("Assignments API unavailable, using mock data:", error);
    return getMockAssignments(courseId);
  }
}

/**
 * Get a single assignment by ID
 */
export async function getAssignment(assignmentId: string): Promise<Assignment | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/assignments/${assignmentId}`);
    if (!response.ok) {
      console.warn("Assignment not found or API error");
      return null;
    }

    const data: AssignmentApiResponse = await response.json();
    return transformAssignment(data);
  } catch (error) {
    console.warn("Assignment API unavailable:", error);
    return null;
  }
}

/**
 * Get assignment with statistics (for instructors)
 */
export async function getAssignmentWithStats(assignmentId: string): Promise<Assignment | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/assignments/${assignmentId}/stats`);
    if (!response.ok) {
      return getAssignment(assignmentId);
    }

    const data: AssignmentApiResponse = await response.json();
    return transformAssignment(data);
  } catch (error) {
    console.warn("Assignment stats API unavailable:", error);
    return getAssignment(assignmentId);
  }
}

/**
 * Check if assignment is available for a user
 */
export async function checkAssignmentAvailability(
  assignmentId: string,
  userId: string
): Promise<AssignmentAvailability> {
  try {
    const url = new URL(`${ACADEMY_API}/assignments/${assignmentId}/availability`);
    url.searchParams.set("user_id", userId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return { isAvailable: true };
    }

    const data: AvailabilityApiResponse = await response.json();
    return transformAvailability(data);
  } catch (error) {
    console.warn("Availability API unavailable:", error);
    return { isAvailable: true };
  }
}

/**
 * Get user's available assignments for a course
 */
export async function getUserAvailableAssignments(
  userId: string,
  courseId: string
): Promise<Assignment[]> {
  try {
    const url = new URL(`${ACADEMY_API}/users/${userId}/available-assignments`);
    url.searchParams.set("course_id", courseId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return getMockAssignments(courseId);
    }

    const data: AssignmentApiResponse[] = await response.json();
    return data.map(transformAssignment);
  } catch (error) {
    console.warn("Available assignments API unavailable:", error);
    return getMockAssignments(courseId);
  }
}

/**
 * Create or get a draft submission for an assignment
 */
export async function createSubmission(
  assignmentId: string,
  userId: string
): Promise<Submission | null> {
  try {
    const url = new URL(`${ACADEMY_API}/assignments/${assignmentId}/submissions`);
    url.searchParams.set("user_id", userId);

    const response = await fetch(url.toString(), { method: "POST" });
    if (!response.ok) {
      console.warn("Create submission failed, using mock");
      return getMockSubmission(assignmentId, userId);
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Create submission API unavailable:", error);
    return getMockSubmission(assignmentId, userId);
  }
}

/**
 * Get user's submission for an assignment
 */
export async function getMySubmission(
  assignmentId: string,
  userId: string
): Promise<Submission | null> {
  try {
    const url = new URL(`${ACADEMY_API}/assignments/${assignmentId}/my-submission`);
    url.searchParams.set("user_id", userId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No submission yet
      }
      return getMockSubmission(assignmentId, userId);
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Get submission API unavailable:", error);
    return null;
  }
}

/**
 * Update a draft submission
 */
export async function updateSubmission(
  submissionId: string,
  data: SubmissionCreate
): Promise<Submission | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text_content: data.textContent,
        document_id: data.documentId,
        file_urls: data.fileUrls?.map((f) => ({
          url: f.url,
          filename: f.filename,
          size_bytes: f.sizeBytes,
          mime_type: f.mimeType,
          uploaded_at: f.uploadedAt,
        })),
      }),
    });

    if (!response.ok) {
      console.warn("Update submission failed");
      return null;
    }

    const result: SubmissionApiResponse = await response.json();
    return transformSubmission(result);
  } catch (error) {
    console.warn("Update submission API unavailable:", error);
    return null;
  }
}

/**
 * Submit an assignment (change from draft to submitted)
 */
export async function submitAssignment(submissionId: string): Promise<Submission | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/submissions/${submissionId}/submit`, {
      method: "POST",
    });

    if (!response.ok) {
      console.warn("Submit assignment failed");
      return null;
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Submit assignment API unavailable:", error);
    return null;
  }
}

/**
 * Request a regrade for a submission
 */
export async function requestRegrade(
  submissionId: string,
  reason: string
): Promise<Submission | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/submissions/${submissionId}/request-regrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      console.warn("Request regrade failed");
      return null;
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Request regrade API unavailable:", error);
    return null;
  }
}

/**
 * Get user's assignment statistics for a course
 */
export async function getUserAssignmentStats(
  userId: string,
  courseId: string
): Promise<{
  totalAssignments: number;
  submitted: number;
  graded: number;
  averageScore: number;
  onTime: number;
  late: number;
}> {
  try {
    const url = new URL(`${ACADEMY_API}/users/${userId}/assignment-stats`);
    url.searchParams.set("course_id", courseId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error("Stats API error");
    }

    const data = await response.json();
    return {
      totalAssignments: data.total_assignments || 0,
      submitted: data.submitted || 0,
      graded: data.graded || 0,
      averageScore: data.average_score || 0,
      onTime: data.on_time || 0,
      late: data.late || 0,
    };
  } catch (error) {
    console.warn("Assignment stats API unavailable:", error);
    return {
      totalAssignments: 3,
      submitted: 2,
      graded: 1,
      averageScore: 85,
      onTime: 2,
      late: 0,
    };
  }
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Upload a file to Supabase Storage for assignment submissions.
 * Returns a FileAttachment object with the public URL.
 */
export async function uploadSubmissionFile(
  file: File,
  assignmentId: string,
  userId: string
): Promise<FileAttachment | null> {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured, using local object URL");
    // Fallback to local URL for development
    return {
      url: URL.createObjectURL(file),
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  try {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
      console.warn("Supabase client unavailable, using local object URL");
      return {
        url: URL.createObjectURL(file),
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      };
    }

    // Create unique path: submissions/{assignmentId}/{userId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `submissions/${assignmentId}/${userId}/${timestamp}_${safeName}`;

    // Upload to storage
    const { data, error } = await (supabase as any).storage
      .from("assignment-submissions")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Upload failed:", error.message);
      // If bucket doesn't exist or other error, fallback to local URL
      return {
        url: URL.createObjectURL(file),
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      };
    }

    // Get public URL
    const { data: urlData } = (supabase as any).storage
      .from("assignment-submissions")
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Upload error:", err);
    // Fallback to local URL
    return {
      url: URL.createObjectURL(file),
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }
}

/**
 * Upload multiple files for a submission
 */
export async function uploadSubmissionFiles(
  files: File[],
  assignmentId: string,
  userId: string
): Promise<FileAttachment[]> {
  const results = await Promise.all(
    files.map(file => uploadSubmissionFile(file, assignmentId, userId))
  );
  return results.filter((f): f is FileAttachment => f !== null);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get status color for submission status
 */
export function getStatusColor(status: Submission["status"]): string {
  const colors: Record<Submission["status"], string> = {
    draft: "#6B7280",       // gray
    submitted: "#3B82F6",   // blue
    grading: "#F59E0B",     // amber
    graded: "#10B981",      // green
    returned: "#8B5CF6",    // purple
    regrade_requested: "#EF4444", // red
  };
  return colors[status] || "#6B7280";
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: Submission["status"]): string {
  const labels: Record<Submission["status"], string> = {
    draft: "Draft",
    submitted: "Submitted",
    grading: "Being Graded",
    graded: "Graded",
    returned: "Returned",
    regrade_requested: "Regrade Requested",
  };
  return labels[status] || status;
}

/**
 * Check if assignment is past due
 */
export function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/**
 * Get time remaining until due date
 */
export function getTimeRemaining(dueDate?: string): string {
  if (!dueDate) return "No due date";

  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();

  if (diff < 0) {
    const days = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} remaining`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"} remaining`;
  }
  return "Due soon";
}

// ============================================================================
// GRADING TYPES - API Response (snake_case from backend)
// ============================================================================

interface GradingQueueItemApi {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  attempt_number: number;
  submitted_at: string;
  is_late: boolean;
  days_late: number;
  status: "submitted" | "grading" | "regrade_requested";
  due_date?: string;
  max_points: number;
  rubric_id?: string;
  grading_locked_by?: string;
}

interface RubricLevelApi {
  id: string;
  criterion_id: string;
  level_name: string;
  point_value: number;
  description?: string;
  order_index: number;
}

interface RubricCriterionApi {
  id: string;
  rubric_id: string;
  criterion_name: string;
  description?: string;
  max_points: number;
  order_index: number;
  levels: RubricLevelApi[];
}

interface RubricWithCriteriaApi {
  id: string;
  title: string;
  description?: string;
  course_id?: string;
  total_points: number;
  is_template: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  criteria: RubricCriterionApi[];
}

interface CriterionGradeApi {
  criterion_id: string;
  criterion_name: string;
  max_points: number;
  level_id?: string;
  level_name?: string;
  points_earned: number;
  feedback?: string;
}

interface RubricGradeSummaryApi {
  rubric_id: string;
  rubric_title: string;
  total_points: number;
  earned_points: number;
  percentage: number;
  criterion_grades: CriterionGradeApi[];
}

// ============================================================================
// GRADING TYPES - Frontend (camelCase for React)
// ============================================================================

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
  status: "submitted" | "grading" | "regrade_requested";
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

// ============================================================================
// GRADING TRANSFORM FUNCTIONS
// ============================================================================

function transformGradingQueueItem(api: GradingQueueItemApi): GradingQueueItem {
  return {
    submissionId: api.submission_id,
    assignmentId: api.assignment_id,
    assignmentTitle: api.assignment_title,
    courseId: api.course_id,
    courseTitle: api.course_title,
    userId: api.user_id,
    userName: api.user_name,
    userEmail: api.user_email,
    attemptNumber: api.attempt_number,
    submittedAt: api.submitted_at,
    isLate: api.is_late,
    daysLate: api.days_late,
    status: api.status,
    dueDate: api.due_date,
    maxPoints: api.max_points,
    rubricId: api.rubric_id,
    gradingLockedBy: api.grading_locked_by,
  };
}

function transformRubricLevel(api: RubricLevelApi): RubricLevel {
  return {
    id: api.id,
    criterionId: api.criterion_id,
    levelName: api.level_name,
    pointValue: api.point_value,
    description: api.description,
    orderIndex: api.order_index,
  };
}

function transformRubricCriterion(api: RubricCriterionApi): RubricCriterion {
  return {
    id: api.id,
    rubricId: api.rubric_id,
    criterionName: api.criterion_name,
    description: api.description,
    maxPoints: api.max_points,
    orderIndex: api.order_index,
    levels: api.levels.map(transformRubricLevel),
  };
}

function transformRubricWithCriteria(api: RubricWithCriteriaApi): RubricWithCriteria {
  return {
    id: api.id,
    title: api.title,
    description: api.description,
    courseId: api.course_id,
    totalPoints: api.total_points,
    isTemplate: api.is_template,
    isActive: api.is_active,
    createdBy: api.created_by,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    criteria: api.criteria.map(transformRubricCriterion),
  };
}

function transformCriterionGrade(api: CriterionGradeApi): CriterionGrade {
  return {
    criterionId: api.criterion_id,
    criterionName: api.criterion_name,
    maxPoints: api.max_points,
    levelId: api.level_id,
    levelName: api.level_name,
    pointsEarned: api.points_earned,
    feedback: api.feedback,
  };
}

function transformRubricGradeSummary(api: RubricGradeSummaryApi): RubricGradeSummary {
  return {
    rubricId: api.rubric_id,
    rubricTitle: api.rubric_title,
    totalPoints: api.total_points,
    earnedPoints: api.earned_points,
    percentage: api.percentage,
    criterionGrades: api.criterion_grades.map(transformCriterionGrade),
  };
}

// ============================================================================
// GRADING MOCK DATA
// ============================================================================

function getMockGradingQueue(): GradingQueueItem[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  return [
    {
      submissionId: "sub-1",
      assignmentId: "assign-1",
      assignmentTitle: "Introduction Reflection Paper",
      courseId: "course-1",
      courseTitle: "Housing Rights 101",
      userId: "user-1",
      userName: "John Doe",
      userEmail: "john.doe@example.com",
      attemptNumber: 1,
      submittedAt: yesterday.toISOString(),
      isLate: false,
      daysLate: 0,
      status: "submitted",
      dueDate: now.toISOString(),
      maxPoints: 100,
      rubricId: "rubric-1",
    },
    {
      submissionId: "sub-2",
      assignmentId: "assign-1",
      assignmentTitle: "Introduction Reflection Paper",
      courseId: "course-1",
      courseTitle: "Housing Rights 101",
      userId: "user-2",
      userName: "Jane Smith",
      userEmail: "jane.smith@example.com",
      attemptNumber: 1,
      submittedAt: twoDaysAgo.toISOString(),
      isLate: true,
      daysLate: 2,
      status: "submitted",
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      maxPoints: 100,
      rubricId: "rubric-1",
    },
    {
      submissionId: "sub-3",
      assignmentId: "assign-2",
      assignmentTitle: "Case Study Analysis",
      courseId: "course-1",
      courseTitle: "Housing Rights 101",
      userId: "user-3",
      userName: "Mike Johnson",
      attemptNumber: 1,
      submittedAt: yesterday.toISOString(),
      isLate: false,
      daysLate: 0,
      status: "regrade_requested",
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxPoints: 50,
    },
  ];
}

function getMockRubric(): RubricWithCriteria {
  return {
    id: "rubric-1",
    title: "Essay Grading Rubric",
    description: "Standard rubric for essay assignments",
    courseId: "course-1",
    totalPoints: 100,
    isTemplate: false,
    isActive: true,
    createdBy: "instructor-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    criteria: [
      {
        id: "crit-1",
        rubricId: "rubric-1",
        criterionName: "Thesis & Argument",
        description: "Clear thesis statement with well-developed argument",
        maxPoints: 25,
        orderIndex: 0,
        levels: [
          { id: "lv-1a", criterionId: "crit-1", levelName: "Excellent", pointValue: 25, description: "Clear, compelling thesis with sophisticated argumentation", orderIndex: 0 },
          { id: "lv-1b", criterionId: "crit-1", levelName: "Good", pointValue: 20, description: "Clear thesis with solid argumentation", orderIndex: 1 },
          { id: "lv-1c", criterionId: "crit-1", levelName: "Satisfactory", pointValue: 15, description: "Thesis present but could be clearer", orderIndex: 2 },
          { id: "lv-1d", criterionId: "crit-1", levelName: "Needs Work", pointValue: 10, description: "Weak or unclear thesis", orderIndex: 3 },
          { id: "lv-1e", criterionId: "crit-1", levelName: "Inadequate", pointValue: 0, description: "No discernible thesis", orderIndex: 4 },
        ],
      },
      {
        id: "crit-2",
        rubricId: "rubric-1",
        criterionName: "Evidence & Analysis",
        description: "Use of evidence to support claims with critical analysis",
        maxPoints: 25,
        orderIndex: 1,
        levels: [
          { id: "lv-2a", criterionId: "crit-2", levelName: "Excellent", pointValue: 25, description: "Strong, relevant evidence with insightful analysis", orderIndex: 0 },
          { id: "lv-2b", criterionId: "crit-2", levelName: "Good", pointValue: 20, description: "Good evidence with solid analysis", orderIndex: 1 },
          { id: "lv-2c", criterionId: "crit-2", levelName: "Satisfactory", pointValue: 15, description: "Some evidence with basic analysis", orderIndex: 2 },
          { id: "lv-2d", criterionId: "crit-2", levelName: "Needs Work", pointValue: 10, description: "Weak evidence or minimal analysis", orderIndex: 3 },
          { id: "lv-2e", criterionId: "crit-2", levelName: "Inadequate", pointValue: 0, description: "No evidence or analysis", orderIndex: 4 },
        ],
      },
      {
        id: "crit-3",
        rubricId: "rubric-1",
        criterionName: "Organization",
        description: "Logical structure and flow of ideas",
        maxPoints: 25,
        orderIndex: 2,
        levels: [
          { id: "lv-3a", criterionId: "crit-3", levelName: "Excellent", pointValue: 25, description: "Seamless organization with smooth transitions", orderIndex: 0 },
          { id: "lv-3b", criterionId: "crit-3", levelName: "Good", pointValue: 20, description: "Clear organization with good transitions", orderIndex: 1 },
          { id: "lv-3c", criterionId: "crit-3", levelName: "Satisfactory", pointValue: 15, description: "Basic organization, some awkward transitions", orderIndex: 2 },
          { id: "lv-3d", criterionId: "crit-3", levelName: "Needs Work", pointValue: 10, description: "Disorganized or confusing structure", orderIndex: 3 },
          { id: "lv-3e", criterionId: "crit-3", levelName: "Inadequate", pointValue: 0, description: "No clear organization", orderIndex: 4 },
        ],
      },
      {
        id: "crit-4",
        rubricId: "rubric-1",
        criterionName: "Writing Quality",
        description: "Grammar, spelling, and clarity of expression",
        maxPoints: 25,
        orderIndex: 3,
        levels: [
          { id: "lv-4a", criterionId: "crit-4", levelName: "Excellent", pointValue: 25, description: "Virtually error-free with sophisticated style", orderIndex: 0 },
          { id: "lv-4b", criterionId: "crit-4", levelName: "Good", pointValue: 20, description: "Minor errors, clear writing style", orderIndex: 1 },
          { id: "lv-4c", criterionId: "crit-4", levelName: "Satisfactory", pointValue: 15, description: "Some errors but generally readable", orderIndex: 2 },
          { id: "lv-4d", criterionId: "crit-4", levelName: "Needs Work", pointValue: 10, description: "Frequent errors that affect clarity", orderIndex: 3 },
          { id: "lv-4e", criterionId: "crit-4", levelName: "Inadequate", pointValue: 0, description: "Pervasive errors making text unreadable", orderIndex: 4 },
        ],
      },
    ],
  };
}

// ============================================================================
// GRADING API FUNCTIONS
// ============================================================================

/**
 * Get grading queue - list of submissions awaiting grading
 */
export async function getGradingQueue(
  instructorId: string,
  courseId?: string
): Promise<GradingQueueItem[]> {
  try {
    const url = new URL(`${ACADEMY_API}/grading/queue`);
    url.searchParams.set("instructor_id", instructorId);
    if (courseId) {
      url.searchParams.set("course_id", courseId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn("Grading queue API returned error, using mock data");
      return getMockGradingQueue();
    }

    const data: GradingQueueItemApi[] = await response.json();
    return data.map(transformGradingQueueItem);
  } catch (error) {
    console.warn("Grading queue API unavailable, using mock data:", error);
    return getMockGradingQueue();
  }
}

/**
 * Get a specific submission for grading (with full details)
 */
export async function getSubmissionForGrading(
  submissionId: string
): Promise<Submission | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/submissions/${submissionId}`);
    if (!response.ok) {
      console.warn("Get submission failed");
      return null;
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Get submission API unavailable:", error);
    return null;
  }
}

/**
 * Start grading a submission (locks it for the grader)
 */
export async function startGrading(
  submissionId: string,
  graderId: string
): Promise<Submission | null> {
  try {
    const url = new URL(`${ACADEMY_API}/submissions/${submissionId}/start-grading`);
    url.searchParams.set("grader_id", graderId);

    const response = await fetch(url.toString(), { method: "POST" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn("Start grading failed:", error);
      return null;
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Start grading API unavailable:", error);
    return null;
  }
}

/**
 * Grade a submission with score and feedback
 */
export async function gradeSubmission(
  submissionId: string,
  graderId: string,
  data: GradeSubmissionData
): Promise<Submission | null> {
  try {
    const url = new URL(`${ACADEMY_API}/submissions/${submissionId}/grade`);
    url.searchParams.set("grader_id", graderId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: data.score,
        feedback: data.feedback,
        feedback_attachments: data.feedbackAttachments?.map((f) => ({
          url: f.url,
          filename: f.filename,
          size_bytes: f.sizeBytes,
          mime_type: f.mimeType,
          uploaded_at: f.uploadedAt,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn("Grade submission failed:", error);
      return null;
    }

    const result: SubmissionApiResponse = await response.json();
    return transformSubmission(result);
  } catch (error) {
    console.warn("Grade submission API unavailable:", error);
    return null;
  }
}

/**
 * Get a rubric with all criteria and levels
 */
export async function getRubric(rubricId: string): Promise<RubricWithCriteria | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/rubrics/${rubricId}`);
    if (!response.ok) {
      console.warn("Get rubric failed, using mock data");
      return getMockRubric();
    }

    const data: RubricWithCriteriaApi = await response.json();
    return transformRubricWithCriteria(data);
  } catch (error) {
    console.warn("Get rubric API unavailable, using mock data:", error);
    return getMockRubric();
  }
}

/**
 * Grade a submission using a rubric
 */
export async function gradeWithRubric(
  submissionId: string,
  graderId: string,
  rubricId: string,
  criterionGrades: CriterionGradeInput[],
  overallFeedback?: string
): Promise<RubricGradeSummary | null> {
  try {
    const url = new URL(`${ACADEMY_API}/submissions/${submissionId}/rubric-grade`);
    url.searchParams.set("grader_id", graderId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rubric_id: rubricId,
        criterion_grades: criterionGrades.map((g) => ({
          criterion_id: g.criterionId,
          level_id: g.levelId,
          points_earned: g.pointsEarned,
          feedback: g.feedback,
        })),
        overall_feedback: overallFeedback,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.warn("Rubric grade failed:", error);
      return null;
    }

    const data: RubricGradeSummaryApi = await response.json();
    return transformRubricGradeSummary(data);
  } catch (error) {
    console.warn("Rubric grade API unavailable:", error);
    return null;
  }
}

/**
 * Get existing rubric grades for a submission
 */
export async function getSubmissionRubricGrades(
  submissionId: string,
  rubricId: string
): Promise<RubricGradeSummary | null> {
  try {
    const url = new URL(`${ACADEMY_API}/submissions/${submissionId}/rubric-grades`);
    url.searchParams.set("rubric_id", rubricId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const data: RubricGradeSummaryApi = await response.json();
    return transformRubricGradeSummary(data);
  } catch (error) {
    console.warn("Get rubric grades API unavailable:", error);
    return null;
  }
}

/**
 * Return a graded submission to the student
 */
export async function returnSubmission(submissionId: string): Promise<Submission | null> {
  try {
    const response = await fetch(`${ACADEMY_API}/submissions/${submissionId}/return`, {
      method: "POST",
    });

    if (!response.ok) {
      console.warn("Return submission failed");
      return null;
    }

    const data: SubmissionApiResponse = await response.json();
    return transformSubmission(data);
  } catch (error) {
    console.warn("Return submission API unavailable:", error);
    return null;
  }
}

/**
 * Calculate letter grade from percentage score
 */
export function calculateLetterGrade(percentage: number): string {
  if (percentage >= 97) return "A+";
  if (percentage >= 93) return "A";
  if (percentage >= 90) return "A-";
  if (percentage >= 87) return "B+";
  if (percentage >= 83) return "B";
  if (percentage >= 80) return "B-";
  if (percentage >= 77) return "C+";
  if (percentage >= 73) return "C";
  if (percentage >= 70) return "C-";
  if (percentage >= 67) return "D+";
  if (percentage >= 63) return "D";
  if (percentage >= 60) return "D-";
  return "F";
}

/**
 * Format relative time for grading queue
 */
export function formatSubmittedTime(submittedAt: string): string {
  const now = new Date();
  const submitted = new Date(submittedAt);
  const diffMs = now.getTime() - submitted.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  return submitted.toLocaleDateString();
}
