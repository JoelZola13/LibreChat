import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileQuestion, Loader2 } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import {
  getCourseSubmissionList,
  type CourseSubmissionListItem,
} from "./api/assignments";
import { useAcademyUserId } from "./useAcademyUserId";
import { sbFetch } from "../shared/sbFetch";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  instructor_id?: string | null;
  instructor_name?: string | null;
};

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not submitted yet";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatGrade(row: CourseSubmissionListItem): string {
  if (typeof row.score !== "number") {
    return "Needs review";
  }

  const roundedScore = Number.isInteger(row.score) ? row.score.toString() : row.score.toFixed(1);
  return row.letterGrade
    ? `${roundedScore}/${row.maxPoints} · ${row.letterGrade}`
    : `${roundedScore}/${row.maxPoints}`;
}

export default function AcademyInstructorSubmissionListPage() {
  const params = useParams();
  const location = useLocation();
  const instructorId = useAcademyUserId();
  const courseId = params.courseId || "";
  const isQuizList = location.pathname.includes("/submissions/quizzes");
  const submissionType = isQuizList ? "quiz" : "assignment";
  const basePath = location.pathname.startsWith("/learning") ? "/learning/instructor" : "/academy/instructor";
  const academyRootPath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  const [course, setCourse] = useState<Course | null>(null);
  const [rows, setRows] = useState<CourseSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = useMemo(
    function () {
      return {
        bg: "var(--sb-color-background)",
        cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.56)",
        cardBgStrong: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
        border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
        text: isDark ? "#fff" : "#111",
        textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
        textMuted: isDark ? "rgba(255,255,255,0.45)" : "#6b7280",
        accent: "#F97316",
      };
    },
    [isDark],
  );

  const summary = useMemo(
    function () {
      const graded = rows.filter(function (row) {
        return typeof row.score === "number";
      }).length;
      return {
        total: rows.length,
        graded,
        pending: Math.max(rows.length - graded, 0),
      };
    },
    [rows],
  );

  useEffect(
    function () {
      let active = true;

      async function loadPage() {
        setLoading(true);
        try {
          const [courseResponse, submissionRows] = await Promise.all([
            sbFetch("/api/academy/courses/" + courseId),
            getCourseSubmissionList(courseId, submissionType),
          ]);

          const nextCourse = courseResponse.ok ? await courseResponse.json() : null;
          if (!active) {
            return;
          }

          setCourse(nextCourse);
          setRows(submissionRows);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadPage();

      return function () {
        active = false;
      };
    },
    [courseId, submissionType],
  );

  const pageTitle = isQuizList ? "Quiz submissions" : "Assignment submissions";
  const pageDescription = isQuizList
    ? "See the latest quiz results from students currently enrolled in this course."
    : "See the latest assignment work from students currently enrolled in this course.";
  const EmptyIcon = isQuizList ? FileQuestion : ClipboardList;

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={academyRootPath} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Academy
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <a href={basePath + "/courses"} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Instructor Courses
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <a href={basePath + "/courses/" + courseId} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            {course?.title || "Course Workspace"}
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            {pageTitle}
          </span>
        </div>

        {loading ? (
          <div className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading submissions...
            </div>
          </div>
        ) : course ? (
          course.instructor_id !== instructorId ? (
            <section className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                Instructor Workspace
              </p>
              <h1 className="mt-3 text-2xl font-semibold md:text-3xl" style={{ color: colors.text }}>
                You no longer have access to this course
              </h1>
              <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                This submission list only works for instructors who are currently teaching the course.
              </p>
              <a
                href={`${basePath}/courses`}
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: "#fff" }}
              >
                Back to Courses
              </a>
            </section>
          ) : (
            <>
              <section className="rounded-[28px] border p-6 md:p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
                <a href={basePath + "/courses/" + courseId} className="text-sm font-semibold" style={{ color: colors.accent }}>
                  Back to Grading &amp; Feedback
                </a>
                <p className="mt-4 text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                  Instructor Course Workspace
                </p>
                <h1 className="mt-2 text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                  {pageTitle}
                </h1>
                <p className="mt-3 max-w-3xl text-base" style={{ color: colors.textSecondary }}>
                  {pageDescription}
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Total submissions", value: summary.total },
                    { label: "Graded", value: summary.graded },
                    { label: "Waiting for review", value: summary.pending },
                  ].map(function (item) {
                    return (
                      <div
                        key={item.label}
                        className="rounded-[20px] border p-4"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                          {item.label}
                        </p>
                        <p className="mt-2 text-3xl font-semibold" style={{ color: colors.text }}>
                          {item.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-6 rounded-[28px] border p-5 md:p-6" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
                <div className="mb-4 hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] gap-4 px-3 text-xs font-semibold uppercase tracking-[0.18em] md:grid" style={{ color: colors.textMuted }}>
                  <span>{isQuizList ? "Quiz title" : "Assignment title"}</span>
                  <span>Student</span>
                  <span>Grade</span>
                  <span>Submitted</span>
                </div>

                <div className="space-y-3">
                  {rows.map(function (row) {
                    return (
                      <div
                        key={row.submissionId}
                        className="rounded-[22px] border p-4"
                        style={{ borderColor: colors.border, background: colors.cardBg }}
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] md:items-start">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                              {isQuizList ? "Quiz title" : "Assignment title"}
                            </p>
                            <h2 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                              {row.assignmentTitle}
                            </h2>
                            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                              Attempt {row.attemptNumber} · {row.status === "returned" ? "Returned" : row.status.replace(/_/g, " ")}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                              Student
                            </p>
                            <p className="mt-2 text-base font-semibold" style={{ color: colors.text }}>
                              {row.userName}
                            </p>
                            <p className="mt-1 text-sm break-all" style={{ color: colors.textSecondary }}>
                              {row.userEmail || row.userId}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                              Grade
                            </p>
                            <p className="mt-2 text-base font-semibold" style={{ color: colors.text }}>
                              {formatGrade(row)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                              Submitted
                            </p>
                            <p className="mt-2 text-sm font-medium" style={{ color: colors.text }}>
                              {formatDateTime(row.submittedAt)}
                            </p>
                            {row.gradedAt && (
                              <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                                Graded {formatDateTime(row.gradedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {rows.length === 0 && (
                    <div className="rounded-[24px] border p-8 text-center" style={{ borderColor: colors.border, background: colors.cardBg }}>
                      <EmptyIcon className="mx-auto h-10 w-10" style={{ color: colors.accent }} />
                      <h2 className="mt-4 text-xl font-semibold" style={{ color: colors.text }}>
                        No {isQuizList ? "quiz" : "assignment"} submissions yet
                      </h2>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        When enrolled learners submit work for this course, it will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )
        ) : (
          <div className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <h1 className="text-2xl font-semibold" style={{ color: colors.text }}>
              Course not found
            </h1>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              This course is not connected to the current instructor workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
