import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Award,
} from "lucide-react";
import {
  RubricWithCriteria,
  RubricCriterion,
  RubricLevel,
  CriterionGradeInput,
} from "./api/assignments";

// ============================================================================
// Types
// ============================================================================

interface CriterionGradeState {
  levelId?: string;
  pointsEarned: number;
  feedback: string;
}

interface RubricGradingPanelProps {
  rubric: RubricWithCriteria;
  initialGrades?: CriterionGradeInput[];
  onGradesChange?: (grades: CriterionGradeInput[], totalScore: number) => void;
  readonly?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const panelStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "24px",
};

const criterionStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  borderRadius: "12px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  marginBottom: "12px",
  overflow: "hidden",
};

const criterionHeaderStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px",
  cursor: "pointer",
  transition: "background 0.2s ease",
};

const levelButtonStyles = (
  isSelected: boolean,
  color: string
): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "12px 16px",
  borderRadius: "8px",
  border: isSelected
    ? `2px solid ${color}`
    : "1px solid rgba(255, 255, 255, 0.12)",
  background: isSelected ? `${color}20` : "rgba(255, 255, 255, 0.04)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  minWidth: "100px",
  textAlign: "center",
});

const feedbackInputStyles: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#fff",
  fontSize: "14px",
  resize: "vertical",
  minHeight: "60px",
  outline: "none",
};

// ============================================================================
// Helper Functions
// ============================================================================

function getLevelColor(level: RubricLevel, criterion: RubricCriterion): string {
  const percentage = level.pointValue / criterion.maxPoints;
  if (percentage >= 0.9) return "#10B981"; // Excellent - green
  if (percentage >= 0.7) return "#3B82F6"; // Good - blue
  if (percentage >= 0.5) return "#F59E0B"; // Fair - amber
  if (percentage >= 0.3) return "#F97316"; // Poor - orange
  return "#EF4444"; // Inadequate - red
}

