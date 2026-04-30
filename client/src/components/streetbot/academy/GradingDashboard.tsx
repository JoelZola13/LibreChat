import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  SortAsc,
  ChevronDown,
  ArrowRight,
  User,
  Calendar,
  BookOpen,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  GradingQueueItem,
  getGradingQueue,
  startGrading,
  formatSubmittedTime,
} from "./api/assignments";

// ============================================================================
// Types
// ============================================================================

type FilterStatus = "all" | "submitted" | "grading" | "regrade_requested";
type SortField = "submittedAt" | "studentName" | "assignmentTitle" | "dueDate";
type SortDirection = "asc" | "desc";

interface GradingDashboardProps {
  instructorId: string;
  courseId?: string;
  onSelectSubmission: (item: GradingQueueItem) => void;
}

interface StatsData {
  totalPending: number;
  gradedToday: number;
  lateSubmissions: number;
  regradeRequests: number;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  padding: "0",
};

const headerStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "24px",
  marginBottom: "20px",
};

const statsCardStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "16px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const filterBarStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const filterButtonStyles = (isActive: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  borderRadius: "8px",
  border: isActive ? "1px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.12)",
  background: isActive ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.04)",
  color: isActive ? "#8B5CF6" : "#9CA3AF",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s ease",
});

const queueItemStyles: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "12px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "20px",
  marginBottom: "12px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const searchInputStyles: React.CSSProperties = {
  flex: 1,
  maxWidth: "300px",
  padding: "8px 12px 8px 36px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
};

