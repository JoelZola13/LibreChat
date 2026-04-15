import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { CourseMaterialsBrowser } from "./CourseMaterialsBrowser";
import { CourseDiscussionsPanel } from "./CourseDiscussionsPanel";
import { CourseWorkBuilder } from "./CourseWorkBuilder";
import { GradingDashboard } from "./GradingDashboard";
import { SubmissionGradingInterface } from "./SubmissionGradingInterface";
import {
  getCourseAssignments,
  getSubmissionForGrading,
  type Assignment,
  type GradingQueueItem,
  type Submission,
} from "./api/assignments";
import { getCourseMaterials, removeMaterialLink, type CourseMaterial } from "./api/course-materials";
import {
  createCourseScheduleItem,
  deleteCourseScheduleItem,
  listCourseScheduleItems,
  type CourseScheduleCategory,
  type CourseScheduleItem,
} from "./api/course-schedule";
import { createSession, cancelSession, listSessions, type LiveSession } from "./api/live-sessions";
import { useAcademyUserId } from "./useAcademyUserId";
import { sbFetch } from "../shared/sbFetch";
import type { Cohort } from "../lib/api/cohorts";
import { fileToAcademyAsset } from "./academyFileAssets";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  instructor_id?: string | null;
  instructor_name?: string | null;
  instructor?: string | null;
  duration?: string | null;
};

type InstructorCourseTab = "schedule" | "discussions" | "sessions" | "grading" | "builder" | "materials";

type ScheduleFormState = {
  title: string;
  date: string;
  time: string;
  notes: string;
  category: CourseScheduleCategory;
};

type LiveFormState = {
  title: string;
  date: string;
  time: string;
  notes: string;
};

type MaterialFormState = {
  title: string;
  notes: string;
};

type CalendarEntry = {
  id: string;
  date: string;
  label: string;
  title: string;
  subtitle: string;
};

function combineLocalDateTime(date: string, time: string): string {
  const safeDate = date || new Date().toISOString().slice(0, 10);
  const safeTime = time || "18:00";
  return new Date(safeDate + "T" + safeTime + ":00").toISOString();
}

function scheduleCategoryLabel(category: CourseScheduleCategory): string {
  if (category === "assignment") {
    return "Assignments";
  }
  if (category === "reading") {
    return "Readings";
  }
  return "Materials";
}

function startOfCalendarMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function buildCalendarDays(baseDate: Date): Date[] {
  const monthStart = startOfCalendarMonth(baseDate);
  const start = new Date(monthStart);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, function (_, index) {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function dateKey(isoOrDate: string | Date): string {
  const value = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return value.toISOString().slice(0, 10);
}

export default function AcademyInstructorCoursePage() {
  const params = useParams();
  const courseId = params.courseId || "";
  const location = useLocation();
  const instructorId = useAcademyUserId();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const basePath = location.pathname.startsWith("/learning") ? "/learning/instructor" : "/academy/instructor";
  const academyRootPath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";

  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [scheduleItems, setScheduleItems] = useState<CourseScheduleItem[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTab, setOpenTab] = useState<InstructorCourseTab | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<GradingQueueItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: "18:00",
    notes: "",
    category: "assignment",
  });

  const [liveFormOpen, setLiveFormOpen] = useState(false);
  const [liveSaving, setLiveSaving] = useState(false);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [liveForm, setLiveForm] = useState<LiveFormState>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    time: "18:00",
    notes: "",
  });

  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [materialSaving, setMaterialSaving] = useState(false);
  const [materialMessage, setMaterialMessage] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState<MaterialFormState>({ title: "", notes: "" });
  const [materialFile, setMaterialFile] = useState<File | null>(null);

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

  const loadCourseWorkspace = useCallback(async function () {
    setLoading(true);
    try {
      const responses = await Promise.all([
        sbFetch("/api/academy/courses/" + courseId),
        sbFetch(
          "/api/academy/cohorts?course_id=" +
            encodeURIComponent(courseId) +
            "&instructor_id=" +
            encodeURIComponent(instructorId),
        ),
        listSessions({ instructorId, courseId }),
        listCourseScheduleItems(courseId).catch(function () {
          return [];
        }),
        getCourseMaterials(courseId).catch(function () {
          return [];
        }),
        getCourseAssignments(courseId, true).catch(function () {
          return [];
        }),
      ]);

      const courseResponse = responses[0];
      const cohortsResponse = responses[1];
      const liveSessionData = responses[2];
      const scheduleData = responses[3];
      const materialData = responses[4];
      const assignmentData = responses[5];

      const directCourse = courseResponse.ok ? await courseResponse.json() : null;
      const cohortData = cohortsResponse.ok ? await cohortsResponse.json() : [];

      setCourse(directCourse ?? null);
      setCohorts(Array.isArray(cohortData) ? cohortData : []);
      setSessions(
        (liveSessionData.sessions || []).filter(function (session) {
          return session.status !== "cancelled";
        }),
      );
      setScheduleItems(scheduleData);
      setMaterials(materialData);
      setCourseAssignments(assignmentData);
    } catch {
      setCourse(null);
      setCohorts([]);
      setSessions([]);
      setScheduleItems([]);
      setMaterials([]);
      setCourseAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, instructorId]);

  useEffect(
    function () {
      void loadCourseWorkspace();
    },
    [loadCourseWorkspace],
  );

  const handleSelectSubmission = useCallback(async function (item: GradingQueueItem) {
    setLoadingSubmission(true);
    try {
      const submission = await getSubmissionForGrading(item.submissionId);
      if (submission) {
        setSelectedQueueItem(item);
        setSelectedSubmission(submission);
      }
    } catch (error) {
      console.error("Failed to load submission for grading:", error);
    } finally {
      setLoadingSubmission(false);
    }
  }, []);

  const handleBackToQueue = useCallback(function () {
    setSelectedQueueItem(null);
    setSelectedSubmission(null);
  }, []);

  function toggleTab(tab: InstructorCourseTab) {
    setOpenTab(function (prev) {
      const nextValue = prev === tab ? null : tab;
      if (nextValue !== "grading") {
        setSelectedQueueItem(null);
        setSelectedSubmission(null);
      }
      return nextValue;
    });
  }

  function resetScheduleForm() {
    setScheduleForm({
      title: "",
      date: new Date().toISOString().slice(0, 10),
      time: "18:00",
      notes: "",
      category: "assignment",
    });
  }

  function resetLiveForm() {
    setLiveForm({
      title: "",
      date: new Date().toISOString().slice(0, 10),
      time: "18:00",
      notes: "",
    });
  }

  function resetMaterialForm() {
    setMaterialForm({ title: "", notes: "" });
    setMaterialFile(null);
  }

  async function handleCreateScheduleItem() {
    if (course == null || scheduleForm.title.trim() === "") {
      return;
    }

    setScheduleSaving(true);
    setScheduleMessage(null);
    try {
      await createCourseScheduleItem(
        course.id,
        {
          title: scheduleForm.title.trim(),
          notes: scheduleForm.notes.trim(),
          scheduledAt: combineLocalDateTime(scheduleForm.date, scheduleForm.time),
          category: scheduleForm.category,
        },
        instructorId,
      );
      setScheduleMessage(scheduleCategoryLabel(scheduleForm.category) + " added to the course calendar.");
      setScheduleFormOpen(false);
      resetScheduleForm();
      await loadCourseWorkspace();
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "Failed to add schedule item.");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleDeleteScheduleItem(item: CourseScheduleItem) {
    try {
      await deleteCourseScheduleItem(item.id);
      await loadCourseWorkspace();
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "Failed to delete this schedule item.");
    }
  }

  async function handleCreateLiveSession() {
    if (course == null || liveForm.title.trim() === "") {
      return;
    }

    setLiveSaving(true);
    setLiveMessage(null);
    try {
      const scheduledStart = combineLocalDateTime(liveForm.date, liveForm.time);
      const scheduledEnd = new Date(new Date(scheduledStart).getTime() + 60 * 60 * 1000).toISOString();
      await createSession(
        {
          course_id: course.id,
          title: liveForm.title.trim(),
          description: liveForm.notes.trim(),
          session_type: "class",
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          platform: "internal",
        },
        instructorId,
      );
      setLiveMessage("Live session added to the course and student dashboards.");
      setLiveFormOpen(false);
      resetLiveForm();
      await loadCourseWorkspace();
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "Failed to create live session.");
    } finally {
      setLiveSaving(false);
    }
  }

  async function handleDeleteLiveSession(session: LiveSession) {
    try {
      await cancelSession(session.id, "Removed from the instructor workspace");
      await loadCourseWorkspace();
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : "Failed to remove this live session.");
    }
  }

  function handleMaterialFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMaterialFile(event.target.files?.[0] ?? null);
  }

  async function handleCreateMaterial() {
    if (course == null) {
      return;
    }

    const title = materialForm.title.trim() || (materialFile ? materialFile.name : "");
    if (title === "") {
      return;
    }

    setMaterialSaving(true);
    setMaterialMessage(null);
    try {
      const attachment = materialFile ? await fileToAcademyAsset(materialFile) : null;
      await createCourseScheduleItem(
        course.id,
        {
          title,
          notes: materialForm.notes.trim(),
          scheduledAt: new Date().toISOString(),
          category: "material",
          fileName: materialFile ? materialFile.name : undefined,
          documentType: materialFile ? materialFile.type : undefined,
          fileUrl: attachment?.url,
          mimeType: attachment?.mimeType,
          sizeBytes: attachment?.sizeBytes,
          uploadedAt: attachment?.uploadedAt,
        },
        instructorId,
      );
      setMaterialMessage("Learning material added for your students.");
      setMaterialFormOpen(false);
      resetMaterialForm();
      await loadCourseWorkspace();
    } catch (error) {
      setMaterialMessage(error instanceof Error ? error.message : "Failed to add material.");
    } finally {
      setMaterialSaving(false);
    }
  }

  async function handleDeleteMaterial(material: CourseMaterial) {
    try {
      if (material.scheduleItemId) {
        await deleteCourseScheduleItem(material.scheduleItemId);
      } else {
        await removeMaterialLink(material.linkId);
      }
      await loadCourseWorkspace();
    } catch (error) {
      setMaterialMessage(error instanceof Error ? error.message : "Failed to delete this material.");
    }
  }

  const customScheduleItems = useMemo(
    function () {
      return [...scheduleItems].sort(function (left, right) {
        return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
      });
    },
    [scheduleItems],
  );

  const calendarEntries = useMemo(
    function () {
      const cohortEntries = cohorts.map(function (cohort) {
        return {
          id: "cohort-" + cohort.id,
          date: cohort.start_date,
          label: "Cohort",
          title: cohort.name,
          subtitle: "Guided learning group for this course.",
        };
      });

      const sessionEntries = sessions.map(function (session) {
        return {
          id: "session-" + session.id,
          date: session.scheduled_start,
          label: session.status === "live" ? "Live Now" : "Live Session",
          title: session.title,
          subtitle: session.description || "Live session for enrolled learners.",
        };
      });

      const plannedEntries = customScheduleItems.map(function (item) {
        return {
          id: item.id,
          date: item.scheduledAt,
          label: scheduleCategoryLabel(item.category),
          title: item.title,
          subtitle: item.notes || scheduleCategoryLabel(item.category) + " shared with enrolled students.",
        };
      });

      return cohortEntries.concat(sessionEntries, plannedEntries).sort(function (left, right) {
        return new Date(left.date).getTime() - new Date(right.date).getTime();
      });
    },
    [cohorts, customScheduleItems, sessions],
  );

  const calendarBaseDate = useMemo(
    function () {
      return calendarEntries.length > 0 ? new Date(calendarEntries[0].date) : new Date();
    },
    [calendarEntries],
  );

  const calendarDays = useMemo(
    function () {
      return buildCalendarDays(calendarBaseDate);
    },
    [calendarBaseDate],
  );

  const calendarEntriesByDate = useMemo(
    function () {
      return calendarEntries.reduce<Record<string, CalendarEntry[]>>(function (acc, item) {
        const key = dateKey(item.date);
        acc[key] = (acc[key] || []).concat(item);
        return acc;
      }, {});
    },
    [calendarEntries],
  );

  const visibleSessions = useMemo(
    function () {
      return [...sessions].sort(function (left, right) {
        return new Date(left.scheduled_start).getTime() - new Date(right.scheduled_start).getTime();
      });
    },
    [sessions],
  );

  const quizAssignments = useMemo(
    function () {
      return courseAssignments.filter(function (assignment) {
        return assignment.assignmentType === "quiz";
      });
    },
    [courseAssignments],
  );

  const homeworkAssignments = useMemo(
    function () {
      return courseAssignments.filter(function (assignment) {
        return assignment.assignmentType !== "quiz";
      });
    },
    [courseAssignments],
  );

  const submissionCollectionSummary = useMemo(
    function () {
      const quizSubmitted = quizAssignments.reduce(function (sum, assignment) {
        return sum + (assignment.submissionCount || 0);
      }, 0);
      const quizGraded = quizAssignments.reduce(function (sum, assignment) {
        return sum + (assignment.gradedCount || 0);
      }, 0);
      const homeworkSubmitted = homeworkAssignments.reduce(function (sum, assignment) {
        return sum + (assignment.submissionCount || 0);
      }, 0);
      const homeworkGraded = homeworkAssignments.reduce(function (sum, assignment) {
        return sum + (assignment.gradedCount || 0);
      }, 0);

      return {
        quizCount: quizAssignments.length,
        quizSubmitted,
        quizPending: Math.max(quizSubmitted - quizGraded, 0),
        homeworkCount: homeworkAssignments.length,
        homeworkSubmitted,
        homeworkPending: Math.max(homeworkSubmitted - homeworkGraded, 0),
      };
    },
    [homeworkAssignments, quizAssignments],
  );

  const sectionTabs: Array<{ tab: InstructorCourseTab; label: string; description: string; icon: typeof CalendarDays }> = [
    {
      tab: "schedule",
      label: "Schedule",
      description: "Plan and stay organized with the course you're teaching.",
      icon: CalendarDays,
    },
    {
      tab: "discussions",
      label: "Discussions",
      description: "Post course updates that enrolled students can see in their dashboard.",
      icon: MessageSquare,
    },
    {
      tab: "sessions",
      label: "Live Sessions",
      description: "Run live sessions connected to your courses and students.",
      icon: Video,
    },
    {
      tab: "grading",
      label: "Grading & Feedback",
      description: "Review and grade submissions, give feedback, and track student progress.",
      icon: ClipboardCheck,
    },
    {
      tab: "builder",
      label: "Quiz & Assignment Maker",
      description: "Create quizzes and homework that appear in the student dashboard for this course.",
      icon: Plus,
    },
    {
      tab: "materials",
      label: "Learning Materials",
      description: "Upload and organize resources your students need throughout the course.",
      icon: BookOpen,
    },
  ];

  function renderOpenSection() {
    if (course == null || openTab == null) {
      return null;
    }

    if (openTab === "schedule") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                Course schedule
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Add assignments, readings, and materials for this course. Students in this class will see the same updates in their dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={function () {
                setScheduleMessage(null);
                setScheduleFormOpen(function (prev) {
                  return prev === false;
                });
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(249,115,22,0.12)", color: colors.accent, border: "1px solid " + colors.border }}
            >
              <Plus className="h-4 w-4" />
              Add to calendar
            </button>
          </div>

          {scheduleMessage && (
            <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
              {scheduleMessage}
            </div>
          )}

          {scheduleFormOpen && (
            <div className="mt-5 rounded-[22px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Title
                  </label>
                  <input
                    value={scheduleForm.title}
                    onChange={function (event) {
                      setScheduleForm(function (prev) {
                        return { ...prev, title: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Category
                  </label>
                  <select
                    value={scheduleForm.category}
                    onChange={function (event) {
                      setScheduleForm(function (prev) {
                        return { ...prev, category: event.target.value as CourseScheduleCategory };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  >
                    <option value="assignment">Assignments</option>
                    <option value="reading">Readings</option>
                    <option value="material">Materials</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={function (event) {
                      setScheduleForm(function (prev) {
                        return { ...prev, date: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={function (event) {
                      setScheduleForm(function (prev) {
                        return { ...prev, time: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Additional Notes
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={function (event) {
                    setScheduleForm(function (prev) {
                      return { ...prev, notes: event.target.value };
                    });
                  }}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2"
                  style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={function () {
                    void handleCreateScheduleItem();
                  }}
                  disabled={scheduleSaving || scheduleForm.title.trim() === ""}
                  className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ background: colors.accent, color: "#fff" }}
                >
                  {scheduleSaving ? "Saving..." : "Done"}
                </button>
                <button
                  type="button"
                  onClick={function () {
                    setScheduleFormOpen(false);
                    resetScheduleForm();
                  }}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-[24px] border p-4" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                  Calendar
                </p>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: colors.text }}>
                  {calendarBaseDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (day) {
                return <div key={day}>{day}</div>;
              })}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {calendarDays.map(function (day) {
                const items = calendarEntriesByDate[dateKey(day)] || [];
                const inMonth = day.getMonth() === calendarBaseDate.getMonth();
                return (
                  <div
                    key={day.toISOString()}
                    className="min-h-[96px] rounded-[18px] border p-2"
                    style={{
                      borderColor: colors.border,
                      background: inMonth ? colors.cardBg : "transparent",
                      opacity: inMonth ? 1 : 0.5,
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: colors.text }}>
                      {day.getDate()}
                    </div>
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 3).map(function (item) {
                        return (
                          <div
                            key={item.id}
                            className="rounded-full px-2 py-1 text-[11px] font-medium"
                            style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}
                          >
                            {item.label}: {item.title}
                          </div>
                        );
                      })}
                      {items.length > 3 && (
                        <div className="text-[11px]" style={{ color: colors.textMuted }}>
                          +{items.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {customScheduleItems.map(function (item) {
              const eventDate = new Date(item.scheduledAt);
              return (
                <div
                  key={item.id}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        {scheduleCategoryLabel(item.category)}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                        {item.notes || scheduleCategoryLabel(item.category) + " shared with enrolled students."}
                      </p>
                      <p className="mt-3 text-sm font-medium" style={{ color: colors.text }}>
                        {eventDate.toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={function () {
                        void handleDeleteScheduleItem(item);
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {customScheduleItems.length === 0 && (
              <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No assignments, readings, or materials have been scheduled for this course yet.
              </div>
            )}
          </div>
        </section>
      );
    }

    if (openTab === "discussions") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
            Course Discussions
          </h2>
          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            Post reminders, guidance, and course updates for students enrolled in this class. These posts appear in the student dashboard discussion section for this course only.
          </p>

          <div className="mt-5">
            <CourseDiscussionsPanel
              courseId={course.id}
              colors={colors}
              mode="instructor"
              authorName={course.instructor_name || course.instructor || "Course Instructor"}
              authorId={instructorId}
            />
          </div>
        </section>
      );
    }

    if (openTab === "sessions") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                Live Sessions
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Create and manage live sessions for students enrolled in this course.
              </p>
            </div>
            <button
              type="button"
              onClick={function () {
                setLiveMessage(null);
                setLiveFormOpen(function (prev) {
                  return prev === false;
                });
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(249,115,22,0.12)", color: colors.accent, border: "1px solid " + colors.border }}
            >
              <Plus className="h-4 w-4" />
              Add live session
            </button>
          </div>

          {liveMessage && (
            <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
              {liveMessage}
            </div>
          )}

          {liveFormOpen && (
            <div className="mt-5 rounded-[22px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Title
                  </label>
                  <input
                    value={liveForm.title}
                    onChange={function (event) {
                      setLiveForm(function (prev) {
                        return { ...prev, title: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={liveForm.date}
                    onChange={function (event) {
                      setLiveForm(function (prev) {
                        return { ...prev, date: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={liveForm.time}
                    onChange={function (event) {
                      setLiveForm(function (prev) {
                        return { ...prev, time: event.target.value };
                      });
                    }}
                    className="w-full rounded-xl border px-3 py-2"
                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Additional Notes
                </label>
                <textarea
                  value={liveForm.notes}
                  onChange={function (event) {
                    setLiveForm(function (prev) {
                      return { ...prev, notes: event.target.value };
                    });
                  }}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2"
                  style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={function () {
                    void handleCreateLiveSession();
                  }}
                  disabled={liveSaving || liveForm.title.trim() === ""}
                  className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ background: colors.accent, color: "#fff" }}
                >
                  {liveSaving ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={function () {
                    setLiveFormOpen(false);
                    resetLiveForm();
                  }}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {visibleSessions.map(function (session) {
              return (
                <div
                  key={session.id}
                  className="rounded-[22px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <a href={academyRootPath + "/live-sessions/" + session.id} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                            {session.title}
                          </h3>
                          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                            {session.description || "Live course session ready for your learners."}
                          </p>
                        </div>
                        <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}>
                          {session.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium" style={{ color: colors.text }}>
                        {new Date(session.scheduled_start).toLocaleString()}
                      </p>
                    </a>
                    <button
                      type="button"
                      onClick={function () {
                        void handleDeleteLiveSession(session);
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleSessions.length === 0 && (
              <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                No live sessions are connected to this course yet.
              </div>
            )}
          </div>
        </section>
      );
    }

    if (openTab === "grading") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
            Grading and Feedback
          </h2>
          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            Review and grade submissions for this course while staying aligned with the learner dashboard.
          </p>

          <div className="mt-5">
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <a
                href={basePath + "/courses/" + course.id + "/submissions/quizzes"}
                className="rounded-[20px] border p-4 transition hover:opacity-90"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                  Quiz submissions
                </p>
                <h3 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                  {submissionCollectionSummary.quizSubmitted}
                </h3>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {submissionCollectionSummary.quizCount} quizzes posted · {submissionCollectionSummary.quizPending} waiting for review
                </p>
              </a>
              <a
                href={basePath + "/courses/" + course.id + "/submissions/assignments"}
                className="rounded-[20px] border p-4 transition hover:opacity-90"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                  Assignment submissions
                </p>
                <h3 className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                  {submissionCollectionSummary.homeworkSubmitted}
                </h3>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {submissionCollectionSummary.homeworkCount} assignments posted · {submissionCollectionSummary.homeworkPending} waiting for review
                </p>
              </a>
            </div>

            {loadingSubmission && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ color: colors.textSecondary }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading submission...
              </div>
            )}

            {selectedQueueItem && selectedSubmission ? (
              <SubmissionGradingInterface
                queueItem={selectedQueueItem}
                submission={selectedSubmission}
                graderId={instructorId}
                onBack={handleBackToQueue}
                onGradeSubmitted={handleBackToQueue}
              />
            ) : (
              <GradingDashboard instructorId={instructorId} courseId={course.id} onSelectSubmission={handleSelectSubmission} />
            )}
          </div>
        </section>
      );
    }

    if (openTab === "builder") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
            Quiz & Assignment Maker
          </h2>
          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            Post quizzes and homework that only students enrolled in this course can see inside their dashboard.
          </p>

          <div className="mt-5">
            <CourseWorkBuilder
              courseId={course.id}
              instructorId={instructorId}
              colors={colors}
              onChanged={loadCourseWorkspace}
            />
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
              Learning Materials
            </h2>
            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              Add course resources your students can see inside their own class dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={function () {
              setMaterialMessage(null);
              setMaterialFormOpen(function (prev) {
                return prev === false;
              });
            }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: "rgba(249,115,22,0.12)", color: colors.accent, border: "1px solid " + colors.border }}
          >
            <Plus className="h-4 w-4" />
            Add material
          </button>
        </div>

        {materialMessage && (
          <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
            {materialMessage}
          </div>
        )}

        {materialFormOpen && (
          <div className="mt-5 rounded-[22px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Title
                </label>
                <input
                  value={materialForm.title}
                  onChange={function (event) {
                    setMaterialForm(function (prev) {
                      return { ...prev, title: event.target.value };
                    });
                  }}
                  className="w-full rounded-xl border px-3 py-2"
                  style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Upload file
                </label>
                <input
                  type="file"
                  onChange={handleMaterialFileChange}
                  className="w-full rounded-xl border px-3 py-2"
                  style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Additional Notes
              </label>
              <textarea
                value={materialForm.notes}
                onChange={function (event) {
                  setMaterialForm(function (prev) {
                    return { ...prev, notes: event.target.value };
                  });
                }}
                rows={4}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={function () {
                  void handleCreateMaterial();
                }}
                disabled={materialSaving || (materialForm.title.trim() === "" && materialFile == null)}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: colors.accent, color: "#fff" }}
              >
                {materialSaving ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={function () {
                  setMaterialFormOpen(false);
                  resetMaterialForm();
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {materials.map(function (material) {
            return (
              <div
                key={material.linkId}
                className="rounded-[22px] border p-4"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(249,115,22,0.12)" }}>
                        <FileText className="h-5 w-5" style={{ color: colors.accent }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                          {material.title}
                        </h3>
                        <p className="text-sm" style={{ color: colors.textMuted }}>
                          {material.fileName || "Shared with enrolled students"}
                        </p>
                      </div>
                    </div>
                    {material.notes && (
                      <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                        {material.notes}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={function () {
                      void handleDeleteMaterial(material);
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                    style={{ background: colors.cardBg, color: colors.text, border: "1px solid " + colors.border }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {materials.length === 0 && (
            <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
              No materials are connected to this course yet.
            </div>
          )}
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
            Student view
          </p>
          <CourseMaterialsBrowser
            key={materials.map(function (item) {
              return item.linkId;
            }).join(":")}
            entityType="course"
            entityId={course.id}
          />
        </div>
      </section>
    );
  }

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
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            {course ? course.title : "Course Workspace"}
          </span>
        </div>

        {loading ? (
          <div className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading course workspace...
            </div>
          </div>
        ) : course ? (
          course.instructor_id !== instructorId ? (
            <section className="rounded-[28px] border p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                Instructor Workspace
              </p>
              <h1 className="mt-3 text-2xl font-semibold md:text-3xl" style={{ color: colors.text }}>
                This course is no longer in your workspace
              </h1>
              <p className="mt-3 max-w-2xl text-sm md:text-base" style={{ color: colors.textSecondary }}>
                If you used Undo on this course, it has been removed from your teaching list and you no longer have instructor access to its course workspace.
              </p>
              <a
                href={`${basePath}/add-course`}
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.accent, color: "#fff" }}
              >
                Back to Add Course
              </a>
            </section>
          ) : (
          <>
            <section className="mb-6 rounded-[28px] border p-6 md:p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
              <div className="flex flex-col gap-4">
                <a href={basePath + "/courses"} className="text-sm font-semibold" style={{ color: colors.accent }}>
                  Back to Courses
                </a>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                    Instructor Course Workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                    {course.title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-base" style={{ color: colors.textSecondary }}>
                    {course.description || "Use this course workspace to manage the teaching experience for your learners."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                  <span>{course.category || "Academy course"}</span>
                  <span>{course.duration || "Flexible duration"}</span>
                  <span>{visibleSessions.length} live sessions</span>
                  <span>{cohorts.length} cohorts</span>
                  <span>{scheduleItems.length} course updates</span>
                </div>
              </div>
            </section>


<div className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
  {sectionTabs.map(function (item) {
    const isOpen = openTab === item.tab;
    return (
      <button
        key={item.tab}
        type="button"
        onClick={function () {
          toggleTab(item.tab);
        }}
        className="rounded-[20px] border p-2.5 text-left transition-colors"
        style={{
          borderColor: isOpen ? colors.accent : colors.border,
          background: isOpen ? colors.cardBgStrong : colors.cardBg,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: isOpen ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.12)" }}
          >
            <item.icon className="h-4 w-4" style={{ color: colors.accent }} />
          </div>
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{
              color: isOpen ? colors.accent : colors.textMuted,
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>
        <h2 className="mt-2.5 text-[13px] font-semibold leading-4" style={{ color: colors.text }}>
          {item.label}
        </h2>
        <p className="mt-1 text-[10px] leading-4" style={{ color: colors.textSecondary }}>
          {item.description}
        </p>
      </button>
    );
  })}
</div>

            {openTab == null && (
              <div className="mb-6 rounded-[24px] border p-5 text-sm" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
                Click a tab above to open that teaching section. Click it again to hide it.
              </div>
            )}

            {renderOpenSection()}
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
