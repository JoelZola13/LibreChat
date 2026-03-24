import { useMemo } from "react";
import { Briefcase, ChevronRight, Home, Laptop } from "lucide-react";

type LearningPath = {
  slug: string;
  title: string;
  description: string;
  courses: number;
  hours: number;
  color: string;
  icon: typeof Briefcase;
};

const learningPaths: LearningPath[] = [
  {
    slug: "job-ready",
    title: "Job Ready",
    description: "Complete path to employment readiness and interview confidence.",
    courses: 4,
    hours: 40,
    color: "#10B981",
    icon: Briefcase,
  },
  {
    slug: "digital-basics",
    title: "Digital Basics",
    description: "Essential computer and internet skills for everyday work and life.",
    courses: 4,
    hours: 24,
    color: "#3B82F6",
    icon: Laptop,
  },
  {
    slug: "housing-stability",
    title: "Housing Stability",
    description: "Practical learning track for housing search, support, and retention.",
    courses: 4,
    hours: 32,
    color: "#8B5CF6",
    icon: Home,
  },
];

export default function AcademyPathsPage() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        padding: "88px 24px 40px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <a href="/academy" className="text-sm font-medium hover:opacity-80" style={{ color: colors.textSecondary }}>
            Academy
          </a>
          <span style={{ color: colors.textMuted }}>/</span>
          <span className="text-sm font-medium" style={{ color: colors.accent }}>Learning Paths</span>
        </div>

        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.text }}>Learning Paths</h1>
            <p className="mt-2" style={{ color: colors.textSecondary }}>
              Structured tracks that organize courses into clear outcomes.
            </p>
          </div>
          <a href="/academy/courses" className="text-sm font-medium hover:opacity-80" style={{ color: colors.accent }}>
            Browse Courses
          </a>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {learningPaths.map((path) => (
            <article
              key={path.slug}
              style={{
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                background: colors.cardBg,
                backdropFilter: "blur(20px)",
                boxShadow: colors.shadow,
                padding: 22,
              }}
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${path.color}22` }}
              >
                <path.icon className="h-6 w-6" style={{ color: path.color }} />
              </div>

              <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
                {path.title}
              </h2>
              <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                {path.description}
              </p>

              <div className="mt-4 flex items-center gap-3 text-xs" style={{ color: colors.textMuted }}>
                <span>{path.courses} courses</span>
                <span>{path.hours}h total</span>
              </div>

              <a
                href={`/academy/paths/${path.slug}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium"
                style={{ color: path.color }}
              >
                Open Path
                <ChevronRight className="h-4 w-4" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
