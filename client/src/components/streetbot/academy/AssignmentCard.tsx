import React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  MessageSquare,
  Users,
  ChevronRight,
  HelpCircle,
  Paperclip,
} from "lucide-react";
import {
  Assignment,
  Submission,
  isPastDue,
  getTimeRemaining,
  getStatusColor,
  getStatusLabel,
} from "./api/assignments";

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission | null;
  onClick?: () => void;
  showStats?: boolean;
}

export function AssignmentCard({
  assignment,
  submission,
  onClick,
  showStats = false,
}: AssignmentCardProps) {
  const pastDue = isPastDue(assignment.dueDate);
  const timeRemaining = getTimeRemaining(assignment.dueDate);
  const hasSubmission = submission && submission.status !== "draft";
  const isGraded = submission?.status === "graded" || submission?.status === "returned";

  // Determine card status and colors
  const getCardStatus = () => {
    if (isGraded) {
      return {
        label: `${submission.letterGrade || submission.adjustedScore} / ${assignment.maxPoints}`,
        color: "#10B981",
        bgColor: "rgba(16, 185, 129, 0.1)",
      };
    }
    if (hasSubmission) {
      return {
        label: getStatusLabel(submission!.status),
        color: getStatusColor(submission!.status),
        bgColor: `${getStatusColor(submission!.status)}15`,
      };
    }
    if (pastDue && !assignment.allowLateSubmissions) {
      return {
        label: "Closed",
        color: "#EF4444",
        bgColor: "rgba(239, 68, 68, 0.1)",
      };
    }
    if (pastDue) {
      return {
        label: "Late",
        color: "#F59E0B",
        bgColor: "rgba(245, 158, 11, 0.1)",
      };
    }
    return {
      label: "Open",
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.1)",
    };
  };

  const cardStatus = getCardStatus();

  // Get assignment type icon
  const getTypeIcon = () => {
    switch (assignment.assignmentType) {
      case "quiz":
        return <HelpCircle className="w-4 h-4" />;
      case "file_upload":
        return <Upload className="w-4 h-4" />;
      case "text":
        return <MessageSquare className="w-4 h-4" />;
      case "document":
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: "20px",
        transition: "all 0.2s ease",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Assignment Info */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2 rounded-lg"
              style={{ background: "rgba(139, 92, 246, 0.2)" }}
            >
              {getTypeIcon()}
            </div>
            <h3
              className="font-semibold text-lg truncate"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              {assignment.title}
            </h3>
          </div>

          {/* Description */}
          {assignment.description && (
            <p
              className="text-sm mb-3 line-clamp-2"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              {assignment.description}
            </p>
          )}

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Due Date */}
            {assignment.dueDate && (
              <div
                className="flex items-center gap-1.5"
                style={{ color: pastDue ? "#F59E0B" : "rgba(255, 255, 255, 0.5)" }}
              >
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(assignment.dueDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* Time Remaining */}
            <div
              className="flex items-center gap-1.5"
              style={{
                color: pastDue ? "#EF4444" : "rgba(255, 255, 255, 0.5)",
              }}
            >
              <Clock className="w-4 h-4" />
              <span>{timeRemaining}</span>
            </div>

            {/* Points */}
            <div
              className="flex items-center gap-1.5"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              <span className="font-medium">{assignment.maxPoints} pts</span>
            </div>

            {/* Peer Review */}
            {assignment.peerReviewEnabled && (
              <div
                className="flex items-center gap-1.5"
                style={{ color: "rgba(139, 92, 246, 0.8)" }}
              >
                <Users className="w-4 h-4" />
                <span>Peer Review</span>
              </div>
            )}

            {(assignment.resourceAttachment || assignment.resourceFileName) && (
              <div
                className="flex items-center gap-1.5"
                style={{ color: "rgba(250, 204, 21, 0.85)" }}
              >
                <Paperclip className="w-4 h-4" />
                <span>Attachment included</span>
              </div>
            )}
          </div>

          {/* Stats Row (for instructors) */}
          {showStats && assignment.submissionCount !== undefined && (
            <div
              className="flex items-center gap-4 mt-3 pt-3 text-sm"
              style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
            >
              <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                {assignment.submissionCount} submitted
              </span>
              <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                {assignment.gradedCount} graded
              </span>
              {assignment.averageScore !== undefined && (
                <span style={{ color: "rgba(16, 185, 129, 0.8)" }}>
                  Avg: {assignment.averageScore.toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Status & Arrow */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div
            className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5"
            style={{
              background: cardStatus.bgColor,
              color: cardStatus.color,
            }}
          >
            {isGraded ? (
              <CheckCircle className="w-4 h-4" />
            ) : pastDue && !hasSubmission ? (
              <AlertCircle className="w-4 h-4" />
            ) : null}
            {cardStatus.label}
          </div>

          {/* Arrow */}
          <ChevronRight
            className="w-5 h-5"
            style={{ color: "rgba(255, 255, 255, 0.3)" }}
          />
        </div>
      </div>

      {/* Late Submission Warning */}
      {pastDue && assignment.allowLateSubmissions && !hasSubmission && (
        <div
          className="mt-3 pt-3 flex items-center gap-2 text-sm"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#F59E0B",
          }}
        >
          <AlertCircle className="w-4 h-4" />
          <span>
            Late penalty: {assignment.latePenaltyPercent}% per day (max{" "}
            {assignment.maxLateDays} days)
          </span>
        </div>
      )}

      {/* Graded Feedback Preview */}
      {isGraded && submission?.feedback && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
        >
          <p
            className="text-sm line-clamp-2"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            <span style={{ color: "rgba(139, 92, 246, 0.8)" }}>Feedback: </span>
            {submission.feedback}
          </p>
        </div>
      )}
    </motion.div>
  );
}
