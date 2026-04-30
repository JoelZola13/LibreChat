import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  ChevronDown,
  Clock,
  CheckCircle,
  Calendar,
  BarChart3,
} from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";
import { AssignmentDetail } from "./AssignmentDetail";
import {
  Assignment,
  Submission,
  getCourseAssignments,
  getMySubmission,
  isPastDue,
} from "./api/assignments";

interface AssignmentListProps {
  courseId: string;
  userId: string;
  showInstructorView?: boolean;
  contentType?: "all" | "assignment" | "quiz";
}

type FilterStatus = "all" | "pending" | "submitted" | "graded" | "late";

type AssignmentStats = {
  totalAssignments: number;
  submitted: number;
  graded: number;
  averageScore: number;
  onTime: number;
  late: number;
};

function buildLocalAssignmentStats(
  assignments: Assignment[],
  submissions: Record<string, Submission | null>,
): AssignmentStats {
  const allowedAssignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const realSubmissions = Object.entries(submissions)
    .filter((entry): entry is [string, Submission] => {
      const [assignmentId, submission] = entry;
      return allowedAssignmentIds.has(assignmentId) && submission !== null;
    })
    .map(([, submission]) => submission);
  const gradedSubmissions = realSubmissions.filter(
    (submission) => submission.status === "graded" || submission.status === "returned",
  );
  const totalScore = gradedSubmissions.reduce(
    (sum, submission) => sum + (submission.adjustedScore ?? submission.score ?? 0),
    0,
  );

  return {
    totalAssignments: assignments.length,
    submitted: realSubmissions.filter((submission) => submission.status !== "draft").length,
    graded: gradedSubmissions.length,
    averageScore: gradedSubmissions.length > 0 ? totalScore / gradedSubmissions.length : 0,
    onTime: realSubmissions.filter((submission) => !submission.isLate && submission.status !== "draft").length,
    late: realSubmissions.filter((submission) => submission.isLate).length,
  };
}

