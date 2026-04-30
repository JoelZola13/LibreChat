import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, Lock, PlayCircle, Video } from "lucide-react";
import { useLocation } from "react-router-dom";
import { LiveSessionCard } from "./LiveSessionCard";
import {
  getUserAllSessions,
  listSessions,
  type LiveSession,
  type SessionRegistration,
} from "./api/live-sessions";
import { useAcademyUserId } from "./useAcademyUserId";
import { sbFetch } from "../shared/sbFetch";
import { getLearningPathCourseMap } from "./academyLearningPaths";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { useAcademyEnrollmentAccess } from "./useAcademyEnrollmentAccess";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  status: "active" | "completed" | "dropped";
};

function formatCountdown(isoDate: string) {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) {
    return "Starting now";
  }

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 60) {
    return `Starts in ${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `Starts in ${totalHours}h ${totalMinutes % 60}m`;
  }

  const totalDays = Math.floor(totalHours / 24);
  return `Starts in ${totalDays}d ${totalHours % 24}h`;
}

export default function AcademyLivePage() {
  const userId = useAcademyUserId();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const { paths: learningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const { hasEnrollment, loading: accessLoading } = useAcademyEnrollmentAccess();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, SessionRegistration>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.42)",
      cardBgStrong: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.58)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.5)" : "#6b7280",
      accent: "#10B981",
      shadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.35)" : "0 10px 30px rgba(31, 38, 135, 0.16)",
    }),
    [isDark],
  );

  useEffect(() => {
    async function load() {
      try {
        const [sessionResponse, userSessionResponse, coursesResp, enrollmentsResp] = await Promise.all([
          listSessions({ userId }),
          getUserAllSessions(userId).catch(() => ({ sessions: [], total: 0 })),
          sbFetch("/api/academy/courses"),
          sbFetch(`/api/academy/enrollments?user_id=${encodeURIComponent(userId)}`),
        ]);

        setSessions(sessionResponse.sessions || []);
        setRegistrations(
          Object.fromEntries(
            (userSessionResponse.sessions || []).map(({ registration }) => [registration.session_id, registration]),
          ),
        );

        if (coursesResp.ok) {
          const courseData = await coursesResp.json();
          setCourses(Array.isArray(courseData) ? courseData : []);
        }

        if (enrollmentsResp.ok) {
          const enrollmentData = await enrollmentsResp.json();
          setEnrollments(Array.isArray(enrollmentData) ? enrollmentData : []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  const courseTitleById = useMemo(
    () =>
      Object.fromEntries(
        courses.map((course) => [course.id, course.title]),
      ),
    [courses],
  );

  const coursePathMap = useMemo(() => getLearningPathCourseMap(courses, learningPaths), [courses, learningPaths]);

  const recommendedPath = useMemo(() => {
    const rankedPaths = learningPaths
      .map((path) => {
        const matchedEnrollments = enrollments.filter((enrollment) =>
          (coursePathMap.get(enrollment.course_id) ?? []).some((linkedPath) => linkedPath.slug === path.slug),
        );

        return {
          path,
          matchedCount: matchedEnrollments.length,
          totalProgress: matchedEnrollments.reduce((sum, enrollment) => sum + enrollment.progress_percent, 0),
        };
      })
      .sort((left, right) => {
        if (right.matchedCount !== left.matchedCount) {
          return right.matchedCount - left.matchedCount;
        }
        return right.totalProgress - left.totalProgress;
      });

    return (
      rankedPaths.find((entry) => entry.matchedCount > 0)?.path ??
      learningPaths.find((path) => path.slug === "digital-basics") ??
      learningPaths[0]
    );
  }, [coursePathMap, enrollments, learningPaths]);

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.filter((entry) => entry.status !== "dropped").map((entry) => entry.course_id)),
    [enrollments],
  );

  const recommendedCourseIds = useMemo(() => {
    if (enrolledCourseIds.size > 0) {
      return enrolledCourseIds;
    }

    const fallbackIds = new Set<string>();
    courses.forEach((course) => {
      if ((coursePathMap.get(course.id) ?? []).some((path) => path.slug === recommendedPath?.slug)) {
        fallbackIds.add(course.id);
      }
    });
    return fallbackIds;
  }, [coursePathMap, courses, enrolledCourseIds, recommendedPath]);

  const liveNow = useMemo(
    () => sessions.filter((session) => session.status === "live"),
    [sessions],
  );

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return [...sessions]
      .filter((session) => session.status === "scheduled" && new Date(session.scheduled_end).getTime() >= now)
      .sort((left, right) => new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime());
  }, [sessions]);

  const replaySessions = useMemo(() => {
    const now = Date.now();
    return [...sessions]
      .filter(
        (session) =>
          session.recording_available &&
          !!session.recording_url &&
          (session.status === "ended" || new Date(session.scheduled_end).getTime() < now),
      )
      .sort((left, right) => new Date(right.scheduled_start).getTime() - new Date(left.scheduled_start).getTime());
  }, [sessions]);

  const recommendedSessions = useMemo(() => {
    return upcomingSessions.filter((session) => recommendedCourseIds.has(session.course_id)).slice(0, 3);
  }, [recommendedCourseIds, upcomingSessions]);

  const upcomingByDay = useMemo(() => {
    const groups = new Map<string, LiveSession[]>();
    upcomingSessions.slice(0, 6).forEach((session) => {
      const label = new Date(session.scheduled_start).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const existing = groups.get(label) ?? [];
      groups.set(label, [...existing, session]);
    });
    return Array.from(groups.entries());
  }, [upcomingSessions]);

  if (!accessLoading && !hasEnrollment) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <Lock className="mx-auto mb-4 h-12 w-12" style={{ color: colors.accent }} />
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Enroll to unlock Live</h1>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              Start with a program or course first, then your live sessions will open here.
            </p>
            <a
              href={`${basePath}/paths`}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              style={{ background: colors.accent, color: "#000" }}
            >
              Choose a path
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={basePath} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Academy
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            Live Sessions
          </span>
        </div>

        <section
          className="rounded-[28px] border p-6 md:p-8"
          style={{ borderColor: colors.border, background: colors.cardBg, boxShadow: colors.shadow }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                Live Sessions
              </h1>
              <p className="mt-3 max-w-2xl text-sm" style={{ color: colors.textSecondary }}>
                Join live, check upcoming, or watch a replay.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Live now", value: liveNow.length, icon: Video, color: colors.accent },
                  { label: "Upcoming", value: upcomingSessions.length, icon: CalendarDays, color: "#8B5CF6" },
                  { label: "Replays", value: replaySessions.length, icon: PlayCircle, color: "#60A5FA" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                  >
                    <item.icon className="h-5 w-5" style={{ color: item.color }} />
                    <p className="mt-3 text-2xl font-bold" style={{ color: colors.text }}>
                      {item.value}
                    </p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-[24px] border p-5"
              style={{ borderColor: colors.border, background: colors.cardBgStrong }}
            >
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                Recommended based on your courses
              </p>
              <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                {recommendedSessions[0]?.title ?? "Your next live learning moment"}
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                {recommendedSessions[0]
                  ? `From ${courseTitleById[recommendedSessions[0].course_id] ?? "your course"}.`
                  : `From ${recommendedPath?.title ?? "your path"}.`}
              </p>
              {recommendedSessions[0] && (
                <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {recommendedSessions[0].title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                        {courseTitleById[recommendedSessions[0].course_id] ?? "Academy session"}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ background: "rgba(16,185,129,0.12)", color: colors.accent }}
                    >
                      {formatCountdown(recommendedSessions[0].scheduled_start)}
                    </span>
                  </div>
                </div>
              )}
              <a
                href={recommendedSessions[0] ? `${basePath}/live-sessions/${recommendedSessions[0].id}` : `${basePath}/courses`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: colors.accent }}
              >
                {recommendedSessions[0] ? "Open recommended session" : "Continue your course work"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Live Now
            </h2>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((card) => (
                <div key={card} className="h-52 rounded-[28px]" style={{ background: colors.cardBg, border: `1px solid ${colors.border}` }} />
              ))}
            </div>
          ) : liveNow.length === 0 ? (
            <div className="rounded-[28px] border p-8 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
              <Video className="mx-auto mb-4 h-10 w-10" style={{ color: colors.accent }} />
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                No live sessions at this moment
              </h3>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {liveNow.map((session) => (
                <div key={session.id} className="space-y-3">
                  <LiveSessionCard
                    session={session}
                    registration={registrations[session.id] ?? null}
                    userId={userId}
                    onRegister={() => window.location.reload()}
                    onJoin={() => {
                      window.location.href = `${basePath}/live-sessions/${session.id}`;
                    }}
                  />
                  <a
                    href={`${basePath}/live-sessions/${session.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: colors.accent }}
                  >
                    Join Live Now
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="mb-5 text-2xl font-semibold" style={{ color: colors.text }}>
              Upcoming Sessions
            </h2>

            <div className="space-y-4">
              {upcomingSessions.slice(0, 4).map((session) => (
                <div
                  key={session.id}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {session.title}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                        {courseTitleById[session.course_id] ?? "Academy session"}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ background: "rgba(16,185,129,0.12)", color: colors.accent }}
                    >
                      {formatCountdown(session.scheduled_start)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: colors.textMuted }}>
                    <span>{new Date(session.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span>{new Date(session.scheduled_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="capitalize">{session.platform}</span>
                  </div>
                  <a
                    href={`${basePath}/live-sessions/${session.id}`}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: colors.accent }}
                  >
                    Open session
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}

              {!loading && upcomingSessions.length === 0 && (
                <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                  No upcoming sessions are scheduled yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
            <h2 className="mb-5 text-2xl font-semibold" style={{ color: colors.text }}>
              Calendar View
            </h2>

            <div className="space-y-4">
              {upcomingByDay.map(([dayLabel, daySessions]) => (
                <div
                  key={dayLabel}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" style={{ color: "#8B5CF6" }} />
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>
                      {dayLabel}
                    </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {daySessions.map((session) => (
                      <div key={session.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: colors.text }}>
                            {session.title}
                          </p>
                          <p className="text-xs" style={{ color: colors.textMuted }}>
                            {courseTitleById[session.course_id] ?? "Academy session"}
                          </p>
                        </div>
                        <div className="text-right text-xs" style={{ color: colors.textMuted }}>
                          <p>{new Date(session.scheduled_start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                          <p className="mt-1 inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatCountdown(session.scheduled_start)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!loading && upcomingByDay.length === 0 && (
                <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                  Once new sessions are scheduled, the calendar view will populate here automatically.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-5 text-2xl font-semibold" style={{ color: colors.text }}>
            Replay Library
          </h2>

          {replaySessions.length === 0 ? (
            <div className="rounded-[28px] border p-8 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
              <PlayCircle className="mx-auto mb-4 h-10 w-10" style={{ color: "#60A5FA" }} />
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                No replays yet
              </h3>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {replaySessions.slice(0, 6).map((session) => (
                <a
                  key={session.id}
                  href={session.recording_url ?? `${basePath}/live-sessions/${session.id}`}
                  className="rounded-[24px] border p-5 transition-colors hover:border-white/30"
                  style={{ borderColor: colors.border, background: colors.cardBg }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.text }}>
                        {session.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                        {courseTitleById[session.course_id] ?? "Academy session"}
                      </p>
                    </div>
                    <PlayCircle className="h-5 w-5" style={{ color: "#60A5FA" }} />
                  </div>
                  <p className="mt-4 text-xs" style={{ color: colors.textSecondary }}>
                    Replay from{" "}
                    {new Date(session.scheduled_start).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
