import { useState, useEffect } from "react";
import {
  LiveSession,
  SessionRegistration,
  getSession,
  joinSession,
  leaveSession,
  getSessionStatus,
  formatSessionDuration,
  getSessionTypeLabel,
} from "./api/live-sessions";
import { SessionQA } from "./SessionQA";
import { SessionPolls } from "./SessionPolls";

interface LiveSessionViewerProps {
  sessionId: string;
  userId: string;
  isInstructor?: boolean;
}

interface SessionFeedbackFormProps {
  sessionId: string;
  userId: string;
  onSubmit: () => void;
}

function SessionFeedbackForm({ sessionId, userId, onSubmit }: SessionFeedbackFormProps) {
  const [ratings, setRatings] = useState({
    overall: 0,
    content: 0,
    presenter: 0,
    tech: 0,
  });
  const [comments, setComments] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { submitFeedback } = await import("./api/live-sessions");
      await submitFeedback(sessionId, userId, {
        overall_rating: ratings.overall,
        content_rating: ratings.content || undefined,
        presenter_rating: ratings.presenter || undefined,
        tech_rating: ratings.tech || undefined,
        comments: comments || undefined,
        would_recommend: wouldRecommend ?? undefined,
      });
      onSubmit();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
    label,
  }: {
    value: number;
    onChange: (v: number) => void;
    label: string;
  }) => (
    <div className="mb-4">
      <label className="block text-sm text-gray-400 mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 transition-colors"
          >
            <svg
              className={`w-8 h-8 ${star <= value ? "text-yellow-400" : "text-gray-600"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Session Feedback</h3>

      <StarRating
        value={ratings.overall}
        onChange={(v) => setRatings((prev) => ({ ...prev, overall: v }))}
        label="Overall Experience *"
      />

      <StarRating
        value={ratings.content}
        onChange={(v) => setRatings((prev) => ({ ...prev, content: v }))}
        label="Content Quality"
      />

      <StarRating
        value={ratings.presenter}
        onChange={(v) => setRatings((prev) => ({ ...prev, presenter: v }))}
        label="Presenter"
      />

      <StarRating
        value={ratings.tech}
        onChange={(v) => setRatings((prev) => ({ ...prev, tech: v }))}
        label="Technical Quality"
      />

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Would you recommend this session?</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setWouldRecommend(true)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              wouldRecommend === true
                ? "border-green-500 bg-green-500/20 text-green-400"
                : "border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldRecommend(false)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              wouldRecommend === false
                ? "border-red-500 bg-red-500/20 text-red-400"
                : "border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            No
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">Additional Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || ratings.overall === 0}
        className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {isSubmitting ? "Submitting..." : "Submit Feedback"}
      </button>
    </form>
  );
}

export function LiveSessionViewer({
  sessionId,
  userId,
  isInstructor = false,
}: LiveSessionViewerProps) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [registration, setRegistration] = useState<SessionRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stream" | "qa" | "polls">("stream");
  const [hasJoined, setHasJoined] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId, userId]);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const data = await getSession(sessionId, userId);
      setSession(data.session);
      setRegistration(data.registration);
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      const result = await joinSession(sessionId, userId);
      setHasJoined(true);
      if (result.meeting_url) {
        // Open meeting in new tab
        window.open(result.meeting_url, "_blank");
      }
    } catch (error) {
      console.error("Failed to join session:", error);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveSession(sessionId, userId);
      setHasJoined(false);
      // Show feedback form after leaving
      if (session?.status === "ended" || session?.status === "live") {
        setShowFeedback(true);
      }
    } catch (error) {
      console.error("Failed to leave session:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center text-gray-400 p-8">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>Session not found</p>
      </div>
    );
  }

  const status = getSessionStatus(session);
  const startDate = new Date(session.scheduled_start);

  // Show feedback form after session
  if (showFeedback && !feedbackSubmitted) {
    return (
      <div className="max-w-lg mx-auto">
        <SessionFeedbackForm
          sessionId={sessionId}
          userId={userId}
          onSubmit={() => setFeedbackSubmitted(true)}
        />
      </div>
    );
  }

  // Feedback submitted
  if (feedbackSubmitted) {
    return (
      <div className="text-center p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
        <p className="text-gray-400">Your feedback helps us improve future sessions.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content Area */}
      <div className="lg:col-span-2 space-y-6">
        {/* Session Header */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-sm text-gray-400">{getSessionTypeLabel(session.session_type)}</span>
              <h1 className="text-2xl font-bold text-white">{session.title}</h1>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                status.isLive
                  ? "bg-green-500/20 text-green-400"
                  : status.isUpcoming
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {status.isLive && <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />}
              {status.label}
            </span>
          </div>

          {session.description && (
            <p className="text-gray-300 mb-4">{session.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{startDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ({formatSessionDuration(session)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="capitalize">{session.platform}</span>
            </div>
          </div>
        </div>

        {/* Video/Stream Area */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
          {status.isLive && hasJoined ? (
            <div className="aspect-video bg-black flex items-center justify-center relative">
              {session.platform === "internal" ? (
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p>Internal streaming not yet implemented</p>
                  <p className="text-sm mt-1">Use external meeting link</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p>Joined via {session.platform}</p>
                  {session.meeting_url && (
                    <a
                      href={session.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      Open in {session.platform}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              {/* Leave Button */}
              <button
                onClick={handleLeave}
                className="absolute top-4 right-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Leave Session
              </button>
            </div>
          ) : status.isLive && registration ? (
            <div className="aspect-video bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Session is Live!</h3>
                <p className="text-gray-400 mb-6">Click below to join the session</p>
                <button
                  onClick={handleJoin}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  Join Now
                </button>
              </div>
            </div>
          ) : status.isUpcoming ? (
            <div className="aspect-video bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Session Starts Soon</h3>
                <p className="text-gray-400 mb-2">
                  {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </p>
                {registration && (
                  <span className="inline-flex items-center gap-2 text-green-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You're registered
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-900/50 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>Session has ended</p>
                {session.recording_available && session.recording_url && (
                  <a
                    href={session.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Watch Recording
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Q&A and Polls */}
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex bg-white/5 rounded-lg p-1">
          {(["stream", "qa", "polls"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "stream" ? "Info" : tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "stream" && (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-4">Session Info</h3>

            {/* Points */}
            {session.points_for_attending > 0 && (
              <div className="flex items-center gap-2 text-yellow-400 mb-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>+{session.points_for_attending} points for attending</span>
              </div>
            )}

            {/* Mandatory */}
            {session.is_mandatory && (
              <div className="flex items-center gap-2 text-red-400 mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Required session</span>
              </div>
            )}

            {/* Registration Status */}
            {registration && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-3">
                <div className="flex items-center gap-2 text-green-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Registered</span>
                </div>
                {registration.attendance_duration > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Attended: {registration.attendance_duration} minutes ({Math.round(registration.attendance_percent)}%)
                  </p>
                )}
                {registration.points_earned > 0 && (
                  <p className="text-sm text-yellow-400 mt-1">
                    +{registration.points_earned} points earned
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "qa" && (
          <SessionQA
            sessionId={sessionId}
            userId={userId}
            isInstructor={isInstructor}
            isLive={status.isLive}
          />
        )}

        {activeTab === "polls" && (
          <SessionPolls
            sessionId={sessionId}
            userId={userId}
            isInstructor={isInstructor}
            isLive={status.isLive}
          />
        )}
      </div>
    </div>
  );
}

export default LiveSessionViewer;
