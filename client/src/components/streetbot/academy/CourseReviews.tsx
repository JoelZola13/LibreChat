import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquare, Star } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type Review = {
  id: string;
  user_id: string;
  user_name?: string | null;
  course_id: string;
  rating: number;
  review_text?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  workshop_feedback?: string | null;
  rating_reason?: string | null;
  other_feedback?: string | null;
  created_at: string;
  updated_at: string;
};

type CourseReviewsProps = {
  courseId: string;
  userId: string;
  courseName?: string;
  canWriteReview?: boolean;
};

type ReviewFormState = {
  firstName: string;
  lastName: string;
  email: string;
  workshopFeedback: string;
  rating: number;
  ratingReason: string;
  otherFeedback: string;
};

const EMPTY_FORM: ReviewFormState = {
  firstName: "",
  lastName: "",
  email: "",
  workshopFeedback: "",
  rating: 5,
  ratingReason: "",
  otherFeedback: "",
};

function StarPicker({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (value: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const activeValue = hoverRating || rating;
        const isActive = starValue <= activeValue;

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            className="transition-transform duration-150 hover:-translate-y-0.5"
            aria-label={`Rate ${starValue} out of 5`}
          >
            <Star
              className="h-7 w-7"
              style={{
                color: isActive ? "#FFD600" : "rgba(255,255,255,0.28)",
                fill: isActive ? "#FFD600" : "transparent",
              }}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm font-medium text-gray-300">{rating}/5</span>
    </div>
  );
}

function mapReviewToForm(review: Review): ReviewFormState {
  return {
    firstName: review.first_name || "",
    lastName: review.last_name || "",
    email: review.email || "",
    workshopFeedback: review.workshop_feedback || review.review_text || "",
    rating: Number(review.rating || 5),
    ratingReason: review.rating_reason || "",
    otherFeedback: review.other_feedback || "",
  };
}

export function CourseReviews({ courseId, userId, courseName, canWriteReview = true }: CourseReviewsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [formData, setFormData] = useState<ReviewFormState>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const colors = useMemo(
    () => ({
      cardBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.62)",
      cardBgStrong: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.78)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
      accent: "#FFD600",
    }),
    [isDark],
  );

  useEffect(() => {
    async function loadReview() {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await sbFetch(`/api/academy/reviews/user/${userId}/course/${courseId}`);
        if (!response.ok) {
          throw new Error(`Failed to load course feedback form (${response.status})`);
        }

        const data = await response.json();
        if (data) {
          setUserReview(data);
          setFormData(mapReviewToForm(data));
        } else {
          setUserReview(null);
          setFormData(EMPTY_FORM);
        }
      } catch (error) {
        console.error("Failed to load course review form:", error);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load this feedback form right now.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadReview();
  }, [courseId, userId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const endpoint = userReview ? `/api/academy/reviews/${userReview.id}` : "/api/academy/reviews";
      const method = userReview ? "PATCH" : "POST";
      const body = {
        user_id: userId,
        course_id: courseId,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        workshop_feedback: formData.workshopFeedback.trim() || null,
        rating: formData.rating,
        rating_reason: formData.ratingReason.trim() || null,
        other_feedback: formData.otherFeedback.trim() || null,
        review_text: formData.workshopFeedback.trim() || null,
      };

      const response = await sbFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to save course feedback (${response.status})`);
      }

      const data = await response.json();
      setUserReview(data);
      setFormData(mapReviewToForm(data));
      setSuccessMessage(
        userReview
          ? "Your course feedback has been updated."
          : "Your course feedback has been submitted and shared with the instructor.",
      );
    } catch (error) {
      console.error("Failed to submit course feedback:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit your feedback right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<Key extends keyof ReviewFormState>(key: Key, value: ReviewFormState[Key]) {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-[24px] border px-5 py-4" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading feedback form...
      </div>
    );
  }

  if (!canWriteReview) {
    return (
      <div className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(255,214,0,0.12)", color: colors.accent }}>
          <MessageSquare className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold" style={{ color: colors.text }}>
          Enroll to leave feedback
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
          Once you enroll in {courseName || "this course"}, you can fill out the review form and send your workshop feedback directly to the instructor workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
              Student feedback
            </p>
            <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
              Share your workshop experience
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
              Your submitted feedback goes straight to the instructor course workspace under Course Feedback.
            </p>
          </div>
          {userReview ? (
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}>
              <CheckCircle2 className="h-4 w-4" />
              Feedback saved
            </div>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[20px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.08)", color: "#34D399" }}>
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              First name
            </span>
            <input
              value={formData.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              required
              className="rounded-[18px] border px-4 py-3 text-sm outline-none"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              Last name
            </span>
            <input
              value={formData.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              required
              className="rounded-[18px] border px-4 py-3 text-sm outline-none"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            Email
          </span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
              className="w-full rounded-[18px] border py-3 pl-11 pr-4 text-sm outline-none"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
            />
          </div>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            What did you like or dislike about the workshop
          </span>
          <textarea
            value={formData.workshopFeedback}
            onChange={(event) => updateField("workshopFeedback", event.target.value)}
            rows={5}
            required
            className="rounded-[18px] border px-4 py-3 text-sm outline-none"
            style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text, resize: "vertical" }}
          />
        </label>

        <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            How would you rate this program
          </span>
          <div className="mt-3">
            <StarPicker rating={formData.rating} onChange={(value) => updateField("rating", value)} />
          </div>

          <label className="mt-5 grid gap-2">
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              Why?
            </span>
            <textarea
              value={formData.ratingReason}
              onChange={(event) => updateField("ratingReason", event.target.value)}
              rows={4}
              required
              className="rounded-[18px] border px-4 py-3 text-sm outline-none"
              style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text, resize: "vertical" }}
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            Any other feedback
          </span>
          <textarea
            value={formData.otherFeedback}
            onChange={(event) => updateField("otherFeedback", event.target.value)}
            rows={4}
            className="rounded-[18px] border px-4 py-3 text-sm outline-none"
            style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text, resize: "vertical" }}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Enrolled learners can update their feedback anytime.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: colors.accent, color: "#000" }}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {userReview ? "Update Feedback" : "Submit Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
}