// ============================================================================
// Sub-Components
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div style={statsCardStyles}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{label}</span>
      </div>
      <span style={{ fontSize: "28px", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

interface QueueItemCardProps {
  item: GradingQueueItem;
  onSelect: () => void;
  onStartGrading: () => void;
  isStarting: boolean;
}

function QueueItemCard({ item, onSelect, onStartGrading, isStarting }: QueueItemCardProps) {
  const statusColors: Record<string, string> = {
    submitted: "#3B82F6",
    grading: "#F59E0B",
    regrade_requested: "#EF4444",
  };

  const statusLabels: Record<string, string> = {
    submitted: "Submitted",
    grading: "In Progress",
    regrade_requested: "Regrade Requested",
  };

  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartGrading();
  };

  return (
    <motion.div
      style={queueItemStyles}
      onClick={onSelect}
      whileHover={{
        borderColor: "rgba(139, 92, 246, 0.5)",
        background: "rgba(255, 255, 255, 0.1)",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(139, 92, 246, 0.2)",
              }}
            >
              <User size={18} color="#8B5CF6" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                {item.userName}
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                {item.userEmail}
              </p>
            </div>
          </div>

          {/* Assignment Info */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <BookOpen size={14} color="#6B7280" />
              <span style={{ fontSize: "13px", color: "#E5E7EB" }}>
                {item.assignmentTitle}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={14} color="#6B7280" />
              <span style={{ fontSize: "13px", color: "#9CA3AF" }}>
                {formatSubmittedTime(item.submittedAt)}
              </span>
            </div>
            {item.isLate && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={14} color="#F59E0B" />
                <span style={{ fontSize: "13px", color: "#F59E0B" }}>
                  {item.daysLate} day{item.daysLate !== 1 ? "s" : ""} late
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
          {/* Status Badge */}
          <div
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: `${statusColors[item.status]}20`,
              border: `1px solid ${statusColors[item.status]}40`,
            }}
          >
            <span style={{ fontSize: "12px", color: statusColors[item.status], fontWeight: 500 }}>
              {statusLabels[item.status]}
            </span>
          </div>

          {/* Action Button */}
          <motion.button
            type="button"
            onClick={handleStartClick}
            disabled={isStarting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isStarting ? "wait" : "pointer",
              opacity: isStarting ? 0.7 : 1,
            }}
            whileHover={isStarting ? {} : { scale: 1.02 }}
            whileTap={isStarting ? {} : { scale: 0.98 }}
          >
            {isStarting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                Start Grading <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GradingDashboard({
  instructorId,
  courseId,
  onSelectSubmission,
}: GradingDashboardProps) {
  // Data state
  const [queue, setQueue] = useState<GradingQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Filter/Sort state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Load queue
  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGradingQueue(instructorId, courseId);
      setQueue(data);
    } catch (error) {
      console.error('[GradingDashboard] Failed to load grading queue:', error);
      setError("Failed to load grading queue");
    } finally {
      setIsLoading(false);
    }
  }, [instructorId, courseId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Calculate stats
  const stats: StatsData = useMemo(() => {
    const today = new Date().toDateString();
    return {
      totalPending: queue.filter((i) => i.status === "submitted").length,
      gradedToday: 0, // Would need graded items to calculate
      lateSubmissions: queue.filter((i) => i.isLate).length,
      regradeRequests: queue.filter((i) => i.status === "regrade_requested").length,
    };
  }, [queue]);

  // Filter and sort queue
  const filteredQueue = useMemo(() => {
    let result = [...queue];

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((i) => i.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.userName.toLowerCase().includes(query) ||
          i.assignmentTitle.toLowerCase().includes(query) ||
          i.courseTitle.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "submittedAt":
          comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          break;
        case "studentName":
          comparison = a.userName.localeCompare(b.userName);
          break;
        case "assignmentTitle":
          comparison = a.assignmentTitle.localeCompare(b.assignmentTitle);
          break;
        case "dueDate":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [queue, filterStatus, searchQuery, sortField, sortDirection]);

  // Handle start grading
  const handleStartGrading = useCallback(
    async (item: GradingQueueItem) => {
      setStartingId(item.submissionId);
      try {
        const result = await startGrading(item.submissionId, instructorId);
        if (result) {
          onSelectSubmission(item);
        }
      } catch (error) {
        console.error('[GradingDashboard] Failed to start grading:', error);
        setError("Failed to start grading");
      } finally {
        setStartingId(null);
      }
    },
    [instructorId, onSelectSubmission]
  );

  // Toggle sort
  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  return (
    <div style={containerStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: "rgba(139, 92, 246, 0.2)",
              }}
            >
              <ClipboardCheck size={24} color="#8B5CF6" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#fff" }}>
                Grading Dashboard
              </h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#9CA3AF" }}>
                Review and grade student submissions
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={loadQueue}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.04)",
              color: "#9CA3AF",
              fontSize: "13px",
              cursor: isLoading ? "wait" : "pointer",
            }}
            whileHover={{ background: "rgba(255, 255, 255, 0.08)" }}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </motion.button>
        </div>

        <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#9CA3AF" }}>
          Track and manage student submissions in real time.
        </p>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <StatCard
            icon={<Clock size={18} />}
            label="Pending Review"
            value={stats.totalPending}
            color="#3B82F6"
          />
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label="Graded Today"
            value={stats.gradedToday}
            color="#10B981"
          />
          <StatCard
            icon={<AlertTriangle size={18} />}
            label="Late Submissions"
            value={stats.lateSubmissions}
            color="#F59E0B"
          />
          <StatCard
            icon={<RefreshCw size={18} />}
            label="Regrade Requests"
            value={stats.regradeRequests}
            color="#EF4444"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div style={filterBarStyles}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search
            size={16}
            color="#6B7280"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="Search by student, assignment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyles}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            style={filterButtonStyles(filterStatus === "all")}
          >
            <Filter size={14} />
            All ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("submitted")}
            style={filterButtonStyles(filterStatus === "submitted")}
          >
            Pending ({queue.filter((i) => i.status === "submitted").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("grading")}
            style={filterButtonStyles(filterStatus === "grading")}
          >
            In Progress ({queue.filter((i) => i.status === "grading").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("regrade_requested")}
            style={filterButtonStyles(filterStatus === "regrade_requested")}
          >
            Regrade ({queue.filter((i) => i.status === "regrade_requested").length})
          </button>
        </div>

        {/* Sort Dropdown */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "#6B7280" }}>Sort by:</span>
          <select
            value={sortField}
            onChange={(e) => handleSortChange(e.target.value as SortField)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.04)",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="submittedAt">Submit Date</option>
            <option value="studentName">Student Name</option>
            <option value="assignmentTitle">Assignment</option>
            <option value="dueDate">Due Date</option>
          </select>
          <button
            type="button"
            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.04)",
              color: "#9CA3AF",
              cursor: "pointer",
            }}
          >
            <SortAsc
              size={16}
              style={{
                transform: sortDirection === "desc" ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#EF4444",
              fontSize: "14px",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Loader2 size={32} color="#8B5CF6" className="animate-spin" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "#9CA3AF" }}>Loading grading queue...</p>
        </div>
      ) : filteredQueue.length === 0 ? (
        /* Empty State */
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            background: "rgba(255, 255, 255, 0.04)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <CheckCircle2 size={48} color="#10B981" style={{ opacity: 0.5, margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "18px" }}>
            {searchQuery || filterStatus !== "all" ? "No matching submissions" : "You're all caught up!"}
          </h3>
          <p style={{ margin: 0, color: "#9CA3AF", fontSize: "14px" }}>
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your filters"
              : "There are no submissions waiting for review right now."}
          </p>
        </div>
      ) : (
        /* Queue List */
        <div>
          {filteredQueue.map((item) => (
            <QueueItemCard
              key={item.submissionId}
              item={item}
              onSelect={() => onSelectSubmission(item)}
              onStartGrading={() => handleStartGrading(item)}
              isStarting={startingId === item.submissionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GradingDashboard;
