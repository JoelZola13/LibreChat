import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Award, BookOpen, CalendarDays, Loader2, Sparkles, Target, Video, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { listSessions, type LiveSession } from "./api/live-sessions";
import { listCourseScheduleItems, type CourseScheduleItem } from "./api/course-schedule";
import { useAcademyUserId } from "./useAcademyUserId";
import { useAcademyLearningPaths } from "./useAcademyLearningPaths";
import { sbFetch } from "../shared/sbFetch";
import type { Cohort } from "../lib/api/cohorts";
import { getCourseCardArt, getLearningPathCardArt } from "./academyCardArt";
import { getLearningPathDurationLabel } from "./academyLearningPaths";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  level?: string | null;
  state?: string;
  instructor_id?: string | null;
  instructor_name?: string | null;
  instructor?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type InstructorTab =
  | "schedule"
  | "generate"
  | "courses"
  | "add-course"
  | "learning-path-generator"
  | "certificate-generator";

type LearnerOption = {
  user_id: string;
  course_id: string;
  status: string;
};

type AwardTargetType = "course" | "learning_path";

type ScheduleItem = {
  id: string;
  courseId: string;
  courseTitle: string;
  date: string;
  kind: "Live Session" | "Cohort" | "Assignment" | "Reading" | "Material";
  title: string;
  subtitle: string;
  href: string;
};

const COURSE_WEEKDAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

function getInstructorTab(pathname: string): InstructorTab {
  if (pathname.endsWith("/certificate-generator")) return "certificate-generator";
  if (pathname.endsWith("/learning-path-generator")) return "learning-path-generator";
  if (pathname.endsWith("/add-course")) return "add-course";
  if (pathname.endsWith("/generate")) return "generate";
  if (pathname.endsWith("/courses")) return "courses";
  return "schedule";
}