export function AssignmentList({
  courseId,
  userId,
  showInstructorView = false,
  contentType = "all",
}: AssignmentListProps) {
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load assignments and submissions
  useEffect(() => {
    setSelectedAssignment(null);
    setSearchQuery("");
    setFilterStatus("all");
    setAllAssignments([]);
    setSubmissions({});

    async function loadData() {
      setIsLoading(true);
      try {
        // Load assignments
        const assignmentData = await getCourseAssignments(courseId, showInstructorView);
        setAllAssignments(assignmentData);

        // Load user's submissions for each assignment
        const submissionPromises = assignmentData.map(async (a) => {
          const sub = await getMySubmission(a.id, userId);
          return [a.id, sub] as [string, Submission | null];
        });
        const submissionResults = await Promise.all(submissionPromises);
        const submissionMap = Object.fromEntries(submissionResults);
        setSubmissions(submissionMap);
      } catch (err) {
        console.error("Failed to load assignments:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [courseId, userId, showInstructorView]);

  const assignments = useMemo(() => {
    if (contentType === "quiz") {
      return allAssignments.filter((assignment) => assignment.assignmentType === "quiz");
    }
    if (contentType === "assignment") {
      return allAssignments.filter((assignment) => assignment.assignmentType !== "quiz");
    }
    return allAssignments;
  }, [allAssignments, contentType]);

  const stats = useMemo(
    () => buildLocalAssignmentStats(assignments, submissions),
    [assignments, submissions],
  );

  const contentLabelPlural =
    contentType === "quiz" ? "Quizzes" : contentType === "assignment" ? "Assignments" : "Assignments";
  const emptyLabel =
    contentType === "quiz" ? "quizzes" : contentType === "assignment" ? "assignments" : "assignments";

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !assignment.title.toLowerCase().includes(query) &&
        !assignment.description?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== "all") {
      const submission = submissions[assignment.id];
      const pastDue = isPastDue(assignment.dueDate);

      switch (filterStatus) {
        case "pending":
          return !submission || submission.status === "draft";
        case "submitted":
          return submission?.status === "submitted" || submission?.status === "grading";
        case "graded":
          return submission?.status === "graded" || submission?.status === "returned";
        case "late":
          return pastDue && (!submission || submission.status === "draft");
        default:
          return true;
      }
    }

    return true;
  });

  // Sort: upcoming due dates first, then past due, then graded
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    const subA = submissions[a.id];
    const subB = submissions[b.id];

    // Graded assignments last
    const aGraded = subA?.status === "graded" || subA?.status === "returned";
    const bGraded = subB?.status === "graded" || subB?.status === "returned";
    if (aGraded && !bGraded) return 1;
    if (!aGraded && bGraded) return -1;

    // Sort by due date
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return 0;
  });

  // Handle assignment selection
  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
  };

  const handleBack = () => {
    setSelectedAssignment(null);
    // Reload submissions after returning from detail view
    async function reloadSubmission() {
      if (selectedAssignment) {
        const sub = await getMySubmission(selectedAssignment.id, userId);
        setSubmissions((prev) => ({ ...prev, [selectedAssignment.id]: sub }));
      }
    }
    reloadSubmission();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-32 rounded-xl"
            style={{ background: "rgba(255, 255, 255, 0.05)" }}
          />
        ))}
      </div>
    );
  }

  // Show detail view
  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        userId={userId}
        onBack={handleBack}
        onSubmissionComplete={handleBack}
      />
    );
  }

  return (
    <div className="space-y-6">

{/* Stats Cards */}
<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl p-3"
    style={{
      background: "rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    }}
  >
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-lg p-1.5"
        style={{ background: "rgba(59, 130, 246, 0.2)" }}
      >
        <FileText className="h-4 w-4" style={{ color: "#3B82F6" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none" style={{ color: "rgba(255, 255, 255, 0.95)" }}>
          {stats.totalAssignments}
        </p>
        <p className="mt-1 text-[11px] leading-tight" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Total
        </p>
      </div>
    </div>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    className="rounded-xl p-3"
    style={{
      background: "rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    }}
  >
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-lg p-1.5"
        style={{ background: "rgba(16, 185, 129, 0.2)" }}
      >
        <CheckCircle className="h-4 w-4" style={{ color: "#10B981" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none" style={{ color: "rgba(255, 255, 255, 0.95)" }}>
          {stats.graded}
        </p>
        <p className="mt-1 text-[11px] leading-tight" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Graded
        </p>
      </div>
    </div>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.2 }}
    className="rounded-xl p-3"
    style={{
      background: "rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    }}
  >
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-lg p-1.5"
        style={{ background: "rgba(139, 92, 246, 0.2)" }}
      >
        <BarChart3 className="h-4 w-4" style={{ color: "#8B5CF6" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none" style={{ color: "rgba(255, 255, 255, 0.95)" }}>
          {stats.averageScore.toFixed(0)}%
        </p>
        <p className="mt-1 text-[11px] leading-tight" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Average
        </p>
      </div>
    </div>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
    className="rounded-xl p-3"
    style={{
      background: "rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    }}
  >
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-lg p-1.5"
        style={{ background: "rgba(245, 158, 11, 0.2)" }}
      >
        <Clock className="h-4 w-4" style={{ color: "#F59E0B" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none" style={{ color: "rgba(255, 255, 255, 0.95)" }}>
          {stats.totalAssignments - stats.submitted}
        </p>
        <p className="mt-1 text-[11px] leading-tight" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Pending
        </p>
      </div>
    </div>
  </motion.div>
</div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col md:flex-row gap-4"
      >
        {/* Search */}
        <div
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <Search className="w-5 h-5" style={{ color: "rgba(255, 255, 255, 0.4)" }} />
          <input
            type="text"
            placeholder={`Search ${emptyLabel}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          />
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none px-4 py-3 pr-10 rounded-xl cursor-pointer"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            <option value="all">All {contentLabelPlural}</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="late">Overdue</option>
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          />
        </div>
      </motion.div>

      {/* Assignment List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {sortedAssignments.length > 0 ? (
            sortedAssignments.map((assignment, index) => (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <AssignmentCard
                  assignment={assignment}
                  submission={submissions[assignment.id]}
                  onClick={() => handleSelectAssignment(assignment)}
                  showStats={showInstructorView}
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <FileText
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: "rgba(255, 255, 255, 0.2)" }}
              />
              <h3
                className="text-lg font-medium mb-2"
                style={{ color: "rgba(255, 255, 255, 0.7)" }}
              >
                {searchQuery || filterStatus !== "all"
                  ? `No ${emptyLabel} match your filters`
                  : `No ${emptyLabel} yet`}
              </h3>
              <p style={{ color: "rgba(255, 255, 255, 0.4)" }}>
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filter"
                  : `Check back later for new ${emptyLabel}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upcoming Due Dates Summary */}
      {!searchQuery && filterStatus === "all" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-xl"
          style={{
            background: "rgba(139, 92, 246, 0.1)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <h3
            className="font-medium mb-3 flex items-center gap-2"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            <Calendar className="w-5 h-5" style={{ color: "#8B5CF6" }} />
            Upcoming Due Dates
          </h3>
          <div className="space-y-2">
            {sortedAssignments
              .filter((a) => a.dueDate && !isPastDue(a.dueDate))
              .slice(0, 3)
              .map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                    {assignment.title}
                  </span>
                  <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                    {new Date(assignment.dueDate!).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            {sortedAssignments.filter((a) => a.dueDate && !isPastDue(a.dueDate)).length === 0 && (
              <p style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                No upcoming deadlines
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
