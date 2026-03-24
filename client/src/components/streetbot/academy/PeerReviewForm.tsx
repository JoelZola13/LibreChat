import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Star,
  ThumbsUp,
  Lightbulb,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  PeerReviewAssignment,
  PeerReviewConfig,
  PeerReviewCreate,
  startReview,
  submitReview,
  getPeerReviewConfig,
} from "./api/peer-review";

interface PeerReviewFormProps {
  assignment: PeerReviewAssignment;
  userId: string;
  submissionContent?: string;
  submissionFiles?: { name: string; url: string }[];
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export function PeerReviewForm({
  assignment,
  userId,
  submissionContent,
  submissionFiles,
  onBack,
  onSubmitSuccess,
}: PeerReviewFormProps) {
  const [config, setConfig] = useState<PeerReviewConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [overallScore, setOverallScore] = useState<number>(0);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");

  // Validation state
  const [feedbackLength, setFeedbackLength] = useState(0);

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await getPeerReviewConfig(assignment.assignmentId);
        setConfig(cfg);
      } catch (err) {
        console.error("Failed to load config:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [assignment.assignmentId]);

  useEffect(() => {
    const total = overallFeedback.length + strengths.length + improvements.length;
    setFeedbackLength(total);
  }, [overallFeedback, strengths, improvements]);

  // Start the review when component mounts if not already started
  useEffect(() => {
    async function start() {
      if (assignment.status === "assigned") {
        try {
          await startReview(assignment.id);
        } catch (err) {
          console.error("Failed to start review:", err);
        }
      }
    }
    start();
  }, [assignment.id, assignment.status]);

  const minFeedbackLength = config?.minFeedbackLength || 50;
  const isValidFeedback = feedbackLength >= minFeedbackLength;
  const isValidScore = overallScore > 0;
  const canSubmit = isValidFeedback && isValidScore && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (!isValidScore) {
        setError("Please provide an overall score");
      } else if (!isValidFeedback) {
        setError(`Feedback must be at least ${minFeedbackLength} characters`);
      }
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reviewData: PeerReviewCreate = {
        peerReviewAssignmentId: assignment.id,
        submissionId: assignment.submissionId,
        overallScore,
        overallFeedback: overallFeedback.trim(),
        strengths: strengths.trim() || undefined,
        improvements: improvements.trim() || undefined,
      };

      await submitReview(reviewData, userId);
      onSubmitSuccess();
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError("Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
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
        <div className="flex-1">
          <h1
            className="text-2xl font-bold"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            Peer Review
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            {assignment.assignmentTitle || "Assignment Review"}
          </p>
        </div>

        {/* Points Badge */}
        {config && (
          <div
            className="px-4 py-2 rounded-full font-medium flex items-center gap-2"
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
            }}
          >
            <Star className="w-4 h-4" />
            {config.pointsForReviewing} points
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submission to Review */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "24px",
            maxHeight: "70vh",
            overflow: "auto",
          }}
        >
          <h2
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            <FileText className="w-5 h-5" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
            Submission
          </h2>

          {submissionContent ? (
            <div
              className="prose prose-invert max-w-none text-sm"
              style={{ color: "rgba(255, 255, 255, 0.8)" }}
            >
              <pre
                className="whitespace-pre-wrap p-4 rounded-lg"
                style={{ background: "rgba(0, 0, 0, 0.3)" }}
              >
                {submissionContent}
              </pre>
            </div>
          ) : (
            <div
              className="text-center p-8 rounded-lg"
              style={{ background: "rgba(0, 0, 0, 0.2)" }}
            >
              <FileText
                className="w-12 h-12 mx-auto mb-3"
                style={{ color: "rgba(255, 255, 255, 0.3)" }}
              />
              <p style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                Submission content will be displayed here
              </p>
            </div>
          )}

          {submissionFiles && submissionFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: "rgba(255, 255, 255, 0.7)" }}
              >
                Attached Files
              </h3>
              {submissionFiles.map((file, index) => (
                <a
                  key={index}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg transition-colors"
                  style={{
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "rgba(139, 92, 246, 0.8)",
                  }}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">{file.name}</span>
                </a>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: Review Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Anonymous Note */}
          {config?.isAnonymous && (
            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              }}
            >
              <Info className="w-5 h-5 mt-0.5" style={{ color: "#3B82F6" }} />
              <div>
                <p className="font-medium text-sm" style={{ color: "#3B82F6" }}>
                  Anonymous Review
                </p>
                <p className="text-sm mt-1" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                  Your identity will not be revealed to the person you&apos;re reviewing.
                </p>
              </div>
            </div>
          )}

          {/* Overall Score */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "24px",
            }}
          >
            <h3
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              <Star className="w-5 h-5" style={{ color: "#F59E0B" }} />
              Overall Score
            </h3>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={overallScore}
                onChange={(e) => setOverallScore(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${overallScore}%, rgba(255,255,255,0.2) ${overallScore}%, rgba(255,255,255,0.2) 100%)`,
                }}
              />
              <div
                className="w-16 text-center text-2xl font-bold"
                style={{
                  color:
                    overallScore >= 70
                      ? "#10B981"
                      : overallScore >= 50
                      ? "#F59E0B"
                      : "#EF4444",
                }}
              >
                {overallScore}
              </div>
            </div>
            <div
              className="flex justify-between text-xs mt-2"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              <span>Needs Improvement</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Strengths */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "24px",
            }}
          >
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              <ThumbsUp className="w-5 h-5" style={{ color: "#10B981" }} />
              Strengths
            </h3>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What did this submission do well?"
              rows={3}
              className="w-full p-3 rounded-lg resize-none"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Areas for Improvement */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "24px",
            }}
          >
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              <Lightbulb className="w-5 h-5" style={{ color: "#F59E0B" }} />
              Areas for Improvement
            </h3>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="What could be improved? Be constructive."
              rows={3}
              className="w-full p-3 rounded-lg resize-none"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Overall Feedback */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "24px",
            }}
          >
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              <FileText className="w-5 h-5" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
              Overall Feedback
              <span className="text-xs font-normal" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
                (Required)
              </span>
            </h3>
            <textarea
              value={overallFeedback}
              onChange={(e) => setOverallFeedback(e.target.value)}
              placeholder="Provide your overall assessment and feedback..."
              rows={4}
              className="w-full p-3 rounded-lg resize-y"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: `1px solid ${
                  feedbackLength > 0 && !isValidFeedback
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(255, 255, 255, 0.1)"
                }`,
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: "14px",
              }}
            />
            <div
              className="flex justify-between mt-2 text-xs"
              style={{
                color: isValidFeedback
                  ? "#10B981"
                  : feedbackLength > 0
                  ? "#EF4444"
                  : "rgba(255, 255, 255, 0.4)",
              }}
            >
              <span>
                {feedbackLength} / {minFeedbackLength} characters minimum (total)
              </span>
              {isValidFeedback && <CheckCircle className="w-4 h-4" />}
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg flex items-center gap-2"
                style={{ background: "rgba(239, 68, 68, 0.15)", color: "#EF4444" }}
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Cancel
            </button>
            <motion.button
              whileHover={canSubmit ? { scale: 1.02 } : undefined}
              whileTap={canSubmit ? { scale: 0.98 } : undefined}
              onClick={handleSubmit}
              disabled={!canSubmit}
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
                  Submit Review
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
