import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  FileText,
  Download,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Calendar,
  Hash,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import {
  Submission,
  GradingQueueItem,
  RubricWithCriteria,
  CriterionGradeInput,
  gradeSubmission,
  gradeWithRubric,
  getRubric,
  calculateLetterGrade,
  formatSubmittedTime,
} from "./api/assignments";
import { RubricGradingPanel } from "./RubricGradingPanel";

// ============================================================================
// Types
// ============================================================================

interface SubmissionGradingInterfaceProps {
  queueItem: GradingQueueItem;
  submission: Submission;
  graderId: string;
  onBack: () => void;
  onGradeSubmitted: (submissionId: string) => void;
  onNextSubmission?: () => void;
  hasNext?: boolean;
}

interface GradeFormState {
  score: number;
  feedback: string;
  useRubric: boolean;
  rubricGrades: CriterionGradeInput[];
  rubricTotal: number;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: "calc(100vh - 200px)",
};

const headerStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "20px 24px",
  marginBottom: "20px",
};

const contentStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 400px",
  gap: "20px",
  flex: 1,
};

const panelStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "24px",
  height: "fit-content",
};

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
};

const buttonStyles = (
  variant: "primary" | "secondary" | "ghost"
): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: variant === "ghost" ? "8px 12px" : "12px 20px",
  borderRadius: "8px",
  border:
    variant === "secondary"
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "none",
  background:
    variant === "primary"
      ? "linear-gradient(135deg, #8B5CF6, #7C3AED)"
      : variant === "secondary"
        ? "rgba(255, 255, 255, 0.04)"
        : "transparent",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s ease",
});

const attachmentCardStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  marginBottom: "8px",
};

// ============================================================================
// Sub-Components
// ============================================================================

interface MetaBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

function MetaBadge({ icon, label, value, color = "#9CA3AF" }: MetaBadgeProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ color }}>{icon}</div>
      <div>
        <span style={{ fontSize: "11px", color: "#6B7280" }}>{label}</span>
        <p style={{ margin: 0, fontSize: "13px", color }}>{value}</p>
      </div>
    </div>
  );
}

interface AttachmentCardProps {
  name: string;
  size?: string;
  url?: string;
}

