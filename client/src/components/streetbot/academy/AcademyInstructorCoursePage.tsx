import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  Star,
  Trash2,
  Users,
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
import { listEnrollmentApplications, type EnrollmentApplication } from "./api/enrollment-applications";
import { getCourseMaterials, removeMaterialLink, type CourseMaterial } from "./api/course-materials";
import {
  createCourseScheduleItem,
  deleteCourseScheduleItem,
  listCourseScheduleItems,
  type CourseScheduleCategory,
  type CourseScheduleItem,
} from "./api/course-schedule";
import {
  getCourseAttendance,
  markCourseAttendance,
  type AttendanceStatus,
  type CourseAttendanceStudent,
} from "./api/course-attendance";
import { createSession, cancelSession, listSessions, type LiveSession } from "./api/live-sessions";
import { useAcademyUserId } from "./useAcademyUserId";
import { sbFetch } from "../shared/sbFetch";
import type { Cohort } from "../lib/api/cohorts";
import { fileToAcademyAsset, openAcademyAsset, type AcademyFileAsset } from "./academyFileAssets";

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

type InstructorCourseTab =
  | "schedule"
  | "discussions"
  | "sessions"
  | "attendance"
  | "grading"
  | "form-submissions"
  | "feedback"
  | "builder"
  | "materials";

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

