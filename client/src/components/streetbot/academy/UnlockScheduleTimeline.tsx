import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Lock,
  Unlock,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getUnlockSchedule,
  getCourseDripSchedule,
  CourseDripSchedule,
  LessonAvailability,
  LockedLessonInfo,
  formatDaysUntil,
  formatAvailableDate,
} from "./api/drip-content";

interface UnlockScheduleTimelineProps {
  courseId: string;
  userId: string;
  onLessonClick?: (lessonId: string) => void;
}

export function UnlockScheduleTimeline({
  courseId,
  userId,
  onLessonClick,
}: UnlockScheduleTimelineProps) {
  const [schedule, setSchedule] = useState<CourseDripSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchedule() {
      try {
        setLoading(true);
        const data = await getCourseDripSchedule(courseId, userId);
        setSchedule(data);
      } catch (err) {
        setError("Failed to load schedule");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [courseId, userId]);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5" style={{ color: "#8B5CF6" }} />
          <h3
            className="font-semibold"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Lesson Schedule
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <AlertCircle
          className="w-8 h-8 mx-auto mb-2"
          style={{ color: "rgba(255, 255, 255, 0.3)" }}
        />
        <p style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          {error || "No schedule available"}
        </p>
      </div>
    );
  }

  // Group lessons by module
  const moduleGroups = schedule.lessons.reduce(
    (acc, lesson) => {
      if (!acc[lesson.module_id]) {
        acc[lesson.module_id] = {
          title: lesson.module_title,
          lessons: [],
        };
      }
      acc[lesson.module_id].lessons.push(lesson);
      return acc;
    },
    {} as Record<string, { title: string; lessons: LessonAvailability[] }>
  );

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5" style={{ color: "#8B5CF6" }} />
          <h3
            className="font-semibold"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Lesson Schedule
          </h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Unlock size={14} style={{ color: "#10B981" }} />
            <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              {schedule.available_lessons} available
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={14} style={{ color: "#F59E0B" }} />
            <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              {schedule.locked_lessons} locked
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(moduleGroups).map(([moduleId, module], moduleIndex) => (
          <motion.div
            key={moduleId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: moduleIndex * 0.1 }}
          >
            {/* Module Header */}
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={14} style={{ color: "rgba(255, 255, 255, 0.4)" }} />
              <span
                className="text-sm font-medium"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                {module.title}
              </span>
            </div>

            {/* Lessons */}
            <div className="relative pl-6 border-l border-white/10">
              {module.lessons.map((lesson, lessonIndex) => (
                <LessonTimelineItem
                  key={lesson.lesson_id}
                  lesson={lesson}
                  isLast={lessonIndex === module.lessons.length - 1}
                  onClick={() => onLessonClick?.(lesson.lesson_id)}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface LessonTimelineItemProps {
  lesson: LessonAvailability;
  isLast: boolean;
  onClick?: () => void;
}

function LessonTimelineItem({
  lesson,
  isLast,
  onClick,
}: LessonTimelineItemProps) {
  const available = lesson.is_available;

  let statusIcon = <Lock size={14} />;
  let statusColor = "#F59E0B";
  let bgColor = "rgba(245, 158, 11, 0.1)";

  if (available) {
    statusIcon = <Unlock size={14} />;
    statusColor = "#10B981";
    bgColor = "rgba(16, 185, 129, 0.1)";
  } else if (lesson.prerequisite_lesson_id) {
    statusIcon = <AlertCircle size={14} />;
    statusColor = "#8B5CF6";
    bgColor = "rgba(139, 92, 246, 0.1)";
  }

  const getStatusText = () => {
    if (available) return "Available now";
    if (lesson.days_until_available !== undefined) {
      return formatDaysUntil(lesson.days_until_available);
    }
    if (lesson.available_from) {
      return formatAvailableDate(lesson.available_from);
    }
    if (lesson.prerequisite_lesson_title) {
      return `After: ${lesson.prerequisite_lesson_title}`;
    }
    return lesson.reason || "Locked";
  };

  return (
    <motion.div
      className={`relative ${isLast ? "" : "pb-4"}`}
      whileHover={{ x: 4 }}
    >
      {/* Timeline dot */}
      <div
        className="absolute -left-[25px] w-3 h-3 rounded-full"
        style={{
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}40`,
        }}
      />

      {/* Lesson card */}
      <button
        onClick={onClick}
        disabled={!available}
        className={`w-full text-left p-3 rounded-xl transition-all ${
          available ? "cursor-pointer hover:scale-[1.01]" : "cursor-not-allowed opacity-70"
        }`}
        style={{
          background: bgColor,
          border: `1px solid ${statusColor}20`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4
              className="font-medium truncate mb-1"
              style={{ color: "rgba(255, 255, 255, 0.9)" }}
            >
              {lesson.lesson_title}
            </h4>
            <div className="flex items-center gap-2">
              <span style={{ color: statusColor }}>{statusIcon}</span>
              <span className="text-xs" style={{ color: statusColor }}>
                {getStatusText()}
              </span>
            </div>
          </div>
          {available && (
            <ChevronRight
              size={18}
              style={{ color: "rgba(255, 255, 255, 0.3)" }}
            />
          )}
        </div>
      </button>
    </motion.div>
  );
}

interface CompactUnlockListProps {
  courseId: string;
  userId: string;
  maxItems?: number;
}

export function CompactUnlockList({
  courseId,
  userId,
  maxItems = 3,
}: CompactUnlockListProps) {
  const [locked, setLocked] = useState<LockedLessonInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocked() {
      try {
        const data = await getUnlockSchedule(courseId, userId);
        setLocked(data.locked_lessons.slice(0, maxItems));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadLocked();
  }, [courseId, userId, maxItems]);

  if (loading || locked.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.15)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} style={{ color: "#F59E0B" }} />
        <span
          className="text-sm font-medium"
          style={{ color: "rgba(255, 255, 255, 0.8)" }}
        >
          Upcoming Lessons
        </span>
      </div>
      <div className="space-y-2">
        {locked.map((lesson) => (
          <div
            key={lesson.lesson_id}
            className="flex items-center justify-between text-sm"
          >
            <span
              className="truncate flex-1"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              {lesson.lesson_title}
            </span>
            <span
              className="text-xs ml-2 whitespace-nowrap"
              style={{ color: "#F59E0B" }}
            >
              {lesson.days_until_available !== undefined
                ? formatDaysUntil(lesson.days_until_available)
                : lesson.reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