function AttachmentCard({ name, size, url }: AttachmentCardProps) {
  return (
    <div style={attachmentCardStyles}>
      <FileText size={20} color="#8B5CF6" />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#fff" }}>{name}</p>
        {size && (
          <span style={{ fontSize: "12px", color: "#6B7280" }}>{size}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {url && (
          <>
            <button
              type="button"
              style={{
                padding: "6px",
                borderRadius: "6px",
                border: "none",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#9CA3AF",
                cursor: "pointer",
              }}
              title="Download"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              style={{
                padding: "6px",
                borderRadius: "6px",
                border: "none",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#9CA3AF",
                cursor: "pointer",
              }}
              title="Open in new tab"
            >
              <ExternalLink size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SubmissionGradingInterface({
  queueItem,
  submission,
  graderId,
  onBack,
  onGradeSubmitted,
  onNextSubmission,
  hasNext = false,
}: SubmissionGradingInterfaceProps) {
  // Form state
  const [formState, setFormState] = useState<GradeFormState>({
    score: submission.score ?? 0,
    feedback: submission.feedback ?? "",
    useRubric: false,
    rubricGrades: [],
    rubricTotal: 0,
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [rubric, setRubric] = useState<RubricWithCriteria | null>(null);
  const [loadingRubric, setLoadingRubric] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load rubric if available
  useEffect(() => {
    if (queueItem.rubricId) {
      setLoadingRubric(true);
      getRubric(queueItem.rubricId)
        .then((data) => {
          setRubric(data);
          if (data) {
            setFormState((prev) => ({ ...prev, useRubric: true }));
          }
        })
        .catch((err) => {
          console.error("Failed to load rubric:", err);
        })
        .finally(() => {
          setLoadingRubric(false);
        });
    }
  }, [queueItem.rubricId]);

  // Calculate late penalty
  const latePenalty = useMemo(() => {
    if (!queueItem.isLate || queueItem.daysLate <= 0) return 0;
    // 10% per day late, max 50%
    return Math.min(queueItem.daysLate * 10, 50);
  }, [queueItem.isLate, queueItem.daysLate]);

  // Calculate effective score
  const effectiveScore = useMemo(() => {
    const rawScore = formState.useRubric
      ? formState.rubricTotal
      : formState.score;
    const maxPoints = queueItem.maxPoints || 100;
    const percentage = (rawScore / maxPoints) * 100;
    const adjusted = Math.max(0, percentage - latePenalty);
    return {
      raw: rawScore,
      percentage,
      adjusted,
      adjustedPoints: Math.round((adjusted / 100) * maxPoints),
      letterGrade: calculateLetterGrade(adjusted),
    };
  }, [formState, queueItem.maxPoints, latePenalty]);

  // Handle score change
  const handleScoreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(
        Math.max(0, parseInt(e.target.value) || 0),
        queueItem.maxPoints
      );
      setFormState((prev) => ({ ...prev, score: value }));
    },
    [queueItem.maxPoints]
  );

  // Handle feedback change
  const handleFeedbackChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, feedback: e.target.value }));
    },
    []
  );

  // Handle rubric grades change
  const handleRubricGradesChange = useCallback(
    (grades: CriterionGradeInput[], totalScore: number) => {
      setFormState((prev) => ({
        ...prev,
        rubricGrades: grades,
        rubricTotal: totalScore,
      }));
    },
    []
  );

  // Toggle rubric mode
  const toggleRubricMode = useCallback(() => {
    setFormState((prev) => ({ ...prev, useRubric: !prev.useRubric }));
  }, []);

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    setError(null);
    try {
      // Save current state without submitting final grade
      // For now, just show success feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Could implement draft saving to local storage or backend
    } catch (error) {
      console.error('[SubmissionGradingInterface] Failed to save draft:', error);
      setError("Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  }, []);

  // Submit grade
  const handleSubmitGrade = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      if (formState.useRubric && rubric) {
        result = await gradeWithRubric(
          submission.id,
          graderId,
          rubric.id,
          formState.rubricGrades,
          formState.feedback
        );
      } else {
        result = await gradeSubmission(submission.id, graderId, {
          score: effectiveScore.adjustedPoints,
          feedback: formState.feedback,
        });
      }

      if (result) {
        onGradeSubmitted(submission.id);
        if (hasNext && onNextSubmission) {
          onNextSubmission();
        }
      } else {
        setError("Failed to submit grade");
      }
    } catch (error) {
      console.error('[SubmissionGradingInterface] Failed to submit grade:', error);
      setError("Failed to submit grade");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formState,
    rubric,
    submission.id,
    graderId,
    effectiveScore.adjustedPoints,
    onGradeSubmitted,
    hasNext,
    onNextSubmission,
  ]);

  // Parse submission content
  const submissionContent = useMemo(() => {
    if (submission.textContent) {
      return { text: submission.textContent };
    }
    return null;
  }, [submission.textContent]);

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <motion.button
              type="button"
              style={buttonStyles("ghost")}
              onClick={onBack}
              whileHover={{ x: -2 }}
            >
              <ArrowLeft size={18} />
              Back to Queue
            </motion.button>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                Grading: {queueItem.assignmentTitle}
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#9CA3AF" }}>
                {queueItem.courseTitle}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <motion.button
              type="button"
              style={buttonStyles("secondary")}
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Save size={16} />
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </motion.button>
            <motion.button
              type="button"
              style={buttonStyles("primary")}
              onClick={handleSubmitGrade}
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? (
                "Submitting..."
              ) : hasNext ? (
                <>
                  Grade & Next <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <Send size={16} /> Submit Grade
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Meta Info Row */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <MetaBadge
            icon={<User size={16} />}
            label="Student"
            value={queueItem.userName}
            color="#fff"
          />
          <MetaBadge
            icon={<Calendar size={16} />}
            label="Submitted"
            value={formatSubmittedTime(queueItem.submittedAt)}
          />
          <MetaBadge
            icon={<Hash size={16} />}
            label="Attempt"
            value={`${queueItem.attemptNumber}`}
          />
          {queueItem.isLate ? (
            <MetaBadge
              icon={<AlertTriangle size={16} />}
              label="Late"
              value={`${queueItem.daysLate} day${queueItem.daysLate !== 1 ? "s" : ""} (-${latePenalty}%)`}
              color="#F59E0B"
            />
          ) : (
            <MetaBadge
              icon={<CheckCircle2 size={16} />}
              label="Status"
              value="On Time"
              color="#10B981"
            />
          )}
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#EF4444",
              fontSize: "14px",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={contentStyles}>
        {/* Submission Panel */}
        <div style={panelStyles}>
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: 600,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FileText size={18} color="#8B5CF6" />
            Submission Content
          </h3>

          {/* Text Content */}
          {submissionContent?.text && (
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: "16px",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: "inherit",
                  fontSize: "14px",
                  color: "#E5E7EB",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {submissionContent.text}
              </pre>
            </div>
          )}

          {/* Attachments */}
          {submission.fileUrls && submission.fileUrls.length > 0 && (
            <div>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#9CA3AF",
                }}
              >
                Attachments ({submission.fileUrls.length})
              </h4>
              {submission.fileUrls.map((file, idx) => (
                <AttachmentCard
                  key={idx}
                  name={file.filename || `Attachment ${idx + 1}`}
                  size={file.sizeBytes ? `${Math.round(file.sizeBytes / 1024)} KB` : undefined}
                  url={file.url}
                />
              ))}
            </div>
          )}

          {/* No Content Fallback */}
          {!submissionContent?.text &&
            (!submission.fileUrls || submission.fileUrls.length === 0) && (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#6B7280",
                }}
              >
                <FileText size={40} style={{ opacity: 0.5, marginBottom: "12px" }} />
                <p>No submission content available</p>
              </div>
            )}
        </div>

        {/* Grading Panel */}
        <div>
          {/* Mode Toggle */}
          {rubric && (
            <div
              style={{
                ...panelStyles,
                marginBottom: "16px",
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "14px", color: "#9CA3AF" }}>
                  Grading Mode
                </span>
                <div
                  style={{
                    display: "flex",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, useRubric: false }))
                    }
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      background: !formState.useRubric
                        ? "rgba(139, 92, 246, 0.3)"
                        : "transparent",
                      color: !formState.useRubric ? "#8B5CF6" : "#9CA3AF",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({ ...prev, useRubric: true }))
                    }
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      background: formState.useRubric
                        ? "rgba(139, 92, 246, 0.3)"
                        : "transparent",
                      color: formState.useRubric ? "#8B5CF6" : "#9CA3AF",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <ClipboardList
                      size={14}
                      style={{ marginRight: "6px", verticalAlign: "middle" }}
                    />
                    Rubric
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rubric Grading */}
          <AnimatePresence mode="wait">
            {formState.useRubric && rubric ? (
              <motion.div
                key="rubric"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RubricGradingPanel
                  rubric={rubric}
                  onGradesChange={handleRubricGradesChange}
                />
              </motion.div>
            ) : (
              <motion.div
                key="simple"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={panelStyles}
              >
                <h3
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#fff",
                  }}
                >
                  Grade Submission
                </h3>

                {/* Score Input */}
                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#9CA3AF",
                      marginBottom: "8px",
                    }}
                  >
                    Score
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="number"
                      min={0}
                      max={queueItem.maxPoints}
                      value={formState.score}
                      onChange={handleScoreChange}
                      style={{ ...inputStyles, width: "100px", textAlign: "center" }}
                    />
                    <span style={{ color: "#6B7280", fontSize: "14px" }}>
                      / {queueItem.maxPoints}
                    </span>
                  </div>
                </div>

                {/* Score Preview */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.04)",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "16px",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "#6B7280",
                          marginBottom: "4px",
                        }}
                      >
                        Raw Score
                      </span>
                      <span style={{ fontSize: "18px", color: "#fff", fontWeight: 600 }}>
                        {effectiveScore.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "#6B7280",
                          marginBottom: "4px",
                        }}
                      >
                        Late Penalty
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          color: latePenalty > 0 ? "#F59E0B" : "#10B981",
                          fontWeight: 600,
                        }}
                      >
                        -{latePenalty}%
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "#6B7280",
                          marginBottom: "4px",
                        }}
                      >
                        Final Grade
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          color:
                            effectiveScore.adjusted >= 70 ? "#10B981" : "#F59E0B",
                          fontWeight: 600,
                        }}
                      >
                        {effectiveScore.adjusted.toFixed(0)}% (
                        {effectiveScore.letterGrade})
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback Section */}
          <div style={{ ...panelStyles, marginTop: "16px" }}>
            <h4
              style={{
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: 500,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MessageSquare size={16} color="#8B5CF6" />
              Overall Feedback
            </h4>
            <textarea
              placeholder="Provide feedback for the student..."
              value={formState.feedback}
              onChange={handleFeedbackChange}
              style={{
                ...inputStyles,
                minHeight: "120px",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubmissionGradingInterface;
