import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Loader2,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import {
  getCourseGrades,
  type MoodleGradeItem,
} from "./api/moodle";

interface GradesPanelProps {
  userId: string;
  courseId: string;
  courseName?: string;
  colors: Record<string, string>;
}

function gradeColor(pct: number): string {
  if (pct >= 90) return "#22c55e";
  if (pct >= 75) return "#3B82F6";
  if (pct >= 60) return "#F59E0B";
  if (pct >= 50) return "#F97316";
  return "#EF4444";
}

function gradeLetter(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export function GradesPanel({
  userId,
  courseId,
  courseName,
  colors,
}: GradesPanelProps) {
  const [grades, setGrades] = useState<MoodleGradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getCourseGrades(userId, courseId);
        setGrades(data);
      } catch (err) {
        console.error("Failed to load grades:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, courseId]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Compute summary stats
  const stats = useMemo(() => {
    const graded = grades.filter(
      (g) =>
        g.graderaw !== null &&
        g.graderaw !== undefined &&
        g.itemtype !== "course",
    );
    const total = graded.length;
    if (total === 0) return { average: 0, highest: 0, lowest: 0, graded: 0, total: grades.filter(g => g.itemtype !== "course").length };

    const percents = graded.map((g) => {
      const max = g.grademax || 100;
      return max > 0 ? ((g.graderaw || 0) / max) * 100 : 0;
    });

    return {
      average: percents.reduce((a, b) => a + b, 0) / percents.length,
      highest: Math.max(...percents),
      lowest: Math.min(...percents),
      graded: total,
      total: grades.filter(g => g.itemtype !== "course").length,
    };
  }, [grades]);

  // Separate course total from individual items
  const courseTotal = grades.find((g) => g.itemtype === "course");
  const gradeItems = grades.filter((g) => g.itemtype !== "course");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: colors.accent }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h3
        className="text-xl font-semibold flex items-center gap-2"
        style={{ color: colors.text }}
      >
        <BarChart3 className="w-5 h-5" style={{ color: "#10B981" }} />
        Grades {courseName ? `- ${courseName}` : ""}
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Overall Average */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl text-center"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="text-3xl font-bold mb-1"
            style={{ color: gradeColor(stats.average) }}
          >
            {stats.average > 0 ? `${stats.average.toFixed(0)}%` : "--"}
          </div>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Average
          </p>
        </motion.div>

        {/* Highest */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl text-center"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="text-3xl font-bold mb-1" style={{ color: "#22c55e" }}>
            {stats.highest > 0 ? `${stats.highest.toFixed(0)}%` : "--"}
          </div>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Highest
          </p>
        </motion.div>

        {/* Graded Count */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl text-center"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="text-3xl font-bold mb-1" style={{ color: "#3B82F6" }}>
            {stats.graded}/{stats.total}
          </div>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Graded
          </p>
        </motion.div>

        {/* Letter Grade */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl text-center"
          style={{
            background: colors.cardBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="text-3xl font-bold mb-1"
            style={{ color: gradeColor(stats.average) }}
          >
            {stats.average > 0 ? gradeLetter(stats.average) : "--"}
          </div>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Letter Grade
          </p>
        </motion.div>
      </div>

      {/* Course Total (if present) */}
      {courseTotal && courseTotal.graderaw !== null && courseTotal.graderaw !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${colors.cardBg}, rgba(34, 197, 94, 0.08))`,
            backdropFilter: "blur(24px)",
            border: `1px solid rgba(34, 197, 94, 0.3)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(34, 197, 94, 0.15)" }}
              >
                <GraduationCap className="w-6 h-6" style={{ color: "#22c55e" }} />
              </div>
              <div>
                <h4 className="font-semibold" style={{ color: colors.text }}>
                  Course Total
                </h4>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {courseTotal.gradeformatted || `${courseTotal.graderaw?.toFixed(1)} / ${courseTotal.grademax || 100}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-2xl font-bold"
                style={{
                  color: gradeColor(
                    ((courseTotal.graderaw || 0) / (courseTotal.grademax || 100)) * 100,
                  ),
                }}
              >
                {courseTotal.percentageformatted ||
                  `${(((courseTotal.graderaw || 0) / (courseTotal.grademax || 100)) * 100).toFixed(0)}%`}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Individual Grade Items */}
      {gradeItems.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            style={{ color: colors.textMuted }}
          />
          <p className="text-lg font-medium" style={{ color: colors.text }}>
            No grades yet
          </p>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            Grades will appear here as activities are completed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gradeItems.map((item, index) => {
            const hasGrade =
              item.graderaw !== null && item.graderaw !== undefined;
            const max = item.grademax || 100;
            const pct = hasGrade && max > 0 ? ((item.graderaw || 0) / max) * 100 : 0;
            const isExpanded = expanded.has(item.id);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl overflow-hidden"
                style={{
                  background: colors.cardBg,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(item.id)}
                >
                  {/* Module icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: hasGrade
                        ? `${gradeColor(pct)}20`
                        : "rgba(156, 163, 175, 0.1)",
                    }}
                  >
                    {item.itemmodule === "quiz" ? (
                      <BookOpen
                        className="w-5 h-5"
                        style={{
                          color: hasGrade ? gradeColor(pct) : colors.textMuted,
                        }}
                      />
                    ) : (
                      <Award
                        className="w-5 h-5"
                        style={{
                          color: hasGrade ? gradeColor(pct) : colors.textMuted,
                        }}
                      />
                    )}
                  </div>

                  {/* Name + progress */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {item.itemname || "Unnamed Item"}
                    </h4>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mt-2">
                      <div
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: "rgba(255, 255, 255, 0.1)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: hasGrade ? gradeColor(pct) : colors.textMuted }}
                          initial={{ width: 0 }}
                          animate={{ width: hasGrade ? `${pct}%` : "0%" }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                      <span
                        className="text-sm font-semibold w-12 text-right"
                        style={{ color: hasGrade ? gradeColor(pct) : colors.textMuted }}
                      >
                        {hasGrade ? `${pct.toFixed(0)}%` : "--"}
                      </span>
                    </div>
                  </div>

                  {/* Score + Expand */}
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.textSecondary }}
                      >
                        {hasGrade
                          ? `${(item.graderaw || 0).toFixed(1)} / ${max}`
                          : "Not graded"}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" style={{ color: colors.textMuted }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: colors.textMuted }} />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 pt-0"
                  >
                    <div
                      className="h-px mb-3"
                      style={{ background: colors.border }}
                    />
                    <div
                      className="grid grid-cols-2 gap-4 text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      <div>
                        <span className="font-medium">Type: </span>
                        {item.itemmodule || item.itemtype || "Activity"}
                      </div>
                      <div>
                        <span className="font-medium">Range: </span>
                        {item.grademin || 0} - {max}
                      </div>
                      {item.percentageformatted && (
                        <div>
                          <span className="font-medium">Percentage: </span>
                          {item.percentageformatted}
                        </div>
                      )}
                      {item.feedback && (
                        <div className="col-span-2">
                          <span className="font-medium">Feedback: </span>
                          <span
                            dangerouslySetInnerHTML={{
                              __html: item.feedback,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GradesPanel;
