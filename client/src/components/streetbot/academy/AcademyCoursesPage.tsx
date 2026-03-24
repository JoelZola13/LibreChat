import { useEffect, useMemo, useState, useCallback } from "react";
import { BookOpen, Clock, MessageCircle, Search, Filter, Users, Star, Plus, ArrowLeft, ChevronRight } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type Course = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  duration?: string | null;
  category?: string | null;
  image_url?: string | null;
  instructor_name?: string | null;
  instructor?: string;
  state?: "draft" | "published" | "archived";
  tags?: string[];
  module_count?: number;
  lesson_count?: number;
  enrolled_count?: number;
  created_at?: string;
  updated_at?: string;
  progress?: number;
};

type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "dropped";
  progress_percent: number;
  enrolled_at: string;
  completed_at?: string | null;
  last_accessed_at?: string | null;
};

const CURRENT_USER_ID = "user-123";
const categories = ["All", "Technology", "Business", "Marketing", "Design", "Development"];
const levels = ["All Levels", "Beginner", "Intermediate", "Advanced"];

export default function AcademyCoursesPage() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"browse" | "my-courses" | "create">("browse");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterLevel, setFilterLevel] = useState("All Levels");
  const [searchQuery, setSearchQuery] = useState("");

  // Course creation form
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    level: "beginner" as "beginner" | "intermediate" | "advanced",
    duration: "",
    category: "",
    image_url: "",
    instructor_name: "",
    tags: "",
  });
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const colors = useMemo(
    () => ({
      bg: "var(--sb-color-background)",
      cardBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.35)",
      border: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.6)",
      text: isDark ? "#fff" : "#111",
      textSecondary: isDark ? "rgba(255, 255, 255, 0.72)" : "#4b5563",
      textMuted: isDark ? "rgba(255, 255, 255, 0.5)" : "#6b7280",
      accent: "#FFD600",
      shadow: isDark ? "0 10px 30px rgba(0, 0, 0, 0.35)" : "0 10px 30px rgba(31, 38, 135, 0.16)",
    }),
    [isDark],
  );

  const loadCourses = useCallback(async () => {
    try {
      const resp = await sbFetch("/api/academy/courses");
      if (!resp.ok) throw new Error(`Failed to load courses (${resp.status})`);
      const data = await resp.json();
      setCourses(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load courses";
      setError(msg);
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    try {
      const resp = await sbFetch(`/api/academy/enrollments?user_id=${CURRENT_USER_ID}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setEnrollments(Array.isArray(data) ? data : []);
    } catch {
      // Enrollments are optional
    }
  }, []);

  useEffect(() => {
    Promise.all([loadCourses(), loadEnrollments()]).finally(() => setIsLoading(false));
  }, [loadCourses, loadEnrollments]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);
    try {
      const resp = await sbFetch("/api/academy/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!resp.ok) throw new Error("Failed to create course");
      const course = await resp.json();
      // Auto-publish the course
      await sbFetch(`/api/academy/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "published" }),
      });
      setFormMessage("Course created and published!");
      setDraft({ title: "", description: "", level: "beginner", duration: "", category: "", image_url: "", instructor_name: "", tags: "" });
      loadCourses();
      setActiveTab("browse");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error creating course";
      setFormMessage(msg);
    }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      const resp = await sbFetch("/api/academy/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId, user_id: CURRENT_USER_ID }),
      });
      if (resp.ok) {
        loadEnrollments();
      }
    } catch {
      // silent fail
    }
  };

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));

  const filteredCourses = courses.filter((course) => {
    if (course.state && course.state !== "published") return false;
    if (filterCategory !== "All" && course.category !== filterCategory) return false;
    if (filterLevel !== "All Levels" && course.level?.toLowerCase() !== filterLevel.toLowerCase()) return false;
    if (searchQuery && !course.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const myCourses = courses.filter((c) => enrolledCourseIds.has(c.id));

  const tabStyle = (active: boolean) => ({
    padding: "8px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600 as const,
    cursor: "pointer" as const,
    border: "none",
    background: active ? colors.accent : "transparent",
    color: active ? "#000" : colors.textSecondary,
    transition: "all 0.2s",
  });

  const inputStyle = {
    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: colors.text,
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "88px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href="/academy" className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>Academy</a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>Courses</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Courses</h1>
            <p className="mt-2" style={{ color: colors.textSecondary }}>
              Explore all academy courses and continue where you left off.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-2" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius: 14, padding: 4, display: "inline-flex" }}>
          <button style={tabStyle(activeTab === "browse")} onClick={() => setActiveTab("browse")}>
            <BookOpen className="mr-2 inline h-4 w-4" />Browse
          </button>
          <button style={tabStyle(activeTab === "my-courses")} onClick={() => setActiveTab("my-courses")}>
            <Star className="mr-2 inline h-4 w-4" />My Courses ({myCourses.length})
          </button>
          <button style={tabStyle(activeTab === "create")} onClick={() => setActiveTab("create")}>
            <Plus className="mr-2 inline h-4 w-4" />Create
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: "rgba(255,100,100,0.15)", color: "#ff6b6b", border: "1px solid rgba(255,100,100,0.3)" }}>
            {error}
          </div>
        )}

        {/* Browse tab */}
        {activeTab === "browse" && (
          <>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative" style={{ flex: "1 1 200px", maxWidth: 320 }}>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.textMuted }} />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle as React.CSSProperties}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={inputStyle as React.CSSProperties}>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ height: 260, borderRadius: 20, border: `1px solid ${colors.border}`, background: colors.cardBg, backdropFilter: "blur(20px)" }} />
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="py-16 text-center" style={{ color: colors.textMuted }}>
                <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-40" />
                <p className="text-lg font-medium">No courses found</p>
                <p className="mt-1 text-sm">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => {
                  const isEnrolled = enrolledCourseIds.has(course.id);
                  const enrollment = enrollments.find((e) => e.course_id === course.id);
                  const displayInstructor = course.instructor_name || course.instructor;
                  return (
                    <article
                      key={course.id}
                      style={{
                        borderRadius: 20,
                        border: `1px solid ${colors.border}`,
                        background: colors.cardBg,
                        backdropFilter: "blur(20px)",
                        padding: 20,
                        boxShadow: colors.shadow,
                        cursor: "pointer",
                      }}
                      onClick={() => { window.location.href = `/academy/courses/${course.id}`; }}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                            {course.category || "General"}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold" style={{ color: colors.text }}>{course.title}</h2>
                        </div>
                        <BookOpen className="h-5 w-5 flex-shrink-0" style={{ color: colors.accent }} />
                      </div>

                      <p className="mb-4 line-clamp-2 text-sm" style={{ color: colors.textSecondary }}>
                        {course.description || "No description available."}
                      </p>

                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.textMuted }}>
                        <span>{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : "All levels"}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />{course.duration || "Self-paced"}
                        </span>
                        {(course.module_count ?? 0) > 0 && <span>{course.module_count} modules</span>}
                        {(course.lesson_count ?? 0) > 0 && <span>{course.lesson_count} lessons</span>}
                        {(course.enrolled_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />{course.enrolled_count}
                          </span>
                        )}
                      </div>

                      {displayInstructor && (
                        <p className="mb-3 text-xs" style={{ color: colors.textMuted }}>By {displayInstructor}</p>
                      )}

                      {enrollment && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span style={{ color: colors.textSecondary }}>Progress</span>
                            <span style={{ color: colors.accent }}>{enrollment.progress_percent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
                            <div className="h-full rounded-full" style={{ width: `${enrollment.progress_percent}%`, background: colors.accent }} />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                            Enrolled
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEnroll(course.id); }}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium"
                            style={{ background: colors.accent, color: "#000", border: "none" }}>
                            Enroll <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const context = encodeURIComponent(`I have a question about the course "${course.title}". Can you help me?`);
                            window.location.href = `/chat?context=${context}`;
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium"
                          style={{
                            background: isDark ? "rgba(255, 214, 0, 0.12)" : "rgba(255, 214, 0, 0.18)",
                            border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.3)" : "rgba(255, 214, 0, 0.45)"}`,
                            color: colors.accent,
                          }}>
                          <MessageCircle className="h-3.5 w-3.5" /> Ask
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* My Courses tab */}
        {activeTab === "my-courses" && (
          <>
            {myCourses.length === 0 ? (
              <div className="py-16 text-center" style={{ color: colors.textMuted }}>
                <Star className="mx-auto mb-4 h-12 w-12 opacity-40" />
                <p className="text-lg font-medium">No enrolled courses yet</p>
                <p className="mt-1 text-sm">Browse courses and enroll to get started.</p>
                <button onClick={() => setActiveTab("browse")} className="mt-4 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: colors.accent, color: "#000" }}>
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myCourses.map((course) => {
                  const enrollment = enrollments.find((e) => e.course_id === course.id);
                  return (
                    <article
                      key={course.id}
                      onClick={() => { window.location.href = `/academy/courses/${course.id}`; }}
                      style={{ borderRadius: 20, border: `1px solid ${colors.border}`, background: colors.cardBg, backdropFilter: "blur(20px)", padding: 20, boxShadow: colors.shadow, cursor: "pointer" }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>{course.category || "General"}</p>
                      <h2 className="mt-1 mb-2 text-lg font-semibold" style={{ color: colors.text }}>{course.title}</h2>
                      {enrollment && (
                        <div className="mb-3">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span style={{ color: colors.textSecondary }}>{enrollment.status === "completed" ? "Completed" : "Progress"}</span>
                            <span style={{ color: colors.accent }}>{enrollment.progress_percent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
                            <div className="h-full rounded-full" style={{ width: `${enrollment.progress_percent}%`, background: enrollment.status === "completed" ? "#22c55e" : colors.accent }} />
                          </div>
                        </div>
                      )}
                      <span className="text-xs" style={{ color: colors.textMuted }}>{enrollment?.last_accessed_at ? `Last accessed: ${new Date(enrollment.last_accessed_at).toLocaleDateString()}` : ""}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Create tab */}
        {activeTab === "create" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ borderRadius: 20, border: `1px solid ${colors.border}`, background: colors.cardBg, backdropFilter: "blur(20px)", padding: 28, boxShadow: colors.shadow }}>
              <h2 className="mb-6 text-xl font-bold" style={{ color: colors.text }}>Create New Course</h2>

              {formMessage && (
                <div className="mb-4 rounded-lg p-3 text-sm" style={{
                  background: formMessage.includes("success") ? "rgba(34,197,94,0.15)" : "rgba(255,100,100,0.15)",
                  color: formMessage.includes("success") ? "#22c55e" : "#ff6b6b",
                  border: `1px solid ${formMessage.includes("success") ? "rgba(34,197,94,0.3)" : "rgba(255,100,100,0.3)"}`,
                }}>
                  {formMessage}
                </div>
              )}

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Title *</label>
                  <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={inputStyle} placeholder="Course title" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Description</label>
                  <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" as const }} placeholder="Course description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Level</label>
                    <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as typeof draft.level })} style={inputStyle as React.CSSProperties}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Duration</label>
                    <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} style={inputStyle} placeholder="e.g. 6 weeks" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Category</label>
                    <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={inputStyle} placeholder="e.g. Technology" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Instructor</label>
                    <input value={draft.instructor_name} onChange={(e) => setDraft({ ...draft, instructor_name: e.target.value })} style={inputStyle} placeholder="Instructor name" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: colors.textSecondary }}>Tags (comma-separated)</label>
                  <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} style={inputStyle} placeholder="e.g. python, programming, ai" />
                </div>
                <button type="submit" className="w-full rounded-lg py-3 text-sm font-bold" style={{ background: colors.accent, color: "#000", border: "none", cursor: "pointer" }}>
                  Create Course
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
