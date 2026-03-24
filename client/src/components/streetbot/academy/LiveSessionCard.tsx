import { useState } from "react";
import {
  LiveSession,
  SessionRegistration,
  getSessionStatus,
  formatSessionDuration,
  getSessionTypeLabel,
  registerForSession,
  cancelRegistration,
} from "./api/live-sessions";

interface LiveSessionCardProps {
  session: LiveSession;
  registration?: SessionRegistration | null;
  userId?: string;
  onRegister?: () => void;
  onJoin?: () => void;
  showCourseLink?: boolean;
}

export function LiveSessionCard({
  session,
  registration,
  userId,
  onRegister,
  onJoin,
  showCourseLink = false,
}: LiveSessionCardProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(!!registration);
  const [error, setError] = useState<string | null>(null);

  const status = getSessionStatus(session);
  const startDate = new Date(session.scheduled_start);
  const duration = formatSessionDuration(session);

  const handleRegister = async () => {
    if (!userId) return;
    setIsRegistering(true);
    setError(null);
    try {
      await registerForSession(session.id, userId);
      setIsRegistered(true);
      onRegister?.();
    } catch (err) {
      setError("Failed to register. Session may be full.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!userId) return;
    setIsRegistering(true);
    setError(null);
    try {
      await cancelRegistration(session.id, userId);
      setIsRegistered(false);
      onRegister?.();
    } catch (err) {
      setError("Failed to cancel registration.");
    } finally {
      setIsRegistering(false);
    }
  };

  const statusColors: Record<string, string> = {
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    gray: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const sessionTypeIcons: Record<string, string> = {
    webinar: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    workshop: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    office_hours: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    class: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Session Type Icon */}
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={sessionTypeIcons[session.session_type] || sessionTypeIcons.webinar} />
            </svg>
          </div>
          <div>
            <span className="text-xs text-gray-400">{getSessionTypeLabel(session.session_type)}</span>
            <h3 className="font-semibold text-white">{session.title}</h3>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusColors[status.color]}`}>
          {status.isLive && (
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
          )}
          {status.label}
        </span>
      </div>

      {/* Description */}
      {session.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{session.description}</p>
      )}

      {/* Session Details */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{startDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{duration}</span>
        </div>

        {/* Platform */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="capitalize">{session.platform}</span>
        </div>
      </div>

      {/* Points Badge */}
      {session.points_for_attending > 0 && (
        <div className="flex items-center gap-2 text-sm text-yellow-400 mb-4">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>+{session.points_for_attending} points for attending</span>
        </div>
      )}

      {/* Mandatory Badge */}
      {session.is_mandatory && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Required session</span>
        </div>
      )}

      {/* Recording Available */}
      {session.recording_available && session.recording_url && (
        <a
          href={session.recording_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Watch Recording</span>
        </a>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-400 mb-4">{error}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status.isLive && isRegistered && (
          <button
            onClick={onJoin}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Join Now
          </button>
        )}

        {status.isUpcoming && !isRegistered && userId && (
          <button
            onClick={handleRegister}
            disabled={isRegistering}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {isRegistering ? "Registering..." : "Register"}
          </button>
        )}

        {status.isUpcoming && isRegistered && (
          <>
            <span className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 font-medium rounded-lg text-center">
              Registered
            </span>
            <button
              onClick={handleCancelRegistration}
              disabled={isRegistering}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {status.isPast && !session.recording_available && (
          <span className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 font-medium rounded-lg text-center">
            Session Ended
          </span>
        )}
      </div>
    </div>
  );
}

export default LiveSessionCard;
