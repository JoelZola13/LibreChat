import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  Send,
  AlertCircle,
  ArrowLeft,
  Paperclip,
  Trash2,
  FileIcon,
  RotateCcw,
  Award,
  MessageSquare,
  Info,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

// ============================================================================
// Types (kept from original for UI compatibility)
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

// ============================================================================
// Utility functions
// ============================================================================

function isPastDue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function getTimeRemaining(dueDate?: string): string {
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
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} remaining`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} remaining`;
  return "Due soon";
}

function getStatusColor(status: Submission["status"]): string {
  const colors: Record<Submission["status"], string> = {
    draft: "#6B7280",
    submitted: "#3B82F6",
    grading: "#F59E0B",
    graded: "#10B981",
    returned: "#8B5CF6",
    regrade_requested: "#EF4444",
  };
  return colors[status] || "#6B7280";
}

function getStatusLabel(status: Submission["status"]): string {
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================================================
// API response mapper (snake_case -> camelCase)
// ============================================================================

function mapFileAttachment(api: Record<string, unknown>): FileAttachment {
  return {
    url: (api.url as string) || "",
    filename: (api.filename as string) || "",
    sizeBytes: (api.size_bytes as number) || 0,
    mimeType: (api.mime_type as string) || "",
    uploadedAt: (api.uploaded_at as string) || "",
  };
}

function mapSubmission(api: Record<string, unknown>): Submission {
  return {
    id: (api.id as string) || "",
    assignmentId: (api.assignment_id as string) || "",
    userId: (api.user_id as string) || "",
    attemptNumber: (api.attempt_number as number) || 1,
    status: (api.status as Submission["status"]) || "draft",
    submissionType: api.submission_type as Submission["submissionType"],
    textContent: api.text_content as string | undefined,
    documentId: api.document_id as string | undefined,
    fileUrls: Array.isArray(api.file_urls)
      ? api.file_urls.map(mapFileAttachment)
      : [],
    wordCount: api.word_count as number | undefined,
    submittedAt: api.submitted_at as string | undefined,
    isLate: (api.is_late as boolean) || false,
    daysLate: (api.days_late as number) || 0,
    latePenaltyApplied: (api.late_penalty_applied as number) || 0,
    gradedAt: api.graded_at as string | undefined,
    gradedBy: api.graded_by as string | undefined,
    score: api.score as number | undefined,
    adjustedScore: api.adjusted_score as number | undefined,
    letterGrade: api.letter_grade as string | undefined,
    feedback: api.feedback as string | undefined,
    feedbackAttachments: Array.isArray(api.feedback_attachments)
      ? api.feedback_attachments.map(mapFileAttachment)
      : [],
    createdAt: (api.created_at as string) || new Date().toISOString(),
    updatedAt: (api.updated_at as string) || new Date().toISOString(),
  };
}

interface AssignmentDetailProps {
  assignment: Assignment;
  userId: string;
  onBack?: () => void;
  onSubmissionComplete?: () => void;
}

export function AssignmentDetail({
  assignment,
  userId,
  onBack,
  onSubmissionComplete,
}: AssignmentDetailProps) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRegradeModal, setShowRegradeModal] = useState(false);
  const [regradeReason, setRegradeReason] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const pastDue = isPastDue(assignment.dueDate);
  const canSubmit =
    !pastDue ||
    (assignment.allowLateSubmissions &&
      (submission?.daysLate ?? 0) < assignment.maxLateDays);
  const isGraded =
    submission?.status === "graded" || submission?.status === "returned";
  const isDraft = submission?.status === "draft";
  const isSubmitted = submission?.status === "submitted";

  // Load existing submission — try SBP academy API first, then create draft locally
  useEffect(() => {
    async function loadSubmission() {
      setIsLoading(true);
      try {
        // Try to get existing submission from SBP backend
        const resp = await sbFetch(
          `/api/academy/assignments/${assignment.id}/my-submission?user_id=${encodeURIComponent(userId)}`
        );

        if (resp.ok) {
          const data = await resp.json();
          if (data) {
            const sub = mapSubmission(data);
            setSubmission(sub);
            setTextContent(sub.textContent || "");
            setFiles(sub.fileUrls || []);
            return;
          }
        }

        // No submission yet — create a local draft so the form is usable
        if (canSubmit) {
          const draft: Submission = {
            id: `draft-${assignment.id}`,
            assignmentId: assignment.id,
            userId,
            attemptNumber: 1,
            status: "draft",
            textContent: "",
            fileUrls: [],
            isLate: false,
            daysLate: 0,
            latePenaltyApplied: 0,
            feedbackAttachments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setSubmission(draft);
        }
      } catch (err) {
        console.error("Failed to load submission:", err);
        setError("Failed to load submission");
      } finally {
        setIsLoading(false);
      }
    }

    loadSubmission();
  }, [assignment.id, userId, canSubmit]);

  // Update word count
  useEffect(() => {
    const words = textContent.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [textContent]);

  // Auto-save draft via SBP API
  const saveDraft = useCallback(async () => {
    if (!submission || !isDraft) return;
    // Don't save purely local drafts that haven't been created server-side
    if (submission.id.startsWith("draft-")) return;

    setIsSaving(true);
    try {
      await sbFetch(`/api/academy/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text_content: textContent,
          file_urls: files.map((f) => ({
            url: f.url,
            filename: f.filename,
            size_bytes: f.sizeBytes,
            mime_type: f.mimeType,
            uploaded_at: f.uploadedAt,
          })),
        }),
      });
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setIsSaving(false);
    }
  }, [submission, isDraft, textContent, files]);

  // Debounced auto-save
  useEffect(() => {
    if (!isDraft) return;

    const timer = setTimeout(() => {
      saveDraft();
    }, 2000);

    return () => clearTimeout(timer);
  }, [textContent, files, isDraft, saveDraft]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    // Check max files
    if (files.length + uploadedFiles.length > assignment.maxFiles) {
      setError(`Maximum ${assignment.maxFiles} files allowed`);
      return;
    }

    // Validate files before upload
    const validFiles: File[] = [];
    for (const file of Array.from(uploadedFiles)) {
      // Check file size
      if (file.size > assignment.maxFileSizeMb * 1024 * 1024) {
        setError(`File ${file.name} exceeds ${assignment.maxFileSizeMb}MB limit`);
        continue;
      }

      // Check file type
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && !assignment.allowedFileTypes.includes(ext)) {
        setError(
          `File type .${ext} not allowed. Allowed: ${assignment.allowedFileTypes.join(", ")}`
        );
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Upload files — create local object URLs (file upload to Moodle handled on submit)
    setIsSaving(true);
    try {
      const uploadedAttachments: FileAttachment[] = validFiles.map((file) => ({
        url: URL.createObjectURL(file),
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      }));
      setFiles((prev) => [...prev, ...uploadedAttachments]);
      setError(null);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload files. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove file
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit assignment via Moodle endpoint
  const handleSubmit = async () => {
    if (!submission) return;

    // Validate
    if (assignment.assignmentType === "text" && !textContent.trim()) {
      setError("Please enter your response");
      return;
    }

    if (assignment.assignmentType === "file_upload" && files.length === 0) {
      setError("Please upload at least one file");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Submit to Moodle via the adapter endpoint
      const resp = await sbFetch(`/api/academy/moodle/assignments/${assignment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textContent }),
      });

      if (resp.ok) {
        const data = await resp.json();

        // Update local submission state to show submitted status
        setSubmission({
          ...submission,
          status: "submitted",
          submittedAt: new Date().toISOString(),
          textContent,
          fileUrls: files,
        });

        // Fetch grades for this course to show post-submission feedback
        if (assignment.courseId) {
          try {
            const gradesResp = await sbFetch(
              `/api/academy/moodle/grades/${encodeURIComponent(userId)}/${encodeURIComponent(assignment.courseId)}`
            );
            if (gradesResp.ok) {
              const gradesData = await gradesResp.json();
              // If grade data contains a score for this assignment, update submission
              const gradeItems = gradesData?.grade_items || [];
              const matchingGrade = gradeItems.find(
                (g: { itemname?: string; cmid?: number }) =>
                  g.itemname === assignment.title ||
                  String(g.cmid) === assignment.id
              );
              if (matchingGrade && matchingGrade.graderaw != null) {
                setSubmission((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: "graded",
                        score: matchingGrade.graderaw,
                        adjustedScore: matchingGrade.graderaw,
                        feedback: matchingGrade.feedback || undefined,
                      }
                    : prev
                );
              }
            }
          } catch (gradeErr) {
            // Non-critical — grade fetch is best-effort after submission
            console.warn("Could not fetch post-submission grades:", gradeErr);
          }
        }

        onSubmissionComplete?.();
      } else {
        const errData = await resp.json().catch(() => ({}));
        setError(errData.detail || "Failed to submit assignment");
      }
    } catch (err) {
      console.error("Submit failed:", err);
      setError("Failed to submit assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request regrade via SBP API
  const handleRequestRegrade = async () => {
    if (!submission || !regradeReason.trim()) return;

    try {
      const resp = await sbFetch(`/api/academy/submissions/${submission.id}/request-regrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: regradeReason }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setSubmission(mapSubmission(data));
        setShowRegradeModal(false);
        setRegradeReason("");
      }
    } catch (err) {
      console.error("Regrade request failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "20px",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Clock className="w-8 h-8" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <h1
            className="text-2xl font-bold"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            {assignment.title}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {assignment.maxPoints} points
            </span>
            {assignment.dueDate && (
              <span
                style={{ color: pastDue ? "#F59E0B" : "rgba(255, 255, 255, 0.5)" }}
              >
                {getTimeRemaining(assignment.dueDate)}
              </span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {submission && (
          <div
            className="px-4 py-2 rounded-full font-medium flex items-center gap-2"
            style={{
              background: `${getStatusColor(submission.status)}15`,
              color: getStatusColor(submission.status),
            }}
          >
            {isGraded ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            {getStatusLabel(submission.status)}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Instructions & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "24px",
            }}
          >
            <h2
              className="text-lg font-semibold mb-4 flex items-center gap-2"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              <Info className="w-5 h-5" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
              Instructions
            </h2>
            <div
              className="prose prose-invert max-w-none"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
              dangerouslySetInnerHTML={{
                __html: assignment.instructions || assignment.description || "No instructions provided.",
              }}
            />
          </motion.div>

          {/* Submission Form (only for draft status) */}
          {isDraft && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(20px)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "24px",
              }}
            >
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                <FileText className="w-5 h-5" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
                Your Submission
              </h2>

              {/* Text Input */}
              {(assignment.assignmentType === "text" ||
                assignment.assignmentType === "mixed") && (
                <div className="mb-6">
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter your response here..."
                    rows={12}
                    className="w-full p-4 rounded-lg resize-y"
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "rgba(255, 255, 255, 0.9)",
                      fontSize: "14px",
                      lineHeight: "1.6",
                    }}
                  />
                  <div
                    className="flex justify-between mt-2 text-sm"
                    style={{ color: "rgba(255, 255, 255, 0.5)" }}
                  >
                    <span>{wordCount} words</span>
                    {isSaving && <span>Saving...</span>}
                  </div>
                </div>
              )}

              {/* File Upload */}
              {(assignment.assignmentType === "file_upload" ||
                assignment.assignmentType === "mixed") && (
                <div>
                  {/* Upload Area */}
                  <label
                    className="flex flex-col items-center justify-center p-8 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "2px dashed rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Upload
                      className="w-10 h-10 mb-3"
                      style={{ color: "rgba(139, 92, 246, 0.8)" }}
                    />
                    <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                      Click to upload or drag and drop
                    </span>
                    <span
                      className="text-sm mt-1"
                      style={{ color: "rgba(255, 255, 255, 0.5)" }}
                    >
                      {assignment.allowedFileTypes.join(", ").toUpperCase()} up to{" "}
                      {assignment.maxFileSizeMb}MB
                    </span>
                    <input
                      type="file"
                      multiple={assignment.maxFiles > 1}
                      accept={assignment.allowedFileTypes.map((t) => `.${t}`).join(",")}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* File List */}
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ background: "rgba(0, 0, 0, 0.2)" }}
                        >
                          <FileIcon
                            className="w-5 h-5"
                            style={{ color: "rgba(139, 92, 246, 0.8)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="truncate text-sm"
                              style={{ color: "rgba(255, 255, 255, 0.9)" }}
                            >
                              {file.filename}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {formatFileSize(file.sizeBytes)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1.5 rounded transition-colors hover:bg-red-500/20"
                            style={{ color: "#EF4444" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 p-3 rounded-lg flex items-center gap-2"
                    style={{ background: "rgba(239, 68, 68, 0.15)", color: "#EF4444" }}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  Save Draft
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canSubmit}
                  className="px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                  style={{
                    background: canSubmit
                      ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                      : "rgba(255, 255, 255, 0.1)",
                    color: canSubmit ? "#fff" : "rgba(255, 255, 255, 0.3)",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Clock className="w-4 h-4" />
                      </motion.div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Assignment
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Submitted View */}
          {isSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-8"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                borderRadius: "16px",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              }}
            >
              <CheckCircle
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: "#3B82F6" }}
              />
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                Assignment Submitted
              </h3>
              <p style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                Your submission is being reviewed. You will be notified when it has been graded.
              </p>
              {submission.isLate && (
                <p className="mt-2" style={{ color: "#F59E0B" }}>
                  Submitted {submission.daysLate} day{submission.daysLate > 1 ? "s" : ""} late
                  ({submission.latePenaltyApplied}% penalty applied)
                </p>
              )}
            </motion.div>
          )}

          {/* Graded View */}
          {isGraded && submission && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(20px)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "24px",
              }}
            >
              {/* Score Display */}
              <div className="text-center mb-6">
                <div
                  className="text-5xl font-bold mb-2"
                  style={{ color: submission.adjustedScore! >= assignment.passingScore ? "#10B981" : "#EF4444" }}
                >
                  {submission.letterGrade || `${submission.adjustedScore}`}
                </div>
                <p style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                  {submission.adjustedScore} / {assignment.maxPoints} points
                </p>
                {submission.isLate && submission.score !== submission.adjustedScore && (
                  <p className="text-sm mt-1" style={{ color: "#F59E0B" }}>
                    Original score: {submission.score} ({submission.latePenaltyApplied}% late penalty)
                  </p>
                )}
              </div>

              {/* Feedback */}
              {submission.feedback && (
                <div
                  className="p-4 rounded-lg"
                  style={{ background: "rgba(0, 0, 0, 0.2)" }}
                >
                  <h4
                    className="font-medium mb-2 flex items-center gap-2"
                    style={{ color: "rgba(255, 255, 255, 0.95)" }}
                  >
                    <MessageSquare className="w-4 h-4" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
                    Instructor Feedback
                  </h4>
                  <p style={{ color: "rgba(255, 255, 255, 0.7)" }}>{submission.feedback}</p>
                </div>
              )}

              {/* Request Regrade */}
              {submission.status === "returned" && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setShowRegradeModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Request Regrade
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Assignment Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "20px",
            }}
          >
            <h3
              className="font-semibold mb-4"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              Assignment Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Due Date</span>
                <span style={{ color: pastDue ? "#F59E0B" : "rgba(255, 255, 255, 0.9)" }}>
                  {assignment.dueDate
                    ? new Date(assignment.dueDate).toLocaleDateString()
                    : "No due date"}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Points</span>
                <span style={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  {assignment.maxPoints}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Passing Score</span>
                <span style={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  {assignment.passingScore}%
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Attempts</span>
                <span style={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  {submission?.attemptNumber || 0} / {assignment.maxAttempts || "Unlimited"}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Type</span>
                <span
                  className="capitalize"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  {assignment.assignmentType.replace("_", " ")}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Late Policy */}
          {assignment.allowLateSubmissions && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                borderRadius: "16px",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                padding: "20px",
              }}
            >
              <h3
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ color: "#F59E0B" }}
              >
                <AlertCircle className="w-4 h-4" />
                Late Submission Policy
              </h3>
              <div className="space-y-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                <p>• {assignment.latePenaltyPercent}% penalty per day late</p>
                <p>• Maximum {assignment.maxLateDays} days late allowed</p>
                <p>• After {assignment.maxLateDays} days, submissions closed</p>
              </div>
            </motion.div>
          )}

          {/* Submission Requirements */}
          {assignment.assignmentType === "file_upload" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "20px",
              }}
            >
              <h3
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                <Paperclip className="w-4 h-4" />
                File Requirements
              </h3>
              <div className="space-y-2 text-sm" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                <p>• Max files: {assignment.maxFiles}</p>
                <p>• Max size: {assignment.maxFileSizeMb} MB each</p>
                <p>• Allowed: {assignment.allowedFileTypes.join(", ").toUpperCase()}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Regrade Modal */}
      <AnimatePresence>
        {showRegradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0, 0, 0, 0.7)" }}
            onClick={() => setShowRegradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-xl"
              style={{
                background: "rgba(30, 30, 40, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                Request Regrade
              </h3>
              <p className="mb-4 text-sm" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                Please explain why you believe your submission should be regraded.
              </p>
              <textarea
                value={regradeReason}
                onChange={(e) => setRegradeReason(e.target.value)}
                placeholder="Enter your reason..."
                rows={4}
                className="w-full p-3 rounded-lg mb-4"
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRegradeModal(false)}
                  className="px-4 py-2 rounded-lg"
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestRegrade}
                  disabled={!regradeReason.trim()}
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    background: regradeReason.trim()
                      ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                      : "rgba(255, 255, 255, 0.1)",
                    color: regradeReason.trim() ? "#fff" : "rgba(255, 255, 255, 0.3)",
                  }}
                >
                  Submit Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
