import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  MessageSquare,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  UserPeerReviewDashboard,
  PeerReviewAssignment,
  ReviewerStats,
  getUserDashboard,
  getReviewerStats,
} from "./api/peer-review";
import { PeerReviewCard } from "./PeerReviewCard";
import { PeerReviewForm } from "./PeerReviewForm";
import { PeerReviewFeedback } from "./PeerReviewFeedback";
import { PeerReviewStats } from "./PeerReviewStats";

interface PeerReviewDashboardProps {
  userId: string;
}

type TabType = "pending" | "received" | "given";

export function PeerReviewDashboard({ userId }: PeerReviewDashboardProps) {
  const [dashboard, setDashboard] = useState<UserPeerReviewDashboard | null>(null);
  const [stats, setStats] = useState<ReviewerStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [selectedAssignment, setSelectedAssignment] = useState<PeerReviewAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const [dashboardData, statsData] = await Promise.all([
        getUserDashboard(userId),
        getReviewerStats(userId),
      ]);
      setDashboard(dashboardData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error("Failed to load peer review data:", err);
      setError("Failed to load peer review data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartReview = (assignment: PeerReviewAssignment) => {
    setSelectedAssignment(assignment);
  };

  const handleReviewComplete = () => {
    setSelectedAssignment(null);
    loadData(true);
  };

  const handleBackFromReview = () => {
    setSelectedAssignment(null);
  };

  // Show review form if an assignment is selected
  if (selectedAssignment) {
    return (
      <PeerReviewForm
        assignment={selectedAssignment}
        userId={userId}
        onBack={handleBackFromReview}
        onSubmitSuccess={handleReviewComplete}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "20px",
          minHeight: "400px",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Users className="w-10 h-10" style={{ color: "rgba(139, 92, 246, 0.8)" }} />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-center p-8 rounded-xl"
        style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
        }}
      >
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#EF4444" }} />
        <p style={{ color: "#EF4444" }}>{error}</p>
        <button
          onClick={() => loadData()}
          className="mt-4 px-4 py-2 rounded-lg"
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ElementType; count?: number }[] = [
    {
      id: "pending",
      label: "To Review",
      icon: Clock,
      count: dashboard?.pendingReviews.length || 0,
    },
    {
      id: "received",
      label: "Received",
      icon: MessageSquare,
      count: dashboard?.reviewsReceived.length || 0,
    },
    {
      id: "given",
      label: "Completed",
      icon: CheckCircle,
      count: dashboard?.completedReviews || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-3"
            style={{ color: "rgba(255, 255, 255, 0.95)" }}
          >
            <Users className="w-7 h-7" style={{ color: "#8B5CF6" }} />
            Peer Reviews
          </h1>
          <p className="mt-1" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            Review your peers&apos; work and receive feedback on yours
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
          >
            <RefreshCw className="w-5 h-5" />
          </motion.div>
        </motion.button>
      </div>

      {/* Stats */}
      {stats && <PeerReviewStats stats={stats} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ background: "rgba(245, 158, 11, 0.2)" }}
            >
              <Clock className="w-5 h-5" style={{ color: "#F59E0B" }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold"
                style={{ color: "#F59E0B" }}
              >
                {dashboard?.pendingReviews.length || 0}
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Pending Reviews
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl"
          style={{
            background: "rgba(139, 92, 246, 0.1)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ background: "rgba(139, 92, 246, 0.2)" }}
            >
              <MessageSquare className="w-5 h-5" style={{ color: "#8B5CF6" }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold"
                style={{ color: "#8B5CF6" }}
              >
                {dashboard?.reviewsReceived.length || 0}
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Reviews Received
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl"
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ background: "rgba(16, 185, 129, 0.2)" }}
            >
              <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />
            </div>
            <div>
              <div
                className="text-2xl font-bold"
                style={{ color: "#10B981" }}
              >
                {dashboard?.totalPointsEarned || 0}
              </div>
              <div
                className="text-sm"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Points Earned
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 p-1 rounded-xl"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all"
            style={{
              background: activeTab === tab.id
                ? "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))"
                : "transparent",
              color: activeTab === tab.id
                ? "rgba(255, 255, 255, 0.95)"
                : "rgba(255, 255, 255, 0.5)",
              border: activeTab === tab.id
                ? "1px solid rgba(139, 92, 246, 0.3)"
                : "1px solid transparent",
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: activeTab === tab.id
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(255, 255, 255, 0.1)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {dashboard?.pendingReviews && dashboard.pendingReviews.length > 0 ? (
              dashboard.pendingReviews.map((assignment) => (
                <PeerReviewCard
                  key={assignment.id}
                  assignment={assignment}
                  onStartReview={handleStartReview}
                  onContinueReview={handleStartReview}
                />
              ))
            ) : (
              <div
                className="text-center p-12 rounded-xl"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <CheckCircle
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: "rgba(16, 185, 129, 0.5)" }}
                />
                <p
                  className="text-lg font-medium"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  All caught up!
                </p>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  You have no pending peer reviews at the moment
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "received" && (
          <motion.div
            key="received"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PeerReviewFeedback
              reviews={dashboard?.reviewsReceived || []}
              userId={userId}
              onRatingSubmitted={() => loadData(true)}
            />
          </motion.div>
        )}

        {activeTab === "given" && (
          <motion.div
            key="given"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {dashboard?.completedReviews && dashboard.completedReviews > 0 ? (
              <div
                className="text-center p-8 rounded-xl"
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}
              >
                <CheckCircle
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: "#10B981" }}
                />
                <p
                  className="text-xl font-semibold"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  {dashboard.completedReviews} Review{dashboard.completedReviews > 1 ? "s" : ""} Completed
                </p>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  {dashboard.averageGivenScore !== undefined && (
                    <>Average score given: {Math.round(dashboard.averageGivenScore)}%</>
                  )}
                </p>
                <p
                  className="mt-4 text-sm"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Thank you for helping your peers improve!
                </p>
              </div>
            ) : (
              <div
                className="text-center p-12 rounded-xl"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <Users
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ color: "rgba(255, 255, 255, 0.3)" }}
                />
                <p
                  className="text-lg font-medium"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  No reviews completed yet
                </p>
                <p
                  className="mt-2"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Complete peer reviews to earn points and help your peers
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