type CourseReview = {
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

type CourseReviewStats = {
  average: number;
  count: number;
  distribution: Record<number, number>;
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

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Recently updated";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceRows, setAttendanceRows] = useState<CourseAttendanceStudent[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceSavingUserId, setAttendanceSavingUserId] = useState<string | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const [enrollmentApplications, setEnrollmentApplications] = useState<EnrollmentApplication[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [courseReviews, setCourseReviews] = useState<CourseReview[]>([]);
  const [reviewStats, setReviewStats] = useState<CourseReviewStats | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

  const loadAttendance = useCallback(async function () {
    if (courseId === "") {
      setAttendanceRows([]);
      return;
    }

    setLoadingAttendance(true);
    try {
      const roster = await getCourseAttendance(courseId, attendanceDate);
      setAttendanceRows(roster.students);
    } catch (error) {
      console.error("Failed to load attendance roster:", error);
      setAttendanceRows([]);
    } finally {
      setLoadingAttendance(false);
    }
  }, [attendanceDate, courseId]);

  useEffect(
    function () {
      if (openTab === "attendance") {
        void loadAttendance();
      }
    },
    [loadAttendance, openTab],
  );

  const loadEnrollmentFormSubmissions = useCallback(async function () {
    if (courseId === "") {
      setEnrollmentApplications([]);
      return;
    }

    setLoadingApplications(true);
    setApplicationsError(null);
    try {
      const applications = await listEnrollmentApplications({ courseId });
      setEnrollmentApplications(applications);
    } catch (error) {
      setEnrollmentApplications([]);
      setApplicationsError(error instanceof Error ? error.message : "Failed to load form submissions.");
    } finally {
      setLoadingApplications(false);
    }
  }, [courseId]);

  useEffect(
    function () {
      if (openTab === "form-submissions") {
        void loadEnrollmentFormSubmissions();
      }
    },
    [loadEnrollmentFormSubmissions, openTab],
  );

  const loadCourseFeedback = useCallback(async function () {
    if (courseId === "") {
      setCourseReviews([]);
      setReviewStats(null);
      return;
    }

    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const [reviewsResponse, statsResponse] = await Promise.all([
        sbFetch(`/api/academy/reviews/course/${encodeURIComponent(courseId)}`),
        sbFetch(`/api/academy/reviews/course/${encodeURIComponent(courseId)}/stats`),
      ]);

      const reviewsData = reviewsResponse.ok ? await reviewsResponse.json() : [];
      const statsData = statsResponse.ok ? await statsResponse.json() : null;

      setCourseReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setReviewStats(
        statsData && typeof statsData === "object"
          ? {
              average: Number(statsData.average || 0),
              count: Number(statsData.count || 0),
              distribution:
                statsData.distribution && typeof statsData.distribution === "object"
                  ? statsData.distribution
                  : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            }
          : null,
      );
    } catch (error) {
      setCourseReviews([]);
      setReviewStats(null);
      setFeedbackError(error instanceof Error ? error.message : "Failed to load course feedback.");
    } finally {
      setLoadingFeedback(false);
    }
  }, [courseId]);

  useEffect(
    function () {
      if (openTab === "feedback") {
        void loadCourseFeedback();
      }
    },
    [loadCourseFeedback, openTab],
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

  async function handleAttendanceMark(userId: string, attendanceStatus: AttendanceStatus) {
    if (course == null) {
      return;
    }

    setAttendanceSavingUserId(userId);
    setAttendanceMessage(null);
    try {
      const savedRecord = await markCourseAttendance(course.id, {
        classDate: attendanceDate,
        userId,
        attendanceStatus,
        markedBy: instructorId,
      });
      setAttendanceRows(function (current) {
        return current.map(function (student) {
          return student.userId === userId
            ? {
                ...student,
                attendanceStatus: savedRecord.attendanceStatus,
                recordId: savedRecord.recordId,
                updatedAt: savedRecord.updatedAt,
              }
            : student;
        });
      });
      setAttendanceMessage(
        `${savedRecord.userName} marked ${attendanceStatus} for ${new Date(attendanceDate + "T12:00:00").toLocaleDateString()}.`,
      );
    } catch (error) {
      setAttendanceMessage(error instanceof Error ? error.message : "Failed to save attendance.");
    } finally {
      setAttendanceSavingUserId(null);
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

  const attendanceSummary = useMemo(
    function () {
      const presentCount = attendanceRows.filter(function (student) {
        return student.attendanceStatus === "present";
      }).length;
      const absentCount = attendanceRows.filter(function (student) {
        return student.attendanceStatus === "absent";
      }).length;
      return {
        total: attendanceRows.length,
        presentCount,
        absentCount,
        unmarkedCount: Math.max(attendanceRows.length - presentCount - absentCount, 0),
      };
    },
    [attendanceRows],
  );

  const applicationSummary = useMemo(
    function () {
      const attachmentCount = enrollmentApplications.reduce(function (sum, application) {
        return sum + application.sample_work_attachments.length;
      }, 0);

      return {
        total: enrollmentApplications.length,
        withAttachments: enrollmentApplications.filter(function (application) {
          return application.sample_work_attachments.length > 0;
        }).length,
        attachmentCount,
      };
    },
    [enrollmentApplications],
  );

  const feedbackSummary = useMemo(
    function () {
      const fiveStarCount = courseReviews.filter(function (review) {
        return review.rating >= 5;
      }).length;
      const writtenCount = courseReviews.filter(function (review) {
        return (
          String(review.workshop_feedback || "").trim() !== "" ||
          String(review.rating_reason || "").trim() !== "" ||
          String(review.other_feedback || "").trim() !== "" ||
          String(review.review_text || "").trim() !== ""
        );
      }).length;
      return {
        fiveStarCount,
        writtenCount,
      };
    },
    [courseReviews],
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
      tab: "attendance",
      label: "Attendance",
      description: "Mark students present or absent for each class date in this course.",
      icon: Users,
    },
    {
      tab: "grading",
      label: "Grading & Feedback",
      description: "Review and grade submissions, give feedback, and track student progress.",
      icon: ClipboardCheck,
    },
    {
      tab: "form-submissions",
      label: "Form Submissions",
      description: "Read the enrollment forms submitted by students joining this course.",
      icon: FileText,
    },
    {
      tab: "feedback",
      label: "Course Feedback",
      description: "See ratings, comments, and review trends from enrolled learners.",
      icon: Star,
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

    if (openTab === "attendance") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                Attendance
              </h2>
              <p className="mt-2 max-w-3xl text-sm" style={{ color: colors.textSecondary }}>
                Mark each enrolled learner as present or absent for a specific class date. When you switch the class date, the list starts fresh for that class.
              </p>
            </div>
            <div className="min-w-[220px]">
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Class date
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={function (event) {
                  setAttendanceDate(event.target.value);
                  setAttendanceMessage(null);
                }}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: colors.border, background: colors.cardBg, color: colors.text }}
              />
            </div>
          </div>

          {attendanceMessage && (
            <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
              {attendanceMessage}
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              { label: "Enrolled", value: attendanceSummary.total },
              { label: "Present", value: attendanceSummary.presentCount },
              { label: "Absent", value: attendanceSummary.absentCount },
              { label: "Unmarked", value: attendanceSummary.unmarkedCount },
            ].map(function (item) {
              return (
                <div
                  key={item.label}
                  className="rounded-[20px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[24px] border" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
            <div className="border-b px-5 py-4" style={{ borderColor: colors.border }}>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                This attendance sheet is saved only for {new Date(attendanceDate + "T12:00:00").toLocaleDateString()}.
              </p>
            </div>

            {loadingAttendance ? (
              <div className="flex items-center gap-2 px-5 py-8 text-sm" style={{ color: colors.textSecondary }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading attendance roster...
              </div>
            ) : attendanceRows.length > 0 ? (
              <div className="divide-y" style={{ borderColor: colors.border }}>
                {attendanceRows.map(function (student) {
                  const isSaving = attendanceSavingUserId === student.userId;
                  const isPresent = student.attendanceStatus === "present";
                  const isAbsent = student.attendanceStatus === "absent";
                  return (
                    <div
                      key={student.userId}
                      className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold" style={{ color: colors.text }}>
                          {student.userName}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                          <span>Student ID: {student.studentId}</span>
                          <span>Progress: {student.progressPercent || 0}%</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={function () {
                            void handleAttendanceMark(student.userId, "present");
                          }}
                          disabled={isSaving}
                          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          style={{
                            background: isPresent ? "rgba(34,197,94,0.16)" : colors.cardBg,
                            color: isPresent ? "#22C55E" : colors.text,
                            border: "1px solid " + (isPresent ? "rgba(34,197,94,0.35)" : colors.border),
                          }}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={function () {
                            void handleAttendanceMark(student.userId, "absent");
                          }}
                          disabled={isSaving}
                          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          style={{
                            background: isAbsent ? "rgba(239,68,68,0.16)" : colors.cardBg,
                            color: isAbsent ? "#EF4444" : colors.text,
                            border: "1px solid " + (isAbsent ? "rgba(239,68,68,0.35)" : colors.border),
                          }}
                        >
                          Absent
                        </button>
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.textSecondary }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-sm" style={{ color: colors.textSecondary }}>
                No active students are enrolled in this course yet.
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

    if (openTab === "form-submissions") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                Form Submissions
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Review the enrollment forms submitted for this course. Each student submission stays connected to the class they enrolled in.
              </p>
            </div>
            <button
              type="button"
              onClick={function () {
                void loadEnrollmentFormSubmissions();
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: colors.cardBgStrong, color: colors.text, border: "1px solid " + colors.border }}
            >
              <Loader2 className={loadingApplications ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { label: "Submitted Forms", value: applicationSummary.total },
              { label: "With Attachments", value: applicationSummary.withAttachments },
              { label: "Files Shared", value: applicationSummary.attachmentCount },
            ].map(function (item) {
              return (
                <div
                  key={item.label}
                  className="rounded-[20px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          {applicationsError && (
            <div className="mt-5 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              {applicationsError}
            </div>
          )}

          {loadingApplications ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ color: colors.textSecondary }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading submitted enrollment forms...
            </div>
          ) : enrollmentApplications.length > 0 ? (
            <div className="mt-6 space-y-4">
              {enrollmentApplications.map(function (application) {
                const displayName =
                  application.preferred_name ||
                  application.full_name ||
                  [application.first_name, application.last_name].filter(Boolean).join(" ") ||
                  application.email ||
                  application.user_id;

                return (
                  <div
                    key={application.id}
                    className="rounded-[24px] border p-5"
                    style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                          {application.target_type === "learning_path" ? "Program enrollment" : "Course enrollment"}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
                          {displayName}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm" style={{ color: colors.textSecondary }}>
                          <span>Student ID: {application.user_id}</span>
                          {application.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-4 w-4" />
                              {application.email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-sm" style={{ color: colors.textSecondary }}>
                        <p>{application.target_title || course.title}</p>
                        <p className="mt-1" style={{ color: colors.textMuted }}>
                          {formatDateTime(application.submitted_at || application.created_at)}
                        </p>
                        <p className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}>
                          {application.status || "submitted"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            How they heard about the program
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {application.heard_about || "No answer provided."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            Prior experience or interest
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {application.prior_experience || "No answer provided."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            Interest areas
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {application.interest_areas.length > 0 ? (
                              application.interest_areas.map(function (interest) {
                                return (
                                  <span
                                    key={interest}
                                    className="rounded-full px-3 py-1 text-xs font-medium"
                                    style={{ background: colors.cardBg, color: colors.textSecondary, border: "1px solid " + colors.border }}
                                  >
                                    {interest}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-sm" style={{ color: colors.textSecondary }}>
                                No interests selected.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            Future project
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {application.future_project || "No answer provided."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            What they hope to gain
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {application.program_goals || "No answer provided."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            Challenges they shared
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                            {application.challenges || "No answer provided."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(application.past_project || application.general_comments || application.sample_work_attachments.length > 0) && (
                      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr,0.9fr]">
                        <div className="space-y-4">
                          {application.past_project ? (
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                                Past creative project
                              </p>
                              <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                                {application.past_project}
                              </p>
                            </div>
                          ) : null}
                          {application.general_comments ? (
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                                General comments
                              </p>
                              <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                                {application.general_comments}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: colors.textMuted }}>
                            Attachments
                          </p>
                          <div className="mt-2 space-y-2">
                            {application.sample_work_attachments.length > 0 ? (
                              application.sample_work_attachments.map(function (asset: AcademyFileAsset) {
                                return (
                                  <button
                                    key={`${application.id}-${asset.filename}-${asset.uploadedAt}`}
                                    type="button"
                                    onClick={function () {
                                      openAcademyAsset(asset);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left text-sm"
                                    style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}
                                  >
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                      <Paperclip className="h-4 w-4 shrink-0" />
                                      <span className="truncate">{asset.filename}</span>
                                    </span>
                                    <ExternalLink className="h-4 w-4 shrink-0" />
                                  </button>
                                );
                              })
                            ) : (
                              <div className="rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
                                No attachments were uploaded with this form.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
              No students have submitted an enrollment form for this course yet.
            </div>
          )}
        </section>
      );
    }

    if (openTab === "feedback") {
      return (
        <section className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                Course Feedback
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Track the overall course rating and read every review submitted by enrolled students for this class.
              </p>
            </div>
            <button
              type="button"
              onClick={function () {
                void loadCourseFeedback();
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: colors.cardBgStrong, color: colors.text, border: "1px solid " + colors.border }}
            >
              <Loader2 className={loadingFeedback ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              { label: "Average Rating", value: reviewStats ? reviewStats.average.toFixed(1) : "0.0" },
              { label: "Total Reviews", value: reviewStats?.count || 0 },
              { label: "Five Star Reviews", value: feedbackSummary.fiveStarCount },
              { label: "Written Comments", value: feedbackSummary.writtenCount },
            ].map(function (item) {
              return (
                <div
                  key={item.label}
                  className="rounded-[20px] border p-4"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold" style={{ color: colors.text }}>
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          {feedbackError && (
            <div className="mt-5 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              {feedbackError}
            </div>
          )}

          {loadingFeedback ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ color: colors.textSecondary }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading course feedback...
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                  Rating Distribution
                </p>
                <div className="mt-4 space-y-3">
                  {[5, 4, 3, 2, 1].map(function (rating) {
                    const count = reviewStats?.distribution?.[rating] || 0;
                    const percentage = reviewStats?.count ? (count / reviewStats.count) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex w-14 items-center gap-1 text-sm font-medium" style={{ color: colors.text }}>
                          <span>{rating}</span>
                          <Star className="h-4 w-4 fill-current" style={{ color: colors.accent }} />
                        </div>
                        <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: colors.cardBg }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${percentage}%`, background: colors.accent }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm" style={{ color: colors.textSecondary }}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {courseReviews.length > 0 ? (
                  courseReviews.map(function (review) {
                    const reviewDisplayName =
                      String(review.user_name || "").trim() ||
                      [review.first_name, review.last_name].filter(Boolean).join(" ").trim() ||
                      review.user_id;

                    return (
                      <div
                        key={review.id}
                        className="rounded-[24px] border p-5"
                        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
                              {review.user_name || review.user_id}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {Array.from({ length: 5 }).map(function (_, index) {
                                const starValue = index + 1;
                                return (
                                  <Star
                                    key={starValue}
                                    className="h-4 w-4"
                                    style={{
                                      color: starValue <= review.rating ? colors.accent : colors.textMuted,
                                      fill: starValue <= review.rating ? colors.accent : "transparent",
                                    }}
                                  />
                                );
                              })}
                              <span className="ml-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
                                {review.rating}/5
                              </span>
                            </div>
                          </div>
                        <p className="text-sm" style={{ color: colors.textMuted }}>
                          {formatDateTime(review.created_at)}
                        </p>
                      </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-[18px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                              Contact
                            </p>
                            <p className="mt-2 text-sm font-medium" style={{ color: colors.text }}>
                              {reviewDisplayName}
                            </p>
                            <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                              {String(review.email || "").trim() || "No email shared"}
                            </p>
                          </div>

                          <div className="rounded-[18px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                              Why this rating
                            </p>
                            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                              {String(review.rating_reason || "").trim() || "No rating reason was added."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <div className="rounded-[18px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                              What they liked or disliked
                            </p>
                            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                              {String(review.workshop_feedback || review.review_text || "").trim() || "No workshop feedback was added."}
                            </p>
                          </div>

                          <div className="rounded-[18px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                              Any other feedback
                            </p>
                            <p className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>
                              {String(review.other_feedback || "").trim() || "No additional feedback was added."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                    No course feedback has been submitted yet.
                  </div>
                )}
              </div>
            </>
          )}
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


<div className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-9">
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
