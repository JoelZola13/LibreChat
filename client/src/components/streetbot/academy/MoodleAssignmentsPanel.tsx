import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  ChevronLeft,
  Loader2,
  Calendar,
  ArrowRight,
  Upload,
} from "lucide-react";
import {
  getCourseAssignments,
  submitAssignment,
  type MoodleAssignment,
} from "./api/moodle";

interface MoodleAssignmentsPanelProps {
  courseId: string;
  colors: Record<string, string>;
}

function formatMoodleDate(ts: number): string {
  if (!ts || ts === 0) return "No date";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDueStatus(ts: number): { label: string; color: string; urgent: boolean } {
  if (!ts || ts === 0) return { label: "No deadline", color: "#6B7280", urgent: false };

  const now = Date.now();
  const dueMs = ts * 1000;
  const diff = dueMs - now;

  if (diff < 0) return { label: "Past due", color: "#EF4444", urgent: true };
  if (diff < 86400000)
    return { label: `Due in ${Math.ceil(diff / 3600000)}h`, color: "#F59E0B", urgent: true };
  if (diff < 86400000 * 3)
    return { label: `Due in ${Math.ceil(diff / 86400000)}d`, color: "#F59E0B", urgent: false };
  return { label: formatMoodleDate(ts), color: "#10B981", urgent: false };
}

export function MoodleAssignmentsPanel({
  courseId,
  colors,
}: MoodleAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<MoodleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] =
    useState<MoodleAssignment | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getCourseAssignments(courseId);
        setAssignments(data);
      } catch (err) {
        console.error("Failed to load assignments:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const handleSubmit = useCallback(async () => {
    if (!selectedAssignment || !submissionText.trim()) return;
    setSubmitting(true);
    try {
      await submitAssignment(selectedAssignment.id, submissionText);
      setSubmitted(true);
      setSubmissionText("");
    } catch (err) {
      console.error("Failed to submit assignment:", err);
    } finally {
      setSubmitting(false);
    }
  }, [selectedAssignment, submissionText]);

  const goBack = useCallback(() => {
    setSelectedAssignment(null);
    setSubmissionText("");
    setSubmitted(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: colors.accent }}
        />
      </div>
    );
  }

  // ==== Assignment Detail / Submit View ====
  if (selectedAssignment) {
    const dueInfo = getDueStatus(selectedAssignment.duedate);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-xl transition-colors"
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: colors.text }} />
          </button>
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-semibold truncate"
              style={{ color: colors.text }}
            >
              {selectedAssignment.name}
            </h3>
            <p className="text-sm" style={{ color: dueInfo.color }}>
              {dueInfo.label}
            </p>
          </div>
        </div>

        {/* Assignment Info */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* Description */}
          {selectedAssignment.intro && (
            <div className="mb-6">
              <h4
                className="font-medium mb-2"
                style={{ color: colors.text }}
              >
                Instructions
              </h4>
              <div
                className="text-sm prose-sm"
                style={{ color: colors.textSecondary }}
                dangerouslySetInnerHTML={{ __html: selectedAssignment.intro }}
              />
            </div>
          )}

          {/* Meta Info */}
          <div
            className="grid grid-cols-2 gap-4 mb-6 text-sm"
            style={{ color: colors.textSecondary }}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: colors.textMuted }} />
              <span>
                Due: {selectedAssignment.duedate ? formatMoodleDate(selectedAssignment.duedate) : "No deadline"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: colors.textMuted }} />
              <span>
                Max grade: {selectedAssignment.grade > 0 ? selectedAssignment.grade : "Ungraded"}
              </span>
            </div>
            {selectedAssignment.allowsubmissionsfromdate > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: colors.textMuted }} />
                <span>
                  Opens: {formatMoodleDate(selectedAssignment.allowsubmissionsfromdate)}
                </span>
              </div>
            )}
            {selectedAssignment.cutoffdate > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" style={{ color: "#EF4444" }} />
                <span>
                  Cutoff: {formatMoodleDate(selectedAssignment.cutoffdate)}
                </span>
              </div>
            )}
          </div>

          {/* Submission Area */}
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <CheckCircle
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: "#22c55e" }}
              />
              <h4
                className="text-lg font-semibold mb-2"
                style={{ color: colors.text }}
              >
                Submission Received
              </h4>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Your work has been submitted successfully.
              </p>
              <button
                onClick={goBack}
                className="mt-4 px-5 py-2 rounded-xl font-medium flex items-center gap-2 mx-auto"
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              >
                <ArrowRight className="w-4 h-4" />
                Back to Assignments
              </button>
            </motion.div>
          ) : selectedAssignment.nosubmissions ? (
            <div className="text-center py-6">
              <p
                className="text-sm"
                style={{ color: colors.textSecondary }}
              >
                This assignment does not accept online submissions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  Your Submission (Online Text)
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Write your answer here..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={goBack}
                  className="px-5 py-2.5 rounded-xl font-medium transition-colors"
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !submissionText.trim()}
                  className="px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all"
                  style={{
                    background: colors.accent,
                    color: "#000",
                    opacity: submitting || !submissionText.trim() ? 0.5 : 1,
                  }}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==== Assignment List View ====

  // Sort: upcoming first, then past due, then no deadline
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (!a.duedate && !b.duedate) return 0;
    if (!a.duedate) return 1;
    if (!b.duedate) return -1;
    return a.duedate - b.duedate;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: colors.text }}
        >
          <FileText className="w-5 h-5" style={{ color: "#F59E0B" }} />
          Assignments
        </h3>
        <span
          className="text-sm px-3 py-1 rounded-full"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            color: "#F59E0B",
          }}
        >
          {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {sortedAssignments.length === 0 ? (
        <div className="text-center py-12">
          <FileText
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            style={{ color: colors.textMuted }}
          />
          <p className="text-lg font-medium" style={{ color: colors.text }}>
            No assignments
          </p>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            This course has no assignments yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((assignment, index) => {
            const dueInfo = getDueStatus(assignment.duedate);

            return (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => setSelectedAssignment(assignment)}
                className="p-4 rounded-xl cursor-pointer group transition-all"
                style={{
                  background: colors.cardBg,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${dueInfo.urgent ? `${dueInfo.color}40` : colors.border}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(245, 158, 11, 0.5)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = dueInfo.urgent
                    ? `${dueInfo.color}40`
                    : colors.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${dueInfo.color}20`,
                    }}
                  >
                    <FileText
                      className="w-5 h-5"
                      style={{ color: dueInfo.color }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-semibold truncate group-hover:text-yellow-400 transition-colors"
                      style={{ color: colors.text }}
                    >
                      {assignment.name}
                    </h4>
                    <div
                      className="flex items-center gap-3 mt-1 text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      <span className="flex items-center gap-1" style={{ color: dueInfo.color }}>
                        <Clock className="w-3 h-3" />
                        {dueInfo.label}
                      </span>
                      {assignment.grade > 0 && (
                        <span>Max: {assignment.grade} pts</span>
                      )}
                    </div>
                  </div>

                  {/* Action hint */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!assignment.nosubmissions && (
                      <span
                        className="text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: colors.accent,
                          color: "#000",
                        }}
                      >
                        Submit
                      </span>
                    )}
                    <ArrowRight
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: colors.textMuted }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MoodleAssignmentsPanel;
