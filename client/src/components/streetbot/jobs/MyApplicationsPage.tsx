import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Briefcase, Clock, CheckCircle, XCircle, AlertCircle, Send } from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { getApplications, withdrawApplication, seedIfNeeded } from "./jobsStorage";
import type { JobApplication, ApplicationStatus } from "./types";

type FilterTab = "all" | ApplicationStatus | "withdrawn";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  applied: { label: "Applied", color: "#3B82F6", icon: Send },
  screening: { label: "Screening", color: "#8B5CF6", icon: Clock },
  under_review: { label: "Under Review", color: "#F59E0B", icon: Clock },
  interview: { label: "Interview", color: "#06B6D4", icon: Briefcase },
  offered: { label: "Offered", color: "#10B981", icon: CheckCircle },
  hired: { label: "Hired", color: "#22C55E", icon: CheckCircle },
  rejected: { label: "Rejected", color: "#EF4444", icon: XCircle },
  withdrawn: { label: "Withdrawn", color: "#6B7280", icon: AlertCircle },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "under_review", label: "Under Review" },
  { key: "interview", label: "Interview" },
  { key: "offered", label: "Offered" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
  { key: "withdrawn", label: "Withdrawn" },
];

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

export default function MyApplicationsPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const userId = useMemo(() => getUserId(), []);

  useEffect(() => {
    seedIfNeeded(userId);
    setApplications(getApplications(userId));
  }, [userId]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return applications;
    if (activeFilter === "withdrawn") return applications.filter((a) => a.withdrawn);
    return applications.filter((a) => !a.withdrawn && a.status === activeFilter);
  }, [applications, activeFilter]);

  const stats = useMemo(() => {
    const active = applications.filter((a) => !a.withdrawn);
    return {
      total: active.length,
      interviews: active.filter((a) => a.status === "interview").length,
      offers: active.filter((a) => a.status === "offered").length,
    };
  }, [applications]);

  const handleWithdraw = (appId: string) => {
    withdrawApplication(userId, appId);
    setApplications(getApplications(userId));
    setConfirmWithdraw(null);
    setToast("Application withdrawn");
    setTimeout(() => setToast(""), 3000);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      <div style={{ position: "relative", zIndex: 1, padding: "48px 24px 60px", maxWidth: "900px", margin: "0 auto" }}>
        {/* Back link */}
        <Link
          to="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.875rem",
            color: colors.textSecondary,
            textDecoration: "none",
            marginBottom: "24px",
          }}
        >
          <ArrowLeft size={16} /> Back to Jobs
        </Link>

        {/* Header */}
        <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
          My Applications
        </h1>
        <p style={{ color: colors.textSecondary, margin: "0 0 32px", fontSize: "1rem" }}>
          Track your job applications and their status
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
          {[
            { label: "Active", value: stats.total, color: "#3B82F6" },
            { label: "Interviews", value: stats.interviews, color: "#8B5CF6" },
            { label: "Offers", value: stats.offers, color: "#10B981" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                ...glassSurface,
                padding: "16px 24px",
                borderRadius: "16px",
                textAlign: "center",
                minWidth: "100px",
                flex: 1,
              }}
            >
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count =
              tab.key === "all"
                ? applications.length
                : tab.key === "withdrawn"
                  ? applications.filter((a) => a.withdrawn).length
                  : applications.filter((a) => !a.withdrawn && a.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: isActive ? "none" : `1px solid ${colors.border}`,
                  background: isActive
                    ? (STATUS_CONFIG[tab.key]?.color || colors.accent)
                    : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                  color: isActive ? "#fff" : colors.textSecondary,
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
                <span style={{ marginLeft: "6px", opacity: 0.7, fontSize: "0.7rem" }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Application list */}
        {filtered.length === 0 ? (
          <div style={{ ...glassSurface, borderRadius: "20px", padding: "60px 24px", textAlign: "center" }}>
            <Briefcase size={48} color={colors.textMuted} style={{ marginBottom: "16px" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>
              No applications found
            </h3>
            <p style={{ color: colors.textSecondary, margin: "0 0 20px" }}>
              {activeFilter === "all"
                ? "You haven't applied to any jobs yet."
                : `No applications with status "${FILTER_TABS.find((t) => t.key === activeFilter)?.label}".`}
            </p>
            <Link
              to="/jobs"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: "12px",
                background: colors.accent,
                color: "#000",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filtered.map((app) => {
              const statusKey = app.withdrawn ? "withdrawn" : app.status;
              const cfg = STATUS_CONFIG[statusKey];
              const Icon = cfg.icon;
              return (
                <div
                  key={app.id}
                  style={{
                    ...glassCard,
                    padding: "20px 24px",
                    display: "flex",
                    gap: "16px",
                    alignItems: "flex-start",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: `${cfg.color}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} color={cfg.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>
                        {app.jobSnapshot.title}
                      </h3>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "8px",
                          background: `${cfg.color}22`,
                          color: cfg.color,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.85rem", color: colors.textSecondary, margin: "0 0 4px" }}>
                      {app.jobSnapshot.organization}
                    </p>
                    <div style={{ display: "flex", gap: "16px", fontSize: "0.75rem", color: colors.textMuted, flexWrap: "wrap" }}>
                      {app.jobSnapshot.location && <span>{app.jobSnapshot.location}</span>}
                      {app.jobSnapshot.compensation && <span>{app.jobSnapshot.compensation}</span>}
                      {app.jobSnapshot.opportunity_type && <span>{app.jobSnapshot.opportunity_type}</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "8px" }}>
                      Applied {formatDate(app.appliedAt)}
                      {app.updatedAt !== app.appliedAt && ` · Updated ${formatDate(app.updatedAt)}`}
                    </div>
                  </div>

                  {/* Actions */}
                  {!app.withdrawn && (
                    <div style={{ flexShrink: 0 }}>
                      {confirmWithdraw === app.id ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleWithdraw(app.id)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "8px",
                              background: "#EF4444",
                              color: "#fff",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmWithdraw(null)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "8px",
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                              color: colors.textSecondary,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              border: `1px solid ${colors.border}`,
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmWithdraw(app.id)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            background: "transparent",
                            color: colors.textMuted,
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            border: `1px solid ${colors.border}`,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 24px",
            borderRadius: "12px",
            background: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.8)",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
