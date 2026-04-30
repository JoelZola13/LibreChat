import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  MessageSquare,
  User,
  Edit2,
  Trash2,
  Send,
  ThumbsUp,
} from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type Review = {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  review_text?: string | null;
  created_at: string;
  updated_at: string;
};

type RatingStats = {
  average: number;
  count: number;
  distribution: Record<number, number>;
};

type CourseReviewsProps = {
  courseId: string;
  userId: string;
  courseName?: string;
  canWriteReview?: boolean;
};

function StarRating({
  rating,
  onRate,
  size = "md",
  interactive = false,
}: {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={`${interactive ? "cursor-pointer" : "cursor-default"}`}
          disabled={!interactive}
        >
          <Star
            className={`${sizeClasses[size]} transition-colors ${
              star <= (hoverRating || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function CourseReviews({ courseId, userId, courseName, canWriteReview = true }: CourseReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ rating: 5, review_text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const loadData = async () => {
    try {
      const [reviewsResp, statsResp, userReviewResp] = await Promise.all([
        sbFetch(`/api/academy/reviews/course/${courseId}`),
        sbFetch(`/api/academy/reviews/course/${courseId}/stats`),
        sbFetch(`/api/academy/reviews/user/${userId}/course/${courseId}`),
      ]);

      if (reviewsResp.ok) {
        const data = await reviewsResp.json();
        setReviews(Array.isArray(data) ? data : []);
      }

      if (statsResp.ok) {
        const data = await statsResp.json();
        setStats(data);
      }

      if (userReviewResp.ok) {
        const data = await userReviewResp.json();
        if (data) {
          setUserReview(data);
        }
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const endpoint = editingReview
        ? `/api/academy/reviews/${editingReview.id}`
        : `/api/academy/reviews`;
      const method = editingReview ? "PATCH" : "POST";

      const body = editingReview
        ? { rating: formData.rating, review_text: formData.review_text || null }
        : {
            user_id: userId,
            course_id: courseId,
            rating: formData.rating,
            review_text: formData.review_text || null,
          };

      const resp = await sbFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        setShowForm(false);
        setEditingReview(null);
        setFormData({ rating: 5, review_text: "" });
        loadData();
      }
    } catch (e) {
      console.error("Failed to submit review:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete your review?")) return;

    try {
      const resp = await sbFetch(`/api/academy/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (resp.ok) {
        setUserReview(null);
        loadData();
      }
    } catch (e) {
      console.error("Failed to delete review:", e);
    }
  };

  const handleEdit = (review: Review) => {
    setEditingReview(review);
    setFormData({
      rating: review.rating,
      review_text: review.review_text || "",
    });
    setShowForm(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Rating Summary */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-yellow-400" />
          Reviews & Ratings
        </h3>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Overall Rating */}
          <div className="text-center md:border-r md:border-gray-800 md:pr-8">
            <div className="text-5xl font-bold text-yellow-400 mb-2">
              {stats?.average ? stats.average.toFixed(1) : "0.0"}
            </div>
            <StarRating rating={Math.round(stats?.average || 0)} size="md" />
            <p className="text-gray-500 text-sm mt-2">
              {stats?.count || 0} {stats?.count === 1 ? "review" : "reviews"}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats?.distribution?.[star] || 0;
              const percentage =
                stats?.count && stats.count > 0
                  ? (count / stats.count) * 100
                  : 0;

              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm text-gray-400">{star}</span>
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className="bg-yellow-400 h-2 rounded-full"
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Write Review Button */}
        {!userReview && !showForm && canWriteReview && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 transition-colors"
          >
            <Edit2 className="w-5 h-5" />
            Write a Review
          </motion.button>
        )}

        {!canWriteReview && (
          <div className="mt-6 rounded-xl border border-gray-800 bg-black/20 px-4 py-3 text-sm text-gray-400">
            Enroll in this course to leave your own rating and quick review.
          </div>
        )}
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSubmit}
              className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-lg">
                  {editingReview ? "Edit Your Review" : "Write a Review"}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingReview(null);
                    setFormData({ rating: 5, review_text: "" });
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Your Rating
                </label>
                <StarRating
                  rating={formData.rating}
                  onRate={(rating) => setFormData({ ...formData, rating })}
                  size="lg"
                  interactive
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Your Review (optional)
                </label>
                <textarea
                  value={formData.review_text}
                  onChange={(e) =>
                    setFormData({ ...formData, review_text: e.target.value })
                  }
                  placeholder={`Share your experience with ${courseName || "this course"}...`}
                  rows={4}
                  className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-400 text-black rounded-xl font-bold hover:bg-yellow-300 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {editingReview ? "Update Review" : "Submit Review"}
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User's Review (if exists and form not showing) */}
      {userReview && !showForm && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
                <User className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-medium">Your Review</p>
                <p className="text-xs text-gray-500">{formatDate(userReview.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(userReview)}
                className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(userReview.id)}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <StarRating rating={userReview.rating} size="sm" />
          {userReview.review_text && (
            <p className="mt-3 text-gray-300">{userReview.review_text}</p>
          )}
        </div>
      )}

      {/* Other Reviews */}
      <div className="space-y-4">
        {reviews
          .filter((r) => r.user_id !== userId)
          .map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-900/30 border border-gray-800 rounded-xl p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-300">
                      User {review.user_id.slice(-4)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                  <StarRating rating={review.rating} size="sm" />
                </div>
              </div>
              {review.review_text && (
                <p className="text-gray-400 ml-13">{review.review_text}</p>
              )}
            </motion.div>
          ))}

        {reviews.filter((r) => r.user_id !== userId).length === 0 &&
          !userReview && (
            <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-gray-800">
              <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No reviews yet</p>
              <p className="text-gray-600 text-sm">Be the first to review this course!</p>
            </div>
          )}
      </div>
    </div>
  );
}