export default function AcademyInstructorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const instructorId = useAcademyUserId();
  const { paths: learningPaths, refresh: refreshLearningPaths } = useAcademyLearningPaths();
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const activeTab = getInstructorTab(location.pathname);
  const basePath = location.pathname.startsWith("/learning") ? "/learning/instructor" : "/academy/instructor";
  const academyRootPath = location.pathname.startsWith("/learning") ? "/learning" : "/academy";

  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [courseScheduleItems, setCourseScheduleItems] = useState<CourseScheduleItem[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [claimingCourseId, setClaimingCourseId] = useState<string | null>(null);
  const [addCourseMessage, setAddCourseMessage] = useState<string | null>(null);

  const [genTopic, setGenTopic] = useState("");
  const [genLevel, setGenLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [genCategory, setGenCategory] = useState("");
  const [genDuration, setGenDuration] = useState("");
  const [genInstructor, setGenInstructor] = useState("");
  const [genOverview, setGenOverview] = useState("");
  const [genRequirements, setGenRequirements] = useState("");
  const [genOutcomes, setGenOutcomes] = useState("");
  const [genDelivery, setGenDelivery] = useState("Online and In person");
  const [genStartDate, setGenStartDate] = useState("");
  const [genMeetingDays, setGenMeetingDays] = useState<string[]>([]);
  const [genScheduleNotes, setGenScheduleNotes] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [pendingDeleteCourseId, setPendingDeleteCourseId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [pathTitle, setPathTitle] = useState("");
  const [selectedPathCourseIds, setSelectedPathCourseIds] = useState<string[]>([]);
  const [creatingPath, setCreatingPath] = useState(false);
  const [pathResult, setPathResult] = useState<string | null>(null);
  const [pendingDeletePathSlug, setPendingDeletePathSlug] = useState<string | null>(null);
  const [deletingPathSlug, setDeletingPathSlug] = useState<string | null>(null);
  const [certificateAwardType, setCertificateAwardType] = useState<AwardTargetType>("course");
  const [certificateTargetId, setCertificateTargetId] = useState("");
  const [certificateRecipientId, setCertificateRecipientId] = useState("");
  const [certificateFullName, setCertificateFullName] = useState("");
  const [certificateDate, setCertificateDate] = useState(new Date().toISOString().slice(0, 10));
  const [certificateSignature, setCertificateSignature] = useState("Street Voices Academy");
  const [issuingCertificate, setIssuingCertificate] = useState(false);
  const [certificateResult, setCertificateResult] = useState<string | null>(null);
  const [eligibleLearners, setEligibleLearners] = useState<LearnerOption[]>([]);
  const [loadingEligibleLearners, setLoadingEligibleLearners] = useState(false);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.56)",
      cardBgStrong: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255,255,255,0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255,255,255,0.45)" : "#6b7280",
      accent: "#F97316",
    }),
    [isDark],
  );

  const loadWorkspaceData = useCallback(async () => {
    setWorkspaceLoading(true);

    try {
      const [coursesResp, allCoursesResp, cohortsResp, liveSessionData] = await Promise.all([
        sbFetch(`/api/academy/courses?instructor_id=${encodeURIComponent(instructorId)}`),
        sbFetch("/api/academy/courses?limit=100"),
        sbFetch(`/api/academy/cohorts?instructor_id=${encodeURIComponent(instructorId)}`),
        listSessions({ instructorId }),
      ]);

      const courseData = coursesResp.ok ? await coursesResp.json() : [];
      const allCourseData = allCoursesResp.ok ? await allCoursesResp.json() : [];
      const cohortData = cohortsResp.ok ? await cohortsResp.json() : [];
      const liveSessions = liveSessionData.sessions || [];

      const normalizedCourses = Array.isArray(courseData) ? courseData : [];
      const instructorCourseIds = new Set(normalizedCourses.map((course: Course) => course.id));
      const scheduleGroups = await Promise.all(
        normalizedCourses.map(async (course: Course) => {
          try {
            return await listCourseScheduleItems(course.id);
          } catch {
            return [];
          }
        }),
      );

      setCourses(normalizedCourses);
      setAllCourses(Array.isArray(allCourseData) ? allCourseData : []);
      setCohorts(
        (Array.isArray(cohortData) ? cohortData : []).filter((cohort: Cohort) => instructorCourseIds.has(cohort.course_id)),
      );
      setSessions(liveSessions.filter((session) => instructorCourseIds.has(session.course_id) && session.status !== "cancelled"));
      setCourseScheduleItems(scheduleGroups.flat());
    } catch {
      setCourses([]);
      setAllCourses([]);
      setCohorts([]);
      setSessions([]);
      setCourseScheduleItems([]);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const resetGenerateForm = useCallback(() => {
    setEditingCourseId(null);
    setGenTopic("");
    setGenLevel("beginner");
    setGenCategory("");
    setGenDuration("");
    setGenInstructor("");
    setGenOverview("");
    setGenRequirements("");
    setGenOutcomes("");
    setGenDelivery("Online and In person");
    setGenStartDate("");
    setGenMeetingDays([]);
    setGenScheduleNotes("");
  }, []);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim()) return;

    setGenerating(true);
    setGenResult(null);

    try {
      const requirementTags = splitTextareaLines(genRequirements).map((item) => `requirement:${item}`);
      const outcomeTags = splitTextareaLines(genOutcomes).map((item) => `outcome:${item}`);
      const deliveryTags = genDelivery.trim() ? [`delivery:${genDelivery.trim()}`] : [];
      const startDateTags = genStartDate.trim() ? [`start_date:${genStartDate.trim()}`] : [];
      const meetingDayTags = genMeetingDays.map((day) => `meeting_day:${day}`);
      const scheduleNoteTags = normalizeScheduleNotes(genScheduleNotes)
        ? [`schedule_notes:${normalizeScheduleNotes(genScheduleNotes)}`]
        : [];
      const existingCourse = editingCourseId ? allCourses.find((course) => course.id === editingCourseId) ?? null : null;
      const extraExistingTags = Array.isArray(existingCourse?.tags)
        ? existingCourse.tags.filter((tag) => !isManagedCourseTag(tag))
        : [];
      const payload = {
        title: genTopic,
        description: genOverview.trim() || `AI-generated Academy course: ${genTopic}`,
        level: genLevel,
        category: genCategory || undefined,
        duration: genDuration || undefined,
        state: "published",
        instructor_name: genInstructor || existingCourse?.instructor_name || "Street Voices Academy",
        instructor_id: existingCourse?.instructor_id || instructorId,
        tags: [
          ...extraExistingTags,
          "academy",
          "ai-generated",
          ...deliveryTags,
          ...startDateTags,
          ...meetingDayTags,
          ...scheduleNoteTags,
          ...requirementTags,
          ...outcomeTags,
        ],
      };

      const resp = await sbFetch(editingCourseId ? `/api/academy/courses/${editingCourseId}` : "/api/academy/courses", {
        method: editingCourseId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error(`Failed to ${editingCourseId ? "update" : "create"} course: ${resp.status}`);
      }

      const course = await resp.json();
      setGenResult(
        editingCourseId
          ? `${course.title} was updated successfully.`
          : `Course created successfully. Open ${course.title} in Courses.`,
      );
      resetGenerateForm();
      await loadWorkspaceData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGenResult(`Error: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleEditCourse = (course: Course) => {
    const tagSections = parseCourseTags(course.tags);
    setEditingCourseId(course.id);
    setPendingDeleteCourseId(null);
    setGenResult(`Editing ${course.title}. Update the details below and save your changes.`);
    setGenTopic(course.title || "");
    setGenLevel(normalizeCourseLevel(course.level));
    setGenCategory(course.category || "");
    setGenDuration(course.duration || "");
    setGenInstructor(course.instructor_name || course.instructor || "Street Voices Academy");
    setGenOverview(course.description || "");
    setGenRequirements(tagSections.requirements.join("\n"));
    setGenOutcomes(tagSections.outcomes.join("\n"));
    setGenDelivery(tagSections.delivery);
    setGenStartDate(tagSections.startDate);
    setGenMeetingDays(tagSections.meetingDays);
    setGenScheduleNotes(tagSections.scheduleNotes);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCancelEditingCourse = () => {
    resetGenerateForm();
    setGenResult("Course editing cancelled.");
  };

  const handleDeleteCourse = async (course: Course) => {
    setDeletingCourseId(course.id);
    setGenResult(null);

    try {
      const response = await sbFetch(`/api/academy/courses/${course.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete course: ${response.status}`);
      }

      if (editingCourseId === course.id) {
        resetGenerateForm();
      }

      setPendingDeleteCourseId(null);
      setGenResult(`${course.title} was deleted from the Academy.`);
      await loadWorkspaceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete this course right now.";
      setGenResult(`Error: ${message}`);
    } finally {
      setDeletingCourseId(null);
    }
  };

  const toggleMeetingDay = (day: string) => {
    setGenMeetingDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  };

  const handleClaimCourse = async (course: Course) => {
    if (claimingCourseId || course.instructor_id === instructorId) {
      return;
    }

    setClaimingCourseId(course.id);
    setAddCourseMessage(null);

    try {
      const resp = await sbFetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: instructorId,
          instructor_name: course.instructor_name || "Street Voices Academy",
        }),
      });

      if (!resp.ok) {
        throw new Error(`Failed to add course: ${resp.status}`);
      }

      setAddCourseMessage(`${course.title} was added to your teaching courses.`);
      await loadWorkspaceData();
      navigate(`${basePath}/courses`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to add this course right now.";
      setAddCourseMessage(`Error: ${msg}`);
    } finally {
      setClaimingCourseId(null);
    }
  };

  const handleUndoClaimCourse = async (course: Course) => {
    if (claimingCourseId || course.instructor_id !== instructorId) {
      return;
    }

    setClaimingCourseId(course.id);
    setAddCourseMessage(null);

    try {
      const resp = await sbFetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructor_id: null,
          instructor_name: null,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Failed to remove course: ${resp.status}`);
      }

      setAddCourseMessage(`${course.title} was removed from your teaching courses.`);
      await loadWorkspaceData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to remove this course right now.";
      setAddCourseMessage(`Error: ${msg}`);
    } finally {
      setClaimingCourseId(null);
    }
  };

  const togglePathCourseSelection = (courseId: string) => {
    setSelectedPathCourseIds((current) =>
      current.includes(courseId) ? current.filter((item) => item !== courseId) : [...current, courseId],
    );
  };

  const handleCreateLearningPath = async (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = pathTitle.trim();
    const selectedCourses = availablePathCourses.filter((course) => selectedPathCourseIds.includes(course.id));
    if (!cleanTitle || selectedCourses.length === 0) {
      return;
    }

    setCreatingPath(true);
    setPathResult(null);

    try {
      const payload = buildLearningPathPayload(cleanTitle, selectedCourses, instructorId);
      const response = await sbFetch("/api/academy/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create program: ${response.status}`);
      }

      const createdPath = await response.json();
      setPathResult(`Program created successfully. Open ${createdPath.title} in Programs.`);
      setPathTitle("");
      setSelectedPathCourseIds([]);
      await refreshLearningPaths();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create this program right now.";
      setPathResult(`Error: ${message}`);
    } finally {
      setCreatingPath(false);
    }
  };

  const handleDeleteLearningPath = async (pathSlug: string) => {
    setDeletingPathSlug(pathSlug);
    setPathResult(null);

    try {
      const response = await sbFetch(`/api/academy/learning-paths/${pathSlug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete program: ${response.status}`);
      }

      setPathResult("Program deleted successfully.");
      setPendingDeletePathSlug(null);
      await refreshLearningPaths();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete this program right now.";
      setPathResult(`Error: ${message}`);
    } finally {
      setDeletingPathSlug(null);
    }
  };

  const courseTitleById = useMemo(() => {
    return new Map(courses.map((course) => [course.id, course.title]));
  }, [courses]);

  const courseSessionCounts = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.course_id] = (acc[session.course_id] || 0) + 1;
      return acc;
    }, {});
  }, [sessions]);

  const courseCohortCounts = useMemo(() => {
    return cohorts.reduce<Record<string, number>>((acc, cohort) => {
      acc[cohort.course_id] = (acc[cohort.course_id] || 0) + 1;
      return acc;
    }, {});
  }, [cohorts]);

  const availablePathCourses = useMemo(
    () => allCourses.filter((course) => !course.state || course.state === "published"),
    [allCourses],
  );

  const generatedPaths = useMemo(
    () => learningPaths.filter((path) => path.source === "generated"),
    [learningPaths],
  );

  const certificateCourseTargets = useMemo(
    () => courses.filter((course) => !course.state || course.state === "published"),
    [courses],
  );

  const certificatePathTargets = useMemo(
    () => learningPaths,
    [learningPaths],
  );

  const selectedCertificateCourse = useMemo(
    () => certificateCourseTargets.find((course) => course.id === certificateTargetId) ?? null,
    [certificateCourseTargets, certificateTargetId],
  );

  const selectedCertificatePath = useMemo(
    () => certificatePathTargets.find((path) => path.slug === certificateTargetId) ?? null,
    [certificatePathTargets, certificateTargetId],
  );

  const selectedCertificateTargetTitle =
    certificateAwardType === "course"
      ? selectedCertificateCourse?.title || ""
      : selectedCertificatePath?.title || "";

  useEffect(() => {
    if (certificateAwardType !== "course" || !certificateTargetId) {
      setEligibleLearners([]);
      setLoadingEligibleLearners(false);
      return;
    }

    let isMounted = true;
    setLoadingEligibleLearners(true);

    void (async () => {
      try {
        const response = await sbFetch(`/api/academy/enrollments?course_id=${encodeURIComponent(certificateTargetId)}`);
        const rows = response.ok ? await response.json() : [];
        if (!isMounted) {
          return;
        }

        setEligibleLearners(
          (Array.isArray(rows) ? rows : [])
            .filter((item) => item?.user_id && item?.status !== "dropped")
            .map((item) => ({
              user_id: String(item.user_id),
              course_id: String(item.course_id || certificateTargetId),
              status: String(item.status || "active"),
            })),
        );
      } catch {
        if (isMounted) {
          setEligibleLearners([]);
        }
      } finally {
        if (isMounted) {
          setLoadingEligibleLearners(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [certificateAwardType, certificateTargetId]);

  useEffect(() => {
    setCertificateRecipientId("");
    setCertificateFullName("");
    setCertificateResult(null);
  }, [certificateAwardType, certificateTargetId]);

  const handleIssueCertificate = async (event: FormEvent) => {
    event.preventDefault();
    const recipientId = certificateRecipientId.trim();
    const recipientName = certificateFullName.trim();
    if (!recipientId || !recipientName || !certificateTargetId) {
      return;
    }

    setIssuingCertificate(true);
    setCertificateResult(null);

    try {
      const response = await sbFetch("/api/academy/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: recipientId,
          recipient_name: recipientName,
          target_type: certificateAwardType,
          target_id: certificateTargetId,
          target_title: selectedCertificateTargetTitle,
          course_id: certificateAwardType === "course" ? certificateTargetId : null,
          learning_path_id: certificateAwardType === "learning_path" ? certificateTargetId : null,
          award_date: certificateDate,
          issued_by: instructorId,
          issuer_name: "Street Voices Academy",
          signature_name: certificateSignature.trim() || "Street Voices Academy",
          certificate_title: "Certificate of Achievement",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to issue certificate: ${response.status}`);
      }

      setCertificateResult(`Certificate sent to ${recipientName}. It is now available in the student's Certificates tab.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to issue this certificate right now.";
      setCertificateResult(`Error: ${message}`);
    } finally {
      setIssuingCertificate(false);
    }
  };

  const handlePrintCertificate = () => {
    const recipientName = certificateFullName.trim();
    if (!recipientName || !selectedCertificateTargetTitle) {
      setCertificateResult("Add a student name and choose a course or program before printing.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1120,height=800");
    if (!printWindow) {
      setCertificateResult("Allow pop-ups to print this certificate preview.");
      return;
    }

    printWindow.document.write(buildCertificatePrintMarkup({
      recipientName,
      targetTitle: selectedCertificateTargetTitle,
      awardType: certificateAwardType,
      awardDate: certificateDate,
      signatureName: certificateSignature.trim() || "Street Voices Academy",
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const plannedItems = courseScheduleItems.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      courseTitle: courseTitleById.get(item.courseId) || "Academy course",
      date: item.scheduledAt,
      kind:
        item.category === "assignment"
          ? ("Assignment" as const)
          : item.category === "reading"
            ? ("Reading" as const)
            : ("Material" as const),
      title: item.title,
      subtitle:
        item.notes ||
        (item.category === "assignment"
          ? "Assignment shared with enrolled learners."
          : item.category === "reading"
            ? "Reading shared with enrolled learners."
            : "Material shared with enrolled learners."),
      href: `${basePath}/courses/${item.courseId}`,
    }));

    const items = [
      ...sessions.map((session) => ({
        id: `session-${session.id}`,
        courseId: session.course_id,
        courseTitle: courseTitleById.get(session.course_id) || "Academy course",
        date: session.scheduled_start,
        kind: "Live Session" as const,
        title: session.title,
        subtitle: session.description || "Live session for enrolled learners.",
        href: `${basePath}/courses/${session.course_id}`,
      })),
      ...cohorts.map((cohort) => ({
        id: `cohort-${cohort.id}`,
        courseId: cohort.course_id,
        courseTitle: courseTitleById.get(cohort.course_id) || "Academy course",
        date: cohort.start_date,
        kind: "Cohort" as const,
        title: cohort.name,
        subtitle: "Guided cohort support for enrolled learners.",
        href: `${basePath}/courses/${cohort.course_id}`,
      })),
      ...plannedItems,
    ];

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [basePath, cohorts, courseScheduleItems, courseTitleById, sessions]);

  const topTabs: Array<{ tab: InstructorTab; label: string; href: string; icon: LucideIcon }> = [
    { tab: "schedule", label: "Schedule", href: `${basePath}/schedule`, icon: CalendarDays },
    { tab: "generate", label: "Generate Course", href: `${basePath}/generate`, icon: Sparkles },
    {
      tab: "certificate-generator",
      label: "Certificate Generator",
      href: `${basePath}/certificate-generator`,
      icon: Award,
    },
    {
      tab: "learning-path-generator",
      label: "Program Generator",
      href: `${basePath}/learning-path-generator`,
      icon: Target,
    },
    { tab: "courses", label: "Courses", href: `${basePath}/courses`, icon: BookOpen },
    { tab: "add-course", label: "Add Course", href: `${basePath}/add-course`, icon: Video },
  ];

  const renderScheduleTab = () => (
    <div className="space-y-5">
      <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
          Schedule
        </p>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
          Your teaching calendar
        </h2>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          A calendar-style view of your live sessions, cohorts, and course updates across every class you teach.
        </p>
      </div>

      {workspaceLoading ? (
        <div className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading schedule...
          </div>
        </div>
      ) : scheduleItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scheduleItems.map((item) => {
            const eventDate = new Date(item.date);
            return (
              <a
                key={item.id}
                href={item.href}
                className="rounded-[24px] border p-5 transition-colors"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex min-w-[76px] flex-col items-center rounded-[20px] px-3 py-3 text-center"
                    style={{ background: isDark ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.12)" }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: colors.accent }}>
                      {eventDate.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="mt-1 text-2xl font-bold" style={{ color: colors.text }}>
                      {eventDate.getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      {item.kind}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
                      {item.courseTitle}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {item.subtitle}
                    </p>
                    <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                      {eventDate.toLocaleString()}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border p-6 text-sm" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
          No live sessions or cohort dates are connected to this instructor yet.
        </div>
      )}
    </div>
  );

  const renderCoursesTab = () => (
    <div className="space-y-5">
      <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
          Courses
        </p>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
          Courses you teach
        </h2>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          Open any course to manage its teaching schedule, live sessions, grading, and learning materials.
        </p>
      </div>

      {workspaceLoading ? (
        <div className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading instructor courses...
          </div>
        </div>
      ) : courses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const visual = getCourseCardArt(course);
            return (
              <a
                key={course.id}
                href={`${basePath}/courses/${course.id}`}
                className="rounded-[24px] border p-5 transition-colors"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <div className="relative mb-5 overflow-hidden rounded-[22px] border" style={{ borderColor: colors.border }}>
                  <img
                    src={visual.src}
                    alt={course.title}
                    className="h-[190px] w-full object-cover"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }
                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = visual.fallbackSrc;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div
                    className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}
                  >
                    {visual.eyebrow}
                  </div>
                </div>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                  {course.category || "Academy"}
                </p>
                <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                  {course.title}
                </h3>
                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {course.description || "This course is ready to be managed inside the instructor teaching view."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                  <span>{course.duration || "Flexible duration"}</span>
                  <span>{courseSessionCounts[course.id] || 0} live sessions</span>
                  <span>{courseCohortCounts[course.id] || 0} cohorts</span>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: colors.accent }}>
                  Open course workspace
                  <Video className="h-4 w-4" />
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border p-6 text-sm" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
          No instructor-owned courses are connected to this account yet.
        </div>
      )}
    </div>
  );

  const renderGenerateTab = () => (
    <div className="space-y-6" style={{ maxWidth: 1120, margin: "0 auto" }}>
      <div
        style={{
          borderRadius: 24,
          border: `1px solid ${colors.border}`,
          background: colors.cardBgStrong,
          backdropFilter: "blur(20px)",
          padding: 28,
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ background: "rgba(249,115,22,0.15)" }}>
            <Sparkles className="h-6 w-6" style={{ color: colors.accent }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              AI Course Generator
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Create a full course in minutes. Enter a topic and generate structured lessons, modules, and outcomes to get started quickly.
            </p>
          </div>
        </div>

        {editingCourseId && (
          <div
            className="mb-4 rounded-[18px] border px-4 py-3 text-sm"
            style={{ borderColor: "rgba(249,115,22,0.26)", background: "rgba(249,115,22,0.08)", color: colors.text }}
          >
            You are editing an existing Academy course. Save your changes below or cancel to return to generator mode.
          </div>
        )}

        {genResult && (
          <div
            className="mb-4 rounded-lg p-3 text-sm"
            style={{
              background: genResult.startsWith("Error") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
              color: genResult.startsWith("Error") ? "#ef4444" : "#22c55e",
              border: `1px solid ${genResult.startsWith("Error") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
            }}
          >
            {genResult}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Topic / Title *
            </label>
            <input
              required
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              style={inputStyle(colors, isDark)}
              placeholder="e.g. Creative Career Readiness"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Level
              </label>
              <select value={genLevel} onChange={(e) => setGenLevel(e.target.value as typeof genLevel)} style={inputStyle(colors, isDark)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Category
              </label>
              <input
                value={genCategory}
                onChange={(e) => setGenCategory(e.target.value)}
                style={inputStyle(colors, isDark)}
                placeholder="e.g. Marketing"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Duration
              </label>
              <input
                value={genDuration}
                onChange={(e) => setGenDuration(e.target.value)}
                style={inputStyle(colors, isDark)}
                placeholder="e.g. 6 weeks"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Instructor Name
              </label>
              <input
                value={genInstructor}
                onChange={(e) => setGenInstructor(e.target.value)}
                style={inputStyle(colors, isDark)}
                placeholder="Street Voices Academy"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Course Overview
            </label>
            <textarea
              value={genOverview}
              onChange={(e) => setGenOverview(e.target.value)}
              rows={4}
              style={{ ...inputStyle(colors, isDark), minHeight: 112, resize: "vertical" }}
              placeholder="Share a short course overview students will see on the course page."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Course Requirements
              </label>
              <textarea
                value={genRequirements}
                onChange={(e) => setGenRequirements(e.target.value)}
                rows={5}
                style={{ ...inputStyle(colors, isDark), minHeight: 128, resize: "vertical" }}
                placeholder="Add one requirement per line"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                What You’ll Learn
              </label>
              <textarea
                value={genOutcomes}
                onChange={(e) => setGenOutcomes(e.target.value)}
                rows={5}
                style={{ ...inputStyle(colors, isDark), minHeight: 128, resize: "vertical" }}
                placeholder="Add one learning outcome per line"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Online and/or In person
            </label>
            <select value={genDelivery} onChange={(e) => setGenDelivery(e.target.value)} style={inputStyle(colors, isDark)}>
              <option value="Online and In person">Online and In person</option>
              <option value="Online">Online</option>
              <option value="In person">In person</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Start Date
              </label>
              <input
                type="date"
                value={genStartDate}
                onChange={(e) => setGenStartDate(e.target.value)}
                style={inputStyle(colors, isDark)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Class Days
              </label>
              <div className="flex flex-wrap gap-2">
                {COURSE_WEEKDAY_OPTIONS.map((day) => {
                  const isSelected = genMeetingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleMeetingDay(day)}
                      className="rounded-full px-3 py-2 text-sm font-semibold"
                      style={{
                        background: isSelected ? "rgba(249,115,22,0.14)" : colors.cardBg,
                        color: isSelected ? colors.accent : colors.textSecondary,
                        border: `1px solid ${isSelected ? "rgba(249,115,22,0.26)" : colors.border}`,
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Additional Schedule Details
            </label>
            <textarea
              value={genScheduleNotes}
              onChange={(e) => setGenScheduleNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle(colors, isDark), minHeight: 96, resize: "vertical" }}
              placeholder="Add any extra schedule details here, like time, weekend dates, or special notes."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={generating || !genTopic.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ background: colors.accent, color: "#fff", border: "none", cursor: generating ? "wait" : "pointer" }}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingCourseId ? "Saving..." : "Generating Course..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {editingCourseId ? "Save Course Changes" : "Generate Course with AI"}
                </>
              )}
            </button>
            {editingCourseId && (
              <button
                type="button"
                onClick={handleCancelEditingCourse}
                className="rounded-lg px-5 py-3 text-sm font-semibold"
                style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
              All Courses
            </p>
            <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
              Manage Academy courses
            </h2>
            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              Edit course details or delete a course directly from the generator workspace.
            </p>
          </div>
          <span className="text-sm" style={{ color: colors.textMuted }}>
            {allCourses.length} total
          </span>
        </div>

        {workspaceLoading ? (
          <div className="mt-5 rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Academy courses...
            </span>
          </div>
        ) : allCourses.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allCourses.map((course) => {
              const visual = getCourseCardArt(course);
              const isEditing = editingCourseId === course.id;
              const isPendingDelete = pendingDeleteCourseId === course.id;
              const isDeleting = deletingCourseId === course.id;

              return (
                <div
                  key={course.id}
                  className="rounded-[22px] border p-5"
                  style={{
                    borderColor: isEditing ? colors.accent : colors.border,
                    background: colors.cardBgStrong,
                  }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[20px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={course.title}
                      className="h-[180px] w-full object-cover"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallbackApplied === "true") {
                          return;
                        }
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = visual.fallbackSrc;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <div
                      className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}
                    >
                      {visual.eyebrow}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                        {course.category || "Academy"}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                        {course.title}
                      </h3>
                    </div>
                    {isEditing && (
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: "rgba(249,115,22,0.14)", color: colors.accent }}
                      >
                        Editing
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                    {course.description || "Academy course ready to be updated from the instructor workspace."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                    <span>{course.duration || "Flexible duration"}</span>
                    <span>{normalizeCourseLevel(course.level)}</span>
                    <span>{course.instructor_name || course.instructor || "Street Voices Academy"}</span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => (isEditing ? handleCancelEditingCourse() : handleEditCourse(course))}
                      className="rounded-full px-4 py-2 text-sm font-semibold"
                      style={{
                        background: isEditing ? "rgba(249,115,22,0.12)" : colors.cardBg,
                        color: isEditing ? colors.accent : colors.text,
                        border: `1px solid ${isEditing ? "rgba(249,115,22,0.22)" : colors.border}`,
                      }}
                    >
                      {isEditing ? "Cancel Edit" : "Edit"}
                    </button>

                    {isPendingDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteCourseId(null)}
                          className="rounded-full px-4 py-2 text-sm font-semibold"
                          style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteCourse(course)}
                          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          style={{ background: "#ef4444", color: "#fff", border: "none" }}
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteCourseId(course.id)}
                        className="rounded-full px-4 py-2 text-sm font-semibold"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[22px] border p-5 text-sm" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
            No Academy courses are available to manage yet.
          </div>
        )}
      </div>
    </div>
  );

  const renderLearningPathGeneratorTab = () => (
    <div className="space-y-6">
      <div
        className="rounded-[28px] border p-6 md:p-7"
        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ background: "rgba(249,115,22,0.15)" }}>
            <Target className="h-6 w-6" style={{ color: colors.accent }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              Program Generator
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Build a guided Academy plan by naming the path and choosing the courses it should include.
            </p>
          </div>
        </div>

        {pathResult && (
          <div
            className="mb-5 rounded-[18px] border px-4 py-3 text-sm"
            style={{
              borderColor: pathResult.startsWith("Error") ? "rgba(239,68,68,0.3)" : colors.border,
              background: pathResult.startsWith("Error") ? "rgba(239,68,68,0.08)" : colors.cardBg,
              color: pathResult.startsWith("Error") ? "#ef4444" : colors.textSecondary,
            }}
          >
            {pathResult}
          </div>
        )}

        <form onSubmit={handleCreateLearningPath} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
              Program Title *
            </label>
            <input
              required
              value={pathTitle}
              onChange={(event) => setPathTitle(event.target.value)}
              style={inputStyle(colors, isDark)}
              placeholder="e.g. Career Confidence Starter Path"
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium" style={{ color: colors.textSecondary }}>
                Choose Courses to Include *
              </label>
              <span className="text-xs" style={{ color: colors.textMuted }}>
                {selectedPathCourseIds.length} selected
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {availablePathCourses.map((course) => {
                const isSelected = selectedPathCourseIds.includes(course.id);
                const visual = getCourseCardArt(course);
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => togglePathCourseSelection(course.id)}
                    className="rounded-[20px] border p-4 text-left transition-colors"
                    style={{
                      borderColor: isSelected ? colors.accent : colors.border,
                      background: isSelected ? "rgba(249,115,22,0.12)" : colors.cardBg,
                    }}
                  >
                    <div className="relative mb-4 overflow-hidden rounded-[18px] border" style={{ borderColor: colors.border }}>
                      <img
                        src={visual.src}
                        alt={course.title}
                        className="h-[150px] w-full object-cover"
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallbackApplied === "true") {
                            return;
                          }
                          event.currentTarget.dataset.fallbackApplied = "true";
                          event.currentTarget.src = visual.fallbackSrc;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      <div
                        className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}
                      >
                        {visual.eyebrow}
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      {course.category || "Academy"}
                    </p>
                    <h3 className="mt-2 text-base font-semibold" style={{ color: colors.text }}>
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                      {course.description || "This course can be added into a guided Academy program."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                      <span>{course.duration || "Flexible duration"}</span>
                      <span>{course.state === "published" || !course.state ? "Published" : course.state}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingPath || !pathTitle.trim() || selectedPathCourseIds.length === 0}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: colors.accent, color: "#fff", border: "none" }}
          >
            {creatingPath ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Program...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Generate Program
              </>
            )}
          </button>
        </form>
      </div>

      <div className="rounded-[28px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
              Generated Paths
            </p>
            <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
              Programs already created
            </h2>
          </div>
          <span className="text-sm" style={{ color: colors.textMuted }}>
            {generatedPaths.length} total
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {generatedPaths.length > 0 ? (
            generatedPaths.map((path) => {
              const isPendingDelete = pendingDeletePathSlug === path.slug;
              const isDeleting = deletingPathSlug === path.slug;
              const visual = getLearningPathCardArt(path);

              return (
                <div
                  key={path.slug}
                  className="rounded-[22px] border p-5"
                  style={{ borderColor: colors.border, background: colors.cardBgStrong }}
                >
                  <div className="relative mb-5 overflow-hidden rounded-[20px] border" style={{ borderColor: colors.border }}>
                    <img
                      src={visual.src}
                      alt={path.title}
                      className="h-[180px] w-full object-cover"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallbackApplied === "true") {
                          return;
                        }
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = visual.fallbackSrc;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <div
                      className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}
                    >
                      {visual.eyebrow}
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                    {path.source === "generated" ? "AI Powered Program" : "Program"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                    {path.title}
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                    {path.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                    <span>{path.courses} courses</span>
                    <span>{getLearningPathDurationLabel(path, allCourses)}</span>
                    <span>{path.level}</span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={`${academyRootPath}/paths/${path.slug}`}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                      style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                    >
                      View Path
                    </a>
                    {isPendingDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPendingDeletePathSlug(null)}
                          className="rounded-full px-4 py-2 text-sm font-semibold"
                          style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteLearningPath(path.slug)}
                          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          style={{ background: "#ef4444", color: "#fff", border: "none" }}
                        >
                          {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeletePathSlug(path.slug)}
                        className="rounded-full px-4 py-2 text-sm font-semibold"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}
                      >
                        Delete Path
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[22px] border p-5 text-sm md:col-span-2 xl:col-span-3" style={{ borderColor: colors.border, background: colors.cardBgStrong, color: colors.textSecondary }}>
              No generated programs yet. Create one above to make it available on the learner program pages.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCertificateGeneratorTab = () => (
    <div className="space-y-6">
      <div
        className="rounded-[28px] border p-6 md:p-7"
        style={{ borderColor: colors.border, background: colors.cardBgStrong }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ background: "rgba(245,158,11,0.14)" }}>
            <Award className="h-6 w-6" style={{ color: "#F59E0B" }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              Certificate Generator
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              AI-powered certificate builder for issuing polished Academy certificates to the right students.
            </p>
          </div>
        </div>

        {certificateResult && (
          <div
            className="mb-5 rounded-[18px] border px-4 py-3 text-sm"
            style={{
              borderColor: certificateResult.startsWith("Error") ? "rgba(239,68,68,0.3)" : colors.border,
              background: certificateResult.startsWith("Error") ? "rgba(239,68,68,0.08)" : colors.cardBg,
              color: certificateResult.startsWith("Error") ? "#ef4444" : colors.textSecondary,
            }}
          >
            {certificateResult}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <form onSubmit={handleIssueCertificate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Award Type
                </label>
                <select
                  value={certificateAwardType}
                  onChange={(event) => setCertificateAwardType(event.target.value as AwardTargetType)}
                  style={inputStyle(colors, isDark)}
                >
                  <option value="course">Course</option>
                  <option value="learning_path">Program</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  {certificateAwardType === "course" ? "Choose Course" : "Choose Program"}
                </label>
                <select
                  value={certificateTargetId}
                  onChange={(event) => setCertificateTargetId(event.target.value)}
                  style={inputStyle(colors, isDark)}
                >
                  <option value="">{certificateAwardType === "course" ? "Select a course" : "Select a program"}</option>
                  {certificateAwardType === "course"
                    ? certificateCourseTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.title}
                        </option>
                      ))
                    : certificatePathTargets.map((target) => (
                        <option key={target.slug} value={target.slug}>
                          {target.title}
                        </option>
                      ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Student User ID *
                </label>
                <input
                  required
                  list="academy-certificate-learners"
                  value={certificateRecipientId}
                  onChange={(event) => setCertificateRecipientId(event.target.value)}
                  style={inputStyle(colors, isDark)}
                  placeholder="academy-learner-1"
                />
                <datalist id="academy-certificate-learners">
                  {eligibleLearners.map((learner) => (
                    <option key={learner.user_id} value={learner.user_id} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Full Name *
                </label>
                <input
                  required
                  value={certificateFullName}
                  onChange={(event) => setCertificateFullName(event.target.value)}
                  style={inputStyle(colors, isDark)}
                  placeholder="Faith Macpherson"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Date
                </label>
                <input
                  type="date"
                  value={certificateDate}
                  onChange={(event) => setCertificateDate(event.target.value)}
                  style={inputStyle(colors, isDark)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>
                  Signature
                </label>
                <input
                  value={certificateSignature}
                  onChange={(event) => setCertificateSignature(event.target.value)}
                  style={inputStyle(colors, isDark)}
                  placeholder="Street Voices Academy"
                />
              </div>
            </div>

            {certificateAwardType === "course" && (
              <div className="rounded-[20px] border p-4" style={{ borderColor: colors.border, background: colors.cardBg }}>
                <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                  Enrolled learners
                </p>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {loadingEligibleLearners
                    ? "Loading students in this course..."
                    : eligibleLearners.length > 0
                      ? "Choose an enrolled student ID or type one manually."
                      : "No enrolled student IDs were found for this course yet."}
                </p>
                {eligibleLearners.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eligibleLearners.map((learner) => (
                      <button
                        key={learner.user_id}
                        type="button"
                        onClick={() => setCertificateRecipientId(learner.user_id)}
                        className="rounded-full px-3 py-2 text-xs font-semibold"
                        style={{
                          background: certificateRecipientId === learner.user_id ? "rgba(245,158,11,0.15)" : colors.cardBgStrong,
                          color: certificateRecipientId === learner.user_id ? "#F59E0B" : colors.textSecondary,
                          border: `1px solid ${certificateRecipientId === learner.user_id ? "rgba(245,158,11,0.3)" : colors.border}`,
                        }}
                      >
                        {learner.user_id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  issuingCertificate ||
                  !certificateTargetId ||
                  !certificateRecipientId.trim() ||
                  !certificateFullName.trim()
                }
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: "#F59E0B", color: "#111", border: "none" }}
              >
                {issuingCertificate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Award className="h-4 w-4" />
                    Send to Student Certificates
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handlePrintCertificate}
                className="rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: colors.cardBg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                Print Certificate
              </button>
            </div>
          </form>

          <div
            className="rounded-[28px] border p-6 md:p-8"
            style={{
              borderColor: "rgba(245,158,11,0.26)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,249,235,0.96) 46%, rgba(250,245,255,0.96) 100%)",
              boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.34em]" style={{ color: "#B45309" }}>
                Street Voices Academy
              </p>
              <h3 className="mt-5 text-3xl font-semibold" style={{ color: "#111827", fontFamily: 'Georgia, "Times New Roman", serif' }}>
                Certificate of Achievement
              </h3>
              <p className="mt-8 text-sm uppercase tracking-[0.28em]" style={{ color: "#6B7280" }}>
                This Certificate is proudly awarded to
              </p>
              <p className="mt-5 text-4xl font-semibold" style={{ color: "#1F2937", fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {certificateFullName.trim() || "Full Name"}
              </p>
              <div className="mx-auto mt-4 h-px w-40" style={{ background: "rgba(180,83,9,0.26)" }} />
              <p className="mx-auto mt-8 max-w-xl text-base leading-8" style={{ color: "#374151" }}>
                For successfully completing this {certificateAwardType === "course" ? "course" : "program"} of{" "}
                <span style={{ fontWeight: 700, color: "#111827" }}>
                  {selectedCertificateTargetTitle || (certificateAwardType === "course" ? "Course Name" : "Program Name")}
                </span>
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <div className="rounded-[20px] border px-5 py-4" style={{ borderColor: "rgba(180,83,9,0.16)", background: "rgba(255,255,255,0.7)" }}>
                <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "#92400E" }}>
                  Date
                </p>
                <p className="mt-3 text-lg font-semibold" style={{ color: "#111827" }}>
                  {new Date(`${certificateDate}T12:00:00`).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="rounded-[20px] border px-5 py-4" style={{ borderColor: "rgba(180,83,9,0.16)", background: "rgba(255,255,255,0.7)" }}>
                <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "#92400E" }}>
                  Signature
                </p>
                <p className="mt-3 text-lg font-semibold" style={{ color: "#111827", fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  {certificateSignature.trim() || "Street Voices Academy"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAddCourseTab = () => (
    <div className="space-y-5">
      <div className="rounded-[24px] border p-5" style={{ borderColor: colors.border, background: colors.cardBg }}>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
          Add Course
        </p>
        <h2 className="mt-2 text-xl font-semibold" style={{ color: colors.text }}>
          Choose a course to teach
        </h2>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          Browse all Academy courses and add the ones you want to teach into your instructor workspace.
        </p>
      </div>

      {addCourseMessage && (
        <div
          className="rounded-[20px] border px-4 py-3 text-sm"
          style={{
            borderColor: addCourseMessage.startsWith("Error") ? "rgba(239,68,68,0.3)" : colors.border,
            background: addCourseMessage.startsWith("Error") ? "rgba(239,68,68,0.08)" : colors.cardBg,
            color: addCourseMessage.startsWith("Error") ? "#ef4444" : colors.textSecondary,
          }}
        >
          {addCourseMessage}
        </div>
      )}

      {workspaceLoading ? (
        <div className="rounded-[24px] border p-6" style={{ borderColor: colors.border, background: colors.cardBg }}>
          <div className="inline-flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Academy courses...
          </div>
        </div>
      ) : allCourses.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allCourses.map((course) => {
            const isMine = course.instructor_id === instructorId;
            const assignedElsewhere = Boolean(course.instructor_id) && !isMine;
            const isClaiming = claimingCourseId === course.id;
            const visual = getCourseCardArt(course);

            return (
              <div
                key={course.id}
                className="rounded-[24px] border p-5"
                style={{ borderColor: colors.border, background: colors.cardBgStrong }}
              >
                <div className="relative mb-5 overflow-hidden rounded-[22px] border" style={{ borderColor: colors.border }}>
                  <img
                    src={visual.src}
                    alt={course.title}
                    className="h-[190px] w-full object-cover"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }
                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = visual.fallbackSrc;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div
                    className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ background: "rgba(15,23,42,0.65)", color: visual.accent }}
                  >
                    {visual.eyebrow}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: colors.textMuted }}>
                      {course.category || "Academy"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold" style={{ color: colors.text }}>
                      {course.title}
                    </h3>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      background: isMine
                        ? "rgba(34,197,94,0.14)"
                        : assignedElsewhere
                          ? "rgba(148,163,184,0.14)"
                          : "rgba(249,115,22,0.14)",
                      color: isMine ? "#22c55e" : assignedElsewhere ? colors.textMuted : colors.accent,
                    }}
                  >
                    {isMine ? "Teaching" : assignedElsewhere ? "Assigned" : "Open"}
                  </span>
                </div>

                <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                  {course.description || "Academy course ready to be added to an instructor workspace."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium" style={{ color: colors.textMuted }}>
                  <span>{course.duration || "Flexible duration"}</span>
                  {course.instructor_name && <span>{course.instructor_name}</span>}
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={assignedElsewhere || isClaiming}
                    onClick={() => void (isMine ? handleUndoClaimCourse(course) : handleClaimCourse(course))}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: isMine ? "rgba(239,68,68,0.12)" : assignedElsewhere ? colors.cardBg : colors.accent,
                      color: isMine ? "#ef4444" : assignedElsewhere ? colors.textSecondary : "#fff",
                      border: `1px solid ${isMine ? "rgba(239,68,68,0.22)" : isMine || assignedElsewhere ? colors.border : colors.accent}`,
                    }}
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isMine ? "Removing..." : "Adding..."}
                      </>
                    ) : isMine ? (
                      "Undo"
                    ) : assignedElsewhere ? (
                      "Currently assigned"
                    ) : (
                      "Teach this course"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border p-6 text-sm" style={{ borderColor: colors.border, background: colors.cardBg, color: colors.textSecondary }}>
          No Academy courses are available to add right now.
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === "add-course") return renderAddCourseTab();
    if (activeTab === "certificate-generator") return renderCertificateGeneratorTab();
    if (activeTab === "courses") return renderCoursesTab();
    if (activeTab === "learning-path-generator") return renderLearningPathGeneratorTab();
    if (activeTab === "generate") return renderGenerateTab();
    return renderScheduleTab();
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href={academyRootPath} className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Academy
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>
            Instructor
          </span>
        </div>

        <section className="mb-6 rounded-[28px] border p-6 md:p-8" style={{ borderColor: colors.border, background: colors.cardBgStrong }}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                style={{ background: "rgba(249,115,22,0.16)", color: colors.accent }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Instructor Workspace
              </div>
              <h1 className="text-3xl font-bold md:text-4xl" style={{ color: colors.text }}>
                Instructor Workspace
              </h1>
              <p className="mt-3 max-w-2xl text-base" style={{ color: colors.textSecondary }}>
                Create, manage, and lead your courses from one place. Build learning experiences, run live sessions, and support your students every step of the way.
              </p>
              <p className="mt-3 text-sm font-medium" style={{ color: colors.textMuted }}>
                Everything you need to guide learners from start to completion — all in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[430px] lg:justify-end">
              {topTabs.map((item) => (
                <a
                  key={item.tab}
                  href={item.href}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap"
                  style={{
                    background: activeTab === item.tab ? colors.accent : colors.cardBg,
                    color: activeTab === item.tab ? "#fff" : colors.text,
                    border: `1px solid ${activeTab === item.tab ? colors.accent : colors.border}`,
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {renderTabContent()}
      </div>
    </div>
  );
}

function splitTextareaLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCourseTags(tags?: string[] | null) {
  const safeTags = Array.isArray(tags) ? tags : [];
  const findByPrefix = (prefix: string) =>
    safeTags
      .filter((tag) => tag.startsWith(prefix))
      .map((tag) => tag.slice(prefix.length).trim())
      .filter(Boolean);

  return {
    requirements: findByPrefix("requirement:"),
    outcomes: findByPrefix("outcome:"),
    delivery: findByPrefix("delivery:")[0] || "Online and In person",
    startDate: findByPrefix("start_date:")[0] || "",
    meetingDays: findByPrefix("meeting_day:"),
    scheduleNotes: findByPrefix("schedule_notes:")[0] || "",
  };
}

function normalizeCourseLevel(level?: string | null): "beginner" | "intermediate" | "advanced" {
  const normalized = String(level || "").trim().toLowerCase();
  if (normalized === "advanced") return "advanced";
  if (normalized === "intermediate") return "intermediate";
  return "beginner";
}

function normalizeScheduleNotes(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function isManagedCourseTag(tag: string) {
  const normalized = tag.toLowerCase();
  return [
    "delivery:",
    "requirement:",
    "outcome:",
    "start_date:",
    "meeting_day:",
    "schedule_notes:",
  ].some((prefix) => normalized.startsWith(prefix));
}

function inputStyle(
  colors: { border: string; text: string },
  isDark: boolean,
): CSSProperties {
  return {
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: colors.text,
    fontSize: 14,
    width: "100%",
    outline: "none",
  };
}

function buildLearningPathPayload(title: string, courses: Course[], instructorId: string) {
  const cleanedTitle = title.trim();
  const courseTitles = courses.map((course) => course.title);
  const categories = Array.from(
    new Set(
      courses
        .map((course) => course.category?.trim().toLowerCase())
        .filter((category): category is string => Boolean(category)),
    ),
  );
  const hours = Math.max(courses.length * 8, 8);
  const level = derivePathLevel(courses);

  return {
    title: cleanedTitle,
    description: `${cleanedTitle} is a guided Street Voices Academy plan that connects ${joinTitleList(courseTitles)} into one clear learning journey.`,
    hours,
    level,
    delivery_mode: "Online and In person",
    color: "#F97316",
    requirements: [
      "No previous Academy experience is required to begin.",
      "Be ready to move through the selected courses in order.",
      "Join live or in-person support sessions when available.",
    ],
    what_youll_learn: courseTitles.map((courseTitle) => `Build practical confidence through ${courseTitle}.`),
    milestones: courseTitles.map((courseTitle, index) => `Step ${index + 1}: Complete ${courseTitle}.`),
    outcomes: [
      `Finish a guided plan across ${courses.length} Academy ${courses.length === 1 ? "course" : "courses"}.`,
      "Build steady progress with a clear next step after each class.",
      "Move toward your goal with one connected Academy program.",
    ],
    preferred_categories: categories,
    course_ids: courses.map((course) => course.id),
    created_by: instructorId,
    source: "generated",
  };
}

function derivePathLevel(courses: Course[]) {
  const levels = courses.map((course) => String(course.level || "").toLowerCase());
  if (levels.includes("advanced")) {
    return "Advanced";
  }
  if (levels.includes("intermediate")) {
    return "Intermediate";
  }
  return "Beginner";
}

function joinTitleList(titles: string[]) {
  if (titles.length <= 1) {
    return titles[0] || "selected courses";
  }
  if (titles.length === 2) {
    return `${titles[0]} and ${titles[1]}`;
  }
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

function buildCertificatePrintMarkup({
  recipientName,
  targetTitle,
  awardType,
  awardDate,
  signatureName,
}: {
  recipientName: string;
  targetTitle: string;
  awardType: AwardTargetType;
  awardDate: string;
  signatureName: string;
}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeTargetTitle = escapeHtml(targetTitle);
  const safeAwardDate = escapeHtml(
    new Date(`${awardDate}T12:00:00`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );
  const safeSignatureName = escapeHtml(signatureName);
  const safeAwardType = awardType === "course" ? "course" : "program";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Street Voices Academy Certificate</title>
      <style>
        body {
          margin: 0;
          padding: 32px;
          background: #f5f3ff;
          font-family: "Helvetica Neue", Arial, sans-serif;
          color: #111827;
        }
        .certificate {
          max-width: 1040px;
          margin: 0 auto;
          padding: 56px 64px;
          border: 1px solid rgba(180, 83, 9, 0.22);
          border-radius: 28px;
          background: linear-gradient(135deg, #ffffff 0%, #fff9eb 48%, #faf5ff 100%);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
        }
        .academy {
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.34em;
          font-size: 12px;
          font-weight: 700;
          color: #b45309;
        }
        .title {
          margin-top: 24px;
          text-align: center;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 44px;
          font-weight: 600;
        }
        .subtitle {
          margin-top: 36px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.28em;
          color: #6b7280;
          font-size: 12px;
        }
        .recipient {
          margin-top: 24px;
          text-align: center;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 48px;
          font-weight: 600;
        }
        .line {
          width: 180px;
          height: 1px;
          margin: 20px auto 0;
          background: rgba(180, 83, 9, 0.26);
        }
        .body-copy {
          max-width: 720px;
          margin: 40px auto 0;
          text-align: center;
          line-height: 1.85;
          font-size: 19px;
          color: #374151;
        }
        .body-copy strong {
          color: #111827;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-top: 56px;
        }
        .footer-card {
          border: 1px solid rgba(180, 83, 9, 0.16);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.74);
          padding: 20px 24px;
        }
        .footer-label {
          text-transform: uppercase;
          letter-spacing: 0.24em;
          font-size: 11px;
          color: #92400e;
        }
        .footer-value {
          margin-top: 12px;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }
        .signature-value {
          font-family: Georgia, "Times New Roman", serif;
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="academy">Street Voices Academy</div>
        <div class="title">Certificate of Achievement</div>
        <div class="subtitle">This Certificate is proudly awarded to</div>
        <div class="recipient">${safeRecipientName}</div>
        <div class="line"></div>
        <div class="body-copy">
          For successfully completing this ${safeAwardType} of <strong>${safeTargetTitle}</strong>
        </div>
        <div class="footer-grid">
          <div class="footer-card">
            <div class="footer-label">Date</div>
            <div class="footer-value">${safeAwardDate}</div>
          </div>
          <div class="footer-card">
            <div class="footer-label">Signature</div>
            <div class="footer-value signature-value">${safeSignatureName}</div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
