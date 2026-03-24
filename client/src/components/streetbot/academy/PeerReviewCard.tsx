import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  FileText,
} from "lucide-react";
import {
  PeerReviewAssignment,
  getStatusColor,
  getStatusLabel,
  getTimeRemaining,
  isOverdue,
} from "./api/peer-review";

interface PeerReviewCardProps {
  assignment: PeerReviewAssignment;
  onStartReview: (assignment: PeerReviewAssignment) => void;
  onContinueReview?: (assignment: PeerReviewAssignment) => void;
}

export function PeerReviewCard({
  assignment,
  onStartReview,
  onContinueReview,
}: PeerReviewCardProps) {
  const overdue = isOverdue(assignment.dueDate);
  const isInProgress = assignment.status === "in_progress";
  const isCompleted = assignment.status === "completed";
  const isExpired = assignment.status === "expired";
  const canReview = !isCompleted && !isExpired;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={canReview ? { scale: 1.01 } : undefined}
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: `1px solid ${
          overdue && canReview
            ? "rgba(239, 68, 68, 0.3)"
            : "rgba(255, 255, 255, 0.12)"
        }`,
        padding: "20px",
        cursor: canReview ? "pointer" : "default",
      }}
      onClick={() => {
        if (!canReview) return;
        if (isInProgress && onContinueReview) {
          onContinueReview(assignment);
        } else {
          onStartReview(assignment);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: `${getStatusColor(assignment.status)}15`,
            }}
          >
            <Users
              className="w-5 h-5"
              style={{ color: getStatusColor(assignment.status) }}
            />
          </div>
          <div>
            <h3
              className="font-semibold text-base"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              {assignment.assignmentTitle || "Peer Review"}
            </h3>
            <p
              className="text-sm mt-0.5"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {assignment.revieweeName
                ? `Review for ${assignment.revieweeName}`
                : "Anonymous submission"}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
          style={{
            background: `${getStatusColor(assignment.status)}15`,
            color: getStatusColor(assignment.status),
          }}
        >
          {isCompleted ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : isExpired ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : (
            <Clock className="w-3.5 h-3.5" />
          )}
          {getStatusLabel(assignment.status)}
        </div>
      </div>

      {/* Preview */}
      {assignment.submissionPreview && (
        <div
          className="p-3 rounded-lg mb-4"
          style={{ background: "rgba(0, 0, 0, 0.2)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText
              className="w-4 h-4"
              style={{ color: "rgba(139, 92, 246, 0.8)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Submission Preview
            </span>
          </div>
          <p
            className="text-sm line-clamp-2"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            {assignment.submissionPreview}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Due Date */}
          {assignment.dueDate && (
            <div className="flex items-center gap-1.5">
              <Clock
                className="w-4 h-4"
                style={{
                  color: overdue ? "#EF4444" : "rgba(255, 255, 255, 0.4)",
                }}
              />
              <span
                className="text-sm"
                style={{
                  color: overdue ? "#EF4444" : "rgba(255, 255, 255, 0.5)",
                }}
              >
                {getTimeRemaining(assignment.dueDate)}
              </span>
            </div>
          )}

          {/* Assigned Date */}
          <span
            className="text-xs"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Action Button */}
        {canReview && (
          <motion.button
            whileHover={{ x: 4 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{
              background: isInProgress
                ? "rgba(245, 158, 11, 0.15)"
                : "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
              color: isInProgress ? "#F59E0B" : "#fff",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isInProgress && onContinueReview) {
                onContinueReview(assignment);
              } else {
                onStartReview(assignment);
              }
            }}
          >
            {isInProgress ? "Continue" : "Start Review"}
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
