import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PeerReviewForReviewee,
  HelpfulnessRating,
  rateReviewHelpfulness,
  formatScore,
} from "./api/peer-review";

interface PeerReviewFeedbackProps {
  reviews: PeerReviewForReviewee[];
  userId: string;
  onRatingSubmitted?: () => void;
}

export function PeerReviewFeedback({
  reviews,
  userId,
  onRatingSubmitted,
}: PeerReviewFeedbackProps) {
  const [expandedReview, setExpandedReview] = useState<string | null>(
    reviews.length === 1 ? reviews[0].id : null
  );
  const [ratingReview, setRatingReview] = useState<string | null>(null);
  const [helpfulnessRating, setHelpfulnessRating] = useState<number>(3);
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const averageScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviews.length
      : null;

  const handleSubmitRating = async (reviewId: string) => {
    if (isHelpful === null) return;

    setIsSubmitting(true);
    try {
      const rating: HelpfulnessRating = {
        isHelpful,
        rating: helpfulnessRating,
        comment: ratingComment.trim() || undefined,
      };
      await rateReviewHelpfulness(reviewId, userId, rating);
      setRatingReview(null);
      setIsHelpful(null);
      setHelpfulnessRating(3);
      setRatingComment("");
      onRatingSubmitted?.();
    } catch (err) {
      console.error("Failed to submit rating:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (reviews.length === 0) {
    return (
      <div
        className="text-center p-8 rounded-xl"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <MessageSquare
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: "rgba(255, 255, 255, 0.3)" }}
        />
        <p style={{ color: "rgba(255, 255, 255, 0.6)" }}>
          No peer reviews received yet
        </p>
        <p className="text-sm mt-1" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
          Check back later for feedback from your peers
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div
        className="p-4 rounded-xl flex items-center justify-between"
        style={{
          background: "rgba(139, 92, 246, 0.1)",
          border: "1px solid rgba(139, 92, 246, 0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg"
            style={{ background: "rgba(139, 92, 246, 0.2)" }}
          >
            <MessageSquare className="w-5 h-5" style={{ color: "#8B5CF6" }} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: "rgba(255, 255, 255, 0.95)" }}>
              {reviews.length} Peer Review{reviews.length > 1 ? "s" : ""} Received
            </p>
            <p className="text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {averageScore !== null
                ? `Average score: ${formatScore(averageScore)}`
                : "No scores available"}
            </p>
          </div>
        </div>
        {averageScore !== null && (
          <div
            className="text-3xl font-bold"
            style={{
              color:
                averageScore >= 70
                  ? "#10B981"
                  : averageScore >= 50
                  ? "#F59E0B"
                  : "#EF4444",
            }}
          >
            {Math.round(averageScore)}%
          </div>
        )}
      </div>

      {/* Review Cards */}
      {reviews.map((review, index) => (
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <button
            onClick={() =>
              setExpandedReview(expandedReview === review.id ? null : review.id)
            }
            className="w-full p-4 flex items-center justify-between"
            style={{ background: "transparent" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-full"
                style={{ background: "rgba(255, 255, 255, 0.1)" }}
              >
                <User className="w-4 h-4" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
              </div>
              <div className="text-left">
                <p
                  className="font-medium"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  {review.reviewerName || "Anonymous Reviewer"}
                </p>
                <p className="text-xs" style={{ color: "rgba(255, 255, 255, 0.4)" }}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(review.submittedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {review.overallScore !== undefined && (
                <div
                  className="px-3 py-1 rounded-full font-bold"
                  style={{
                    background: `${
                      review.overallScore >= 70
                        ? "rgba(16, 185, 129, 0.15)"
                        : review.overallScore >= 50
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(239, 68, 68, 0.15)"
                    }`,
                    color:
                      review.overallScore >= 70
                        ? "#10B981"
                        : review.overallScore >= 50
                        ? "#F59E0B"
                        : "#EF4444",
                  }}
                >
                  {Math.round(review.overallScore)}%
                </div>
              )}
              {expandedReview === review.id ? (
                <ChevronUp
                  className="w-5 h-5"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                />
              ) : (
                <ChevronDown
                  className="w-5 h-5"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                />
              )}
            </div>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {expandedReview === review.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="px-4 pb-4 space-y-4"
                  style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                  {/* Strengths */}
                  {review.strengths && (
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ThumbsUp className="w-4 h-4" style={{ color: "#10B981" }} />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "#10B981" }}
                        >
                          Strengths
                        </span>
                      </div>
                      <p
                        className="text-sm pl-6"
                        style={{ color: "rgba(255, 255, 255, 0.7)" }}
                      >
                        {review.strengths}
                      </p>
                    </div>
                  )}

                  {/* Improvements */}
                  {review.improvements && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4" style={{ color: "#F59E0B" }} />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "#F59E0B" }}
                        >
                          Areas for Improvement
                        </span>
                      </div>
                      <p
                        className="text-sm pl-6"
                        style={{ color: "rgba(255, 255, 255, 0.7)" }}
                      >
                        {review.improvements}
                      </p>
                    </div>
                  )}

                  {/* Overall Feedback */}
                  {review.overallFeedback && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare
                          className="w-4 h-4"
                          style={{ color: "rgba(139, 92, 246, 0.8)" }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "rgba(139, 92, 246, 0.8)" }}
                        >
                          Overall Feedback
                        </span>
                      </div>
                      <p
                        className="text-sm pl-6"
                        style={{ color: "rgba(255, 255, 255, 0.7)" }}
                      >
                        {review.overallFeedback}
                      </p>
                    </div>
                  )}

                  {/* Rate Helpfulness */}
                  {ratingReview !== review.id ? (
                    <div className="pt-2">
                      <button
                        onClick={() => setRatingReview(review.id)}
                        className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "rgba(255, 255, 255, 0.6)",
                        }}
                      >
                        <Star className="w-4 h-4" />
                        Rate this review
                      </button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-4 space-y-3"
                      style={{
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <p
                        className="text-sm font-medium"
                        style={{ color: "rgba(255, 255, 255, 0.9)" }}
                      >
                        Was this review helpful?
                      </p>

                      {/* Helpful/Not Helpful Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsHelpful(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors"
                          style={{
                            background:
                              isHelpful === true
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(255, 255, 255, 0.08)",
                            border:
                              isHelpful === true
                                ? "1px solid rgba(16, 185, 129, 0.5)"
                                : "1px solid transparent",
                            color: isHelpful === true ? "#10B981" : "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Helpful
                        </button>
                        <button
                          onClick={() => setIsHelpful(false)}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors"
                          style={{
                            background:
                              isHelpful === false
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(255, 255, 255, 0.08)",
                            border:
                              isHelpful === false
                                ? "1px solid rgba(239, 68, 68, 0.5)"
                                : "1px solid transparent",
                            color: isHelpful === false ? "#EF4444" : "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Not Helpful
                        </button>
                      </div>

                      {/* Star Rating */}
                      <div>
                        <p
                          className="text-xs mb-2"
                          style={{ color: "rgba(255, 255, 255, 0.5)" }}
                        >
                          Rate from 1-5 stars
                        </p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setHelpfulnessRating(star)}
                              className="p-1 transition-transform hover:scale-110"
                            >
                              <Star
                                className="w-6 h-6"
                                style={{
                                  color:
                                    star <= helpfulnessRating ? "#F59E0B" : "rgba(255, 255, 255, 0.2)",
                                  fill: star <= helpfulnessRating ? "#F59E0B" : "transparent",
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comment */}
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Optional: Add a comment about this review..."
                        rows={2}
                        className="w-full p-2 rounded-lg text-sm resize-none"
                        style={{
                          background: "rgba(0, 0, 0, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "rgba(255, 255, 255, 0.9)",
                        }}
                      />

                      {/* Submit/Cancel */}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setRatingReview(null);
                            setIsHelpful(null);
                            setHelpfulnessRating(3);
                            setRatingComment("");
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg"
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "rgba(255, 255, 255, 0.6)",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSubmitRating(review.id)}
                          disabled={isHelpful === null || isSubmitting}
                          className="px-3 py-1.5 text-sm rounded-lg font-medium"
                          style={{
                            background:
                              isHelpful !== null
                                ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                                : "rgba(255, 255, 255, 0.1)",
                            color: isHelpful !== null ? "#fff" : "rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          {isSubmitting ? "Submitting..." : "Submit Rating"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