function sortLevelsByPoints(levels: RubricLevel[]): RubricLevel[] {
  return [...levels].sort((a, b) => b.pointValue - a.pointValue);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface CriterionCardProps {
  criterion: RubricCriterion;
  gradeState: CriterionGradeState;
  onGradeChange: (grade: CriterionGradeState) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  readonly?: boolean;
}

function CriterionCard({
  criterion,
  gradeState,
  onGradeChange,
  isExpanded,
  onToggleExpand,
  readonly = false,
}: CriterionCardProps) {
  const sortedLevels = useMemo(
    () => sortLevelsByPoints(criterion.levels),
    [criterion.levels]
  );

  const selectedLevel = useMemo(
    () => criterion.levels.find((l) => l.id === gradeState.levelId),
    [criterion.levels, gradeState.levelId]
  );

  const handleLevelSelect = useCallback(
    (level: RubricLevel) => {
      if (readonly) return;
      onGradeChange({
        ...gradeState,
        levelId: level.id,
        pointsEarned: level.pointValue,
      });
    },
    [gradeState, onGradeChange, readonly]
  );

  const handleFeedbackChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readonly) return;
      onGradeChange({
        ...gradeState,
        feedback: e.target.value,
      });
    },
    [gradeState, onGradeChange, readonly]
  );

  const isGraded = gradeState.levelId !== undefined;
  const scoreColor = selectedLevel
    ? getLevelColor(selectedLevel, criterion)
    : "#6B7280";

  return (
    <div style={criterionStyles}>
      {/* Header */}
      <div
        style={{
          ...criterionHeaderStyles,
          background: isExpanded
            ? "rgba(255, 255, 255, 0.04)"
            : "transparent",
        }}
        onClick={onToggleExpand}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={20} color="#9CA3AF" />
          </motion.div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {criterion.criterionName}
            </h4>
            {criterion.description && (
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "13px",
                  color: "#9CA3AF",
                }}
              >
                {criterion.description}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isGraded ? (
            <CheckCircle2 size={18} color="#10B981" />
          ) : (
            <AlertCircle size={18} color="#6B7280" />
          )}
          <div
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              background: `${scoreColor}20`,
              border: `1px solid ${scoreColor}40`,
            }}
          >
            <span style={{ color: scoreColor, fontWeight: 600 }}>
              {gradeState.pointsEarned}/{criterion.maxPoints}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 16px 16px 16px" }}>
              {/* Level Selection */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "16px",
                }}
              >
                {sortedLevels.map((level) => {
                  const isSelected = gradeState.levelId === level.id;
                  const color = getLevelColor(level, criterion);

                  return (
                    <motion.button
                      key={level.id}
                      type="button"
                      style={levelButtonStyles(isSelected, color)}
                      onClick={() => handleLevelSelect(level)}
                      whileHover={readonly ? {} : { scale: 1.02 }}
                      whileTap={readonly ? {} : { scale: 0.98 }}
                      disabled={readonly}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: isSelected ? color : "#fff",
                          fontSize: "14px",
                        }}
                      >
                        {level.levelName}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: isSelected ? color : "#9CA3AF",
                          marginTop: "4px",
                        }}
                      >
                        {level.pointValue} pts
                      </span>
                      {level.description && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#6B7280",
                            marginTop: "4px",
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {level.description}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Criterion Feedback */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#9CA3AF",
                    marginBottom: "8px",
                  }}
                >
                  Feedback for this criterion (optional)
                </label>
                <textarea
                  style={feedbackInputStyles}
                  placeholder="Add specific feedback for this criterion..."
                  value={gradeState.feedback}
                  onChange={handleFeedbackChange}
                  disabled={readonly}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RubricGradingPanel({
  rubric,
  initialGrades = [],
  onGradesChange,
  readonly = false,
}: RubricGradingPanelProps) {
  // Initialize grade state from initial grades or empty
  const [gradeStates, setGradeStates] = useState<
    Record<string, CriterionGradeState>
  >(() => {
    const initial: Record<string, CriterionGradeState> = {};
    rubric.criteria.forEach((criterion) => {
      const existingGrade = initialGrades.find(
        (g) => g.criterionId === criterion.id
      );
      initial[criterion.id] = {
        levelId: existingGrade?.levelId,
        pointsEarned: existingGrade?.pointsEarned ?? 0,
        feedback: existingGrade?.feedback ?? "",
      };
    });
    return initial;
  });

  // Track expanded criteria
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(
    () => new Set(rubric.criteria.map((c) => c.id))
  );

  // Calculate total score
  const totalScore = useMemo(() => {
    return Object.values(gradeStates).reduce(
      (sum, state) => sum + state.pointsEarned,
      0
    );
  }, [gradeStates]);

  // Calculate grading progress
  const gradingProgress = useMemo(() => {
    const graded = Object.values(gradeStates).filter(
      (s) => s.levelId !== undefined
    ).length;
    return {
      graded,
      total: rubric.criteria.length,
      percentage: (graded / rubric.criteria.length) * 100,
    };
  }, [gradeStates, rubric.criteria.length]);

  // Handle grade change for a criterion
  const handleGradeChange = useCallback(
    (criterionId: string, grade: CriterionGradeState) => {
      setGradeStates((prev) => {
        const newStates = { ...prev, [criterionId]: grade };

        // Calculate new total and notify parent
        const newTotal = Object.values(newStates).reduce(
          (sum, state) => sum + state.pointsEarned,
          0
        );

        const grades: CriterionGradeInput[] = Object.entries(newStates).map(
          ([id, state]) => ({
            criterionId: id,
            levelId: state.levelId,
            pointsEarned: state.pointsEarned,
            feedback: state.feedback || undefined,
          })
        );

        onGradesChange?.(grades, newTotal);
        return newStates;
      });
    },
    [onGradesChange]
  );

  // Toggle criterion expansion
  const toggleExpand = useCallback((criterionId: string) => {
    setExpandedCriteria((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(criterionId)) {
        newSet.delete(criterionId);
      } else {
        newSet.add(criterionId);
      }
      return newSet;
    });
  }, []);

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    setExpandedCriteria(new Set(rubric.criteria.map((c) => c.id)));
  }, [rubric.criteria]);

  const collapseAll = useCallback(() => {
    setExpandedCriteria(new Set());
  }, []);

  const scorePercentage =
    rubric.totalPoints > 0 ? (totalScore / rubric.totalPoints) * 100 : 0;
  const scoreColor =
    scorePercentage >= 90
      ? "#10B981"
      : scorePercentage >= 70
        ? "#3B82F6"
        : scorePercentage >= 50
          ? "#F59E0B"
          : "#EF4444";

  return (
    <div style={panelStyles}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "10px",
              background: "rgba(139, 92, 246, 0.2)",
            }}
          >
            <FileText size={22} color="#8B5CF6" />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {rubric.title}
            </h3>
            {rubric.description && (
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "13px",
                  color: "#9CA3AF",
                }}
              >
                {rubric.description}
              </p>
            )}
          </div>
        </div>

        {/* Total Score */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Award size={20} color={scoreColor} />
            <span
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: scoreColor,
              }}
            >
              {totalScore}
            </span>
            <span style={{ fontSize: "16px", color: "#6B7280" }}>
              / {rubric.totalPoints}
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
            {scorePercentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>
            Grading Progress
          </span>
          <span style={{ fontSize: "13px", color: "#9CA3AF" }}>
            {gradingProgress.graded} / {gradingProgress.total} criteria
          </span>
        </div>
        <div
          style={{
            height: "6px",
            borderRadius: "3px",
            background: "rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${gradingProgress.percentage}%` }}
            transition={{ duration: 0.3 }}
            style={{
              height: "100%",
              borderRadius: "3px",
              background:
                gradingProgress.percentage === 100 ? "#10B981" : "#8B5CF6",
            }}
          />
        </div>
      </div>

      {/* Expand/Collapse Controls */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={expandAll}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(255, 255, 255, 0.04)",
            color: "#9CA3AF",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ChevronDown size={14} />
          Expand All
        </button>
        <button
          type="button"
          onClick={collapseAll}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(255, 255, 255, 0.04)",
            color: "#9CA3AF",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ChevronRight size={14} />
          Collapse All
        </button>
      </div>

      {/* Criteria List */}
      <div>
        {rubric.criteria
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((criterion) => (
            <CriterionCard
              key={criterion.id}
              criterion={criterion}
              gradeState={gradeStates[criterion.id]}
              onGradeChange={(grade) => handleGradeChange(criterion.id, grade)}
              isExpanded={expandedCriteria.has(criterion.id)}
              onToggleExpand={() => toggleExpand(criterion.id)}
              readonly={readonly}
            />
          ))}
      </div>

      {/* Completion Status */}
      {gradingProgress.percentage === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={20} color="#10B981" />
          <span style={{ color: "#10B981", fontSize: "14px" }}>
            All criteria have been graded. Total score: {totalScore}/
            {rubric.totalPoints} ({scorePercentage.toFixed(0)}%)
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default RubricGradingPanel;
