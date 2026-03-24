import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Link2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Settings2,
  Zap,
  RefreshCw,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import {
  getCourseDripSchedule,
  applyBulkDripSchedule,
  updateLessonDripSettings,
  clearLessonDripSettings,
  CourseDripSchedule,
  LessonAvailability,
  DripMode,
  BulkDripRequest,
  LessonDripSettings,
} from "./api/drip-content";

interface DripScheduleEditorProps {
  courseId: string;
  onSave?: () => void;
}

type EditorMode = "bulk" | "individual";

export function DripScheduleEditor({
  courseId,
  onSave,
}: DripScheduleEditorProps) {
  const [schedule, setSchedule] = useState<CourseDripSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("bulk");

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState<DripMode>("weekly");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [intervalDays, setIntervalDays] = useState(7);
  const [requirePrevious, setRequirePrevious] = useState(false);

  // Individual mode state
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

  // Use a system user ID for admin preview
  const previewUserId = "system-admin";

  useEffect(() => {
    loadSchedule();
  }, [courseId]);

  async function loadSchedule() {
    try {
      setLoading(true);
      const data = await getCourseDripSchedule(courseId, previewUserId);
      setSchedule(data);
    } catch (err) {
      setError("Failed to load course schedule");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyBulk() {
    try {
      setSaving(true);
      setError(null);

      const request: BulkDripRequest = {
        mode: bulkMode,
        interval_days: intervalDays,
        require_previous_completion: requirePrevious,
      };

      if (bulkMode === "weekly" || bulkMode === "daily") {
        request.start_date = new Date(startDate).toISOString();
      }

      const result = await applyBulkDripSchedule(courseId, request);

      setSuccessMessage(
        `Updated ${result.updated_lessons} of ${result.total_lessons} lessons`
      );
      setTimeout(() => setSuccessMessage(null), 3000);

      await loadSchedule();
      onSave?.();
    } catch (err) {
      setError("Failed to apply drip schedule");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAll() {
    if (!confirm("Are you sure you want to clear all drip settings?")) return;

    try {
      setSaving(true);
      await applyBulkDripSchedule(courseId, { mode: "clear" });
      setSuccessMessage("Cleared all drip settings");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadSchedule();
      onSave?.();
    } catch (err) {
      setError("Failed to clear drip settings");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateLesson(
    lessonId: string,
    settings: LessonDripSettings
  ) {
    try {
      setSaving(true);
      await updateLessonDripSettings(lessonId, settings);
      await loadSchedule();
      setExpandedLesson(null);
    } catch (err) {
      setError("Failed to update lesson");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearLesson(lessonId: string) {
    try {
      setSaving(true);
      await clearLessonDripSettings(lessonId);
      await loadSchedule();
    } catch (err) {
      setError("Failed to clear lesson settings");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl p-8"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <RefreshCw
            className="w-5 h-5 animate-spin"
            style={{ color: "#8B5CF6" }}
          />
          <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
            Loading schedule...
          </span>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <AlertTriangle
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: "rgba(255, 255, 255, 0.3)" }}
        />
        <p style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          {error || "No lessons found in this course"}
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
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5" style={{ color: "#8B5CF6" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "rgba(255, 255, 255, 0.95)" }}
            >
              Drip Content Schedule
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {schedule.total_lessons} lessons
            </span>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("bulk")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "bulk" ? "bg-purple-500/20 text-purple-400" : ""
            }`}
            style={
              mode !== "bulk"
                ? {
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(255, 255, 255, 0.6)",
                  }
                : {}
            }
          >
            <Zap className="w-4 h-4 inline-block mr-2" />
            Quick Setup
          </button>
          <button
            onClick={() => setMode("individual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "individual" ? "bg-purple-500/20 text-purple-400" : ""
            }`}
            style={
              mode !== "individual"
                ? {
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(255, 255, 255, 0.6)",
                  }
                : {}
            }
          >
            <Settings2 className="w-4 h-4 inline-block mr-2" />
            Individual Lessons
          </button>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg flex items-center gap-2"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
              }}
            >
              <AlertTriangle size={16} />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} />
              </button>
            </motion.div>
          )}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-lg flex items-center gap-2"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10B981",
              }}
            >
              <Check size={16} />
              <span className="text-sm">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Mode */}
        {mode === "bulk" && (
          <div className="space-y-4">
            {/* Schedule Type */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "rgba(255, 255, 255, 0.7)" }}
              >
                Schedule Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: "weekly", label: "Weekly", icon: Calendar },
                  { value: "daily", label: "Daily", icon: Clock },
                  { value: "sequential", label: "Sequential", icon: Link2 },
                  { value: "clear", label: "Clear All", icon: Trash2 },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setBulkMode(option.value as DripMode)}
                    className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                      bulkMode === option.value
                        ? "ring-2 ring-purple-500"
                        : ""
                    }`}
                    style={{
                      background:
                        bulkMode === option.value
                          ? "rgba(139, 92, 246, 0.15)"
                          : "rgba(255, 255, 255, 0.05)",
                      color:
                        bulkMode === option.value
                          ? "#8B5CF6"
                          : "rgba(255, 255, 255, 0.6)",
                    }}
                  >
                    <option.icon size={20} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time-based options */}
            {(bulkMode === "weekly" || bulkMode === "daily") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    Days Between Lessons
                  </label>
                  <input
                    type="number"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
                    min={1}
                    max={30}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Additional options */}
            {bulkMode !== "clear" && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePrevious}
                  onChange={(e) => setRequirePrevious(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                  Also require completion of previous lesson
                </span>
              </label>
            )}

            {/* Preview */}
            {bulkMode !== "clear" && (
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(139, 92, 246, 0.08)",
                  border: "1px solid rgba(139, 92, 246, 0.15)",
                }}
              >
                <h4
                  className="text-sm font-medium mb-2"
                  style={{ color: "#8B5CF6" }}
                >
                  Preview
                </h4>
                <p
                  className="text-sm"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  {bulkMode === "weekly" &&
                    `Lessons will be released every ${intervalDays} days starting ${new Date(startDate).toLocaleDateString()}`}
                  {bulkMode === "daily" &&
                    `Lessons will be released ${intervalDays === 1 ? "daily" : `every ${intervalDays} days`} starting ${new Date(startDate).toLocaleDateString()}`}
                  {bulkMode === "sequential" &&
                    "Each lesson will unlock after completing the previous one"}
                  {requirePrevious &&
                    bulkMode !== "sequential" &&
                    " + previous lesson must be completed"}
                </p>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={bulkMode === "clear" ? handleClearAll : handleApplyBulk}
              disabled={saving}
              className="w-full py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
              style={{
                background:
                  bulkMode === "clear"
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(139, 92, 246, 0.2)",
                color: bulkMode === "clear" ? "#EF4444" : "#8B5CF6",
                border: `1px solid ${bulkMode === "clear" ? "rgba(239, 68, 68, 0.3)" : "rgba(139, 92, 246, 0.3)"}`,
              }}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
              ) : null}
              {bulkMode === "clear" ? "Clear All Drip Settings" : "Apply Schedule"}
            </button>
          </div>
        )}

        {/* Individual Mode */}
        {mode === "individual" && (
          <div className="space-y-4">
            {Object.entries(moduleGroups).map(([moduleId, module]) => (
              <div key={moduleId}>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen
                    size={14}
                    style={{ color: "rgba(255, 255, 255, 0.4)" }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {module.title}
                  </span>
                </div>
                <div className="space-y-2 pl-4">
                  {module.lessons.map((lesson) => (
                    <LessonDripEditor
                      key={lesson.lesson_id}
                      lesson={lesson}
                      allLessons={schedule.lessons}
                      isExpanded={expandedLesson === lesson.lesson_id}
                      onToggle={() =>
                        setExpandedLesson(
                          expandedLesson === lesson.lesson_id
                            ? null
                            : lesson.lesson_id
                        )
                      }
                      onSave={(settings) =>
                        handleUpdateLesson(lesson.lesson_id, settings)
                      }
                      onClear={() => handleClearLesson(lesson.lesson_id)}
                      saving={saving}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LessonDripEditorProps {
  lesson: LessonAvailability;
  allLessons: LessonAvailability[];
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (settings: LessonDripSettings) => void;
  onClear: () => void;
  saving: boolean;
}

function LessonDripEditor({
  lesson,
  allLessons,
  isExpanded,
  onToggle,
  onSave,
  onClear,
  saving,
}: LessonDripEditorProps) {
  const [availableFrom, setAvailableFrom] = useState<string>("");
  const [availableUntil, setAvailableUntil] = useState<string>("");
  const [unlockAfterLesson, setUnlockAfterLesson] = useState<string>("");
  const [unlockAfterDays, setUnlockAfterDays] = useState<string>("");

  // Initialize values when expanding
  useEffect(() => {
    if (isExpanded) {
      setAvailableFrom(
        lesson.available_from
          ? new Date(lesson.available_from).toISOString().slice(0, 16)
          : ""
      );
      setAvailableUntil(
        lesson.available_until
          ? new Date(lesson.available_until).toISOString().slice(0, 16)
          : ""
      );
      setUnlockAfterLesson(lesson.prerequisite_lesson_id || "");
      setUnlockAfterDays("");
    }
  }, [isExpanded, lesson]);

  const hasDripSettings =
    lesson.available_from ||
    lesson.available_until ||
    lesson.prerequisite_lesson_id;

  const otherLessons = allLessons.filter((l) => l.lesson_id !== lesson.lesson_id);

  function handleSave() {
    const settings: LessonDripSettings = {};
    if (availableFrom) settings.available_from = new Date(availableFrom).toISOString();
    if (availableUntil) settings.available_until = new Date(availableUntil).toISOString();
    if (unlockAfterLesson) settings.unlock_after_lesson_id = unlockAfterLesson;
    if (unlockAfterDays) settings.unlock_after_days = parseInt(unlockAfterDays);
    onSave(settings);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${hasDripSettings ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.08)"}`,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={16} style={{ color: "rgba(255, 255, 255, 0.4)" }} />
          ) : (
            <ChevronRight size={16} style={{ color: "rgba(255, 255, 255, 0.4)" }} />
          )}
          <span style={{ color: "rgba(255, 255, 255, 0.9)" }}>
            {lesson.lesson_title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasDripSettings && (
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "#F59E0B",
              }}
            >
              Scheduled
            </span>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t"
            style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
          >
            <div className="p-4 space-y-4">
              {/* Available From */}
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  Available From
                </label>
                <input
                  type="datetime-local"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                />
              </div>

              {/* Available Until */}
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  Available Until (optional)
                </label>
                <input
                  type="datetime-local"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                />
              </div>

              {/* Prerequisite Lesson */}
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  Unlock After Completing
                </label>
                <select
                  value={unlockAfterLesson}
                  onChange={(e) => setUnlockAfterLesson(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                >
                  <option value="">No prerequisite</option>
                  {otherLessons.map((l) => (
                    <option key={l.lesson_id} value={l.lesson_id}>
                      {l.module_title} - {l.lesson_title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Days After Enrollment */}
              <div>
                <label
                  className="block text-sm mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  Days After Enrollment
                </label>
                <input
                  type="number"
                  value={unlockAfterDays}
                  onChange={(e) => setUnlockAfterDays(e.target.value)}
                  placeholder="e.g., 7"
                  min={0}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: "rgba(139, 92, 246, 0.2)",
                    color: "#8B5CF6",
                  }}
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin inline-block" />
                  ) : (
                    "Save"
                  )}
                </button>
                {hasDripSettings && (
                  <button
                    onClick={onClear}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#EF4444",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
