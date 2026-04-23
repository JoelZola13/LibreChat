import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Plus, Eye, Users, BarChart3, Briefcase, Pencil, Trash2,
  Clock, CheckCircle, Search, MapPin, DollarSign, Calendar, TrendingUp,
  ArrowRight, ChevronRight, XCircle, Filter,
} from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import {
  getEmployerListings, toggleListingActive, seedIfNeeded,
  deleteEmployerListing, deletePostedJob, updateEmployerListing,
  checkAndExpireJobs, getApplicationsForJob,
} from "./jobsStorage";
import type { EmployerListing } from "./types";

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

type StatusFilter = "all" | "active" | "inactive" | "filled";

export default function EmployerDashboardPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const [listings, setListings] = useState<EmployerListing[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [toast, setToast] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<number | null>(null);

  const userId = useMemo(() => getUserId(), []);

  const reload = useCallback(() => {
    setListings(getEmployerListings(userId));
  }, [userId]);

  useEffect(() => {
    seedIfNeeded(userId);
    checkAndExpireJobs(userId);
    reload();
  }, [userId, reload]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const stats = useMemo(() => {
    const active = listings.filter((l) => l.isActive && !l.positionFilled);
    const filled = listings.filter((l) => l.positionFilled);
    return {
      total: listings.length,
      active: active.length,
      inactive: listings.length - active.length - filled.length,
      filled: filled.length,
      totalViews: listings.reduce((s, l) => s + l.stats.viewCount, 0),
      totalApps: listings.reduce((s, l) => s + l.stats.applicationCount, 0),
    };
  }, [listings]);

  const filtered = useMemo(() => {
    let result = listings;

    if (statusFilter === "active") result = result.filter((l) => l.isActive && !l.positionFilled);
    else if (statusFilter === "inactive") result = result.filter((l) => !l.isActive && !l.positionFilled);
    else if (statusFilter === "filled") result = result.filter((l) => l.positionFilled);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.jobSnapshot.title.toLowerCase().includes(q) ||
          (l.jobSnapshot.organization || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [listings, search, statusFilter]);

  const handleToggle = (jobId: string) => {
    toggleListingActive(userId, jobId);
    reload();
  };

  const handleDelete = (jobId: string) => {
    deleteEmployerListing(userId, jobId);
    deletePostedJob(jobId);
    reload();
    setDeleteConfirmId(null);
    showToast("Listing deleted");
  };

  const handleMarkFilled = (jobId: string) => {
    updateEmployerListing(userId, jobId, { positionFilled: true, isActive: false });
    reload();
    showToast("Position marked as filled");
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const getListingStatus = (listing: EmployerListing): { label: string; color: string; dotColor: string } => {
    if (listing.positionFilled) return { label: "Filled", color: "#22C55E", dotColor: "#22C55E" };
    if (!listing.isActive) {
      if (listing.expirationDate && new Date(listing.expirationDate) <= new Date()) {
        return { label: "Expired", color: "#EF4444", dotColor: "#EF4444" };
      }
      return { label: "Inactive", color: "#6B7280", dotColor: "#6B7280" };
    }
    if (listing.expirationDate) {
      const daysLeft = Math.ceil((new Date(listing.expirationDate).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 7) return { label: `Active \u00b7 ${daysLeft}d left`, color: "#F59E0B", dotColor: "#10B981" };
    }
    return { label: "Active", color: "#10B981", dotColor: "#10B981" };
  };

  const getAccentStrip = (listing: EmployerListing): string => {
    if (listing.positionFilled) return "#22C55E";
    if (!listing.isActive) return listing.expirationDate && new Date(listing.expirationDate) <= new Date() ? "#EF4444" : "#6B7280";
    return "#10B981";
  };

  // Pipeline analytics
  const funnelData = useMemo(() => {
    let totalApps = 0;
    let interviews = 0;
    let offers = 0;
    let hires = 0;
    for (const listing of listings) {
      const apps = getApplicationsForJob(listing.jobId);
      totalApps += apps.length;
      for (const app of apps) {
        if (app.status === "interview") interviews++;
        if (app.status === "offered") offers++;
        if (app.status === "hired") hires++;
      }
    }
    return [
      { label: "Views", value: stats.totalViews, color: "#8B5CF6", icon: Eye },
      { label: "Applied", value: totalApps || stats.totalApps, color: "#3B82F6", icon: Users },
      { label: "Interview", value: interviews, color: "#06B6D4", icon: Calendar },
      { label: "Offered", value: offers, color: "#F59E0B", icon: CheckCircle },
      { label: "Hired", value: hires, color: "#22C55E", icon: CheckCircle },
    ];
  }, [listings, stats]);

  const statCards = [
    { label: "Total Listings", value: stats.total, color: "#3B82F6", icon: Briefcase, trend: null },
    { label: "Active", value: stats.active, color: "#10B981", icon: TrendingUp, trend: null },
    { label: "Total Views", value: stats.totalViews, color: "#8B5CF6", icon: Eye, trend: null },
    { label: "Applications", value: stats.totalApps, color: "#F59E0B", icon: Users, trend: null },
  ];

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "active", label: "Active", count: stats.active },
    { key: "inactive", label: "Inactive", count: stats.inactive },
    { key: "filled", label: "Filled", count: stats.filled },
  ];

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      {/* Toast with slide-in */}
      {toast && (
        <div
          style={{
            position: "fixed", top: "24px", right: "24px", zIndex: 1000,
            display: "flex", alignItems: "center", gap: "10px",
            padding: "14px 24px", borderRadius: "16px",
            background: "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff", fontWeight: 600, fontSize: "0.9rem",
            boxShadow: "0 8px 32px rgba(16, 185, 129, 0.3)",
            animation: "slideInRight 0.3s ease",
          }}
        >
          <CheckCircle size={18} />
          {toast}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ ...glassCard, padding: "40px", maxWidth: "420px", width: "100%", textAlign: "center", borderRadius: "24px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%", margin: "0 auto 20px",
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
              border: "2px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={32} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>Delete This Listing?</h3>
            <p style={{ color: colors.textSecondary, fontSize: "0.9rem", margin: "0 0 28px", lineHeight: 1.5 }}>
              This will permanently remove the listing and its data. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "12px 28px", borderRadius: "14px", border: `1px solid ${colors.border}`,
                  background: "transparent", color: colors.text, fontWeight: 600, cursor: "pointer",
                  fontSize: "0.9rem", transition: "all 0.2s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: "12px 28px", borderRadius: "14px", border: "none",
                  background: "linear-gradient(135deg, #EF4444, #DC2626)", color: "#fff",
                  fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)", transition: "all 0.2s",
                }}
              >
                Delete Listing
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "40px 24px 60px", maxWidth: "1100px", margin: "0 auto" }}>

        {/* Back link */}
        <Link
          to="/jobs"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "13px", fontWeight: 500, color: colors.textMuted,
            textDecoration: "none", marginBottom: "24px", transition: "all 0.2s",
          }}
        >
          <ArrowLeft size={14} /> Job Seeker View
        </Link>

        {/* ═══ HEADER ═══ */}
        <div style={{ marginBottom: "12px" }}>
          <p style={{ fontSize: "0.85rem", color: colors.textMuted, margin: "0 0 4px" }}>
            {todayStr}
          </p>
          <h1 style={{
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, margin: "0 0 6px",
            background: isDark ? "linear-gradient(135deg, #fff, rgba(255,255,255,0.7))" : "linear-gradient(135deg, #1a1a2e, #333)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Employer Dashboard
          </h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: "0.95rem" }}>
            Manage your listings, track applicants, and grow your team.
          </p>
        </div>

        {/* Gold accent line */}
        <div style={{
          height: "3px", width: "80px", borderRadius: "2px", marginBottom: "32px",
          background: "linear-gradient(to right, #FFD600, transparent)",
        }} />

        {/* ═══ ACTION TOOLBAR ═══ */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "12px", marginBottom: "28px",
        }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link
              to="/jobs/post"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "12px 24px", borderRadius: "14px",
                background: "linear-gradient(135deg, #FFD600, #E6C200)",
                color: "#000", fontWeight: 700, fontSize: "0.9rem",
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(255, 214, 0, 0.35)",
                transition: "all 0.2s",
              }}
            >
              <Plus size={18} /> New Listing
            </Link>
            <Link
              to="/jobs/employer/candidates"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "12px 20px", borderRadius: "14px",
                border: `1px solid ${colors.border}`,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
                backdropFilter: "blur(12px)",
                color: colors.text, fontWeight: 600, fontSize: "0.85rem",
                textDecoration: "none", transition: "all 0.2s",
              }}
            >
              <Search size={16} /> Candidates
            </Link>
          </div>
        </div>

        {/* ═══ STATS CARDS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {statCards.map((s, idx) => {
            const Icon = s.icon;
            const isHovered = hoveredStat === idx;
            return (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredStat(idx)}
                onMouseLeave={() => setHoveredStat(null)}
                style={{
                  ...glassSurface,
                  padding: "24px",
                  borderRadius: "20px",
                  borderTop: `3px solid ${s.color}`,
                  transition: "all 0.3s ease",
                  transform: isHovered ? "translateY(-4px)" : "none",
                  boxShadow: isHovered
                    ? `0 16px 48px rgba(0,0,0,${isDark ? "0.4" : "0.1"}), 0 0 20px ${s.color}22`
                    : `0 4px 16px rgba(0,0,0,${isDark ? "0.2" : "0.04"})`,
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: `${s.color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={22} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: colors.text, lineHeight: 1 }}>
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: colors.textMuted, marginTop: "6px", fontWeight: 500 }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ SEARCH & FILTER BAR ═══ */}
        <div style={{
          ...glassSurface,
          display: "flex", alignItems: "center", gap: "12px",
          padding: "10px 16px", borderRadius: "18px", marginBottom: "16px",
          flexWrap: "wrap",
        }}>
          <Search size={18} color={colors.textMuted} style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: "160px", fontSize: "0.9rem",
              background: "transparent", border: "none", outline: "none",
              color: colors.text,
            }}
          />

          {/* Status filter tabs */}
          <div style={{ display: "flex", gap: "4px", marginLeft: "auto" }}>
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  padding: "7px 14px", borderRadius: "10px",
                  fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                  border: statusFilter === tab.key ? "none" : `1px solid transparent`,
                  background: statusFilter === tab.key
                    ? (isDark ? "rgba(255,214,0,0.15)" : "rgba(255,214,0,0.2)")
                    : "transparent",
                  color: statusFilter === tab.key ? colors.accent : colors.textMuted,
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700,
                  padding: "1px 6px", borderRadius: "6px",
                  background: statusFilter === tab.key ? `${colors.accent}22` : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                  color: statusFilter === tab.key ? colors.accent : colors.textMuted,
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div style={{ fontSize: "0.8rem", color: colors.textMuted, marginBottom: "16px", fontWeight: 500 }}>
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
          {statusFilter !== "all" ? ` \u00b7 ${statusFilter}` : ""}
          {search ? ` matching "${search}"` : ""}
        </div>

        {/* ═══ JOB LISTINGS ═══ */}
        {filtered.length === 0 ? (
          <div style={{
            ...glassSurface, borderRadius: "24px", padding: "80px 24px",
            textAlign: "center", border: `1px dashed ${colors.border}`,
          }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%", margin: "0 auto 20px",
              background: "linear-gradient(135deg, rgba(255,214,0,0.15), rgba(255,214,0,0.05))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Briefcase size={36} color={colors.accent} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
              {search ? "No matching listings" : "No listings yet"}
            </h3>
            <p style={{ color: colors.textSecondary, margin: "0 0 24px", fontSize: "0.95rem", maxWidth: "360px", marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
              {search
                ? "Try a different search term or filter."
                : "Start attracting top candidates by posting your first job listing."}
            </p>
            {!search && (
              <Link
                to="/jobs/post"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "14px 28px", borderRadius: "14px",
                  background: "linear-gradient(135deg, #FFD600, #E6C200)",
                  color: "#000", fontWeight: 700, fontSize: "0.9rem",
                  textDecoration: "none", boxShadow: "0 4px 20px rgba(255, 214, 0, 0.35)",
                }}
              >
                <Plus size={18} /> Post Your First Job
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((listing) => {
              const status = getListingStatus(listing);
              const accentColor = getAccentStrip(listing);
              const isHovered = hoveredCard === listing.jobId;
              return (
                <div
                  key={listing.jobId}
                  onMouseEnter={() => setHoveredCard(listing.jobId)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    ...glassCard,
                    borderRadius: "20px",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                    transform: isHovered ? "translateY(-3px)" : "none",
                    boxShadow: isHovered
                      ? `0 16px 40px rgba(0,0,0,${isDark ? "0.35" : "0.08"}), 0 0 0 1px ${accentColor}33`
                      : `0 4px 16px rgba(0,0,0,${isDark ? "0.15" : "0.04"})`,
                  }}
                >
                  <div style={{ display: "flex" }}>
                    {/* Left accent strip */}
                    <div style={{ width: "4px", background: accentColor, flexShrink: 0 }} />

                    <div style={{ flex: 1, padding: "20px 24px" }}>
                      {/* Top: Logo + Title + Status */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "14px" }}>
                        {/* Logo */}
                        <div style={{
                          width: "56px", height: "56px", borderRadius: "16px", flexShrink: 0,
                          background: isDark ? "rgba(255,255,255,0.06)" : "#f5f5f5",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden", border: `1px solid ${colors.border}`,
                        }}>
                          {listing.jobSnapshot.logo_url ? (
                            <img
                              src={listing.jobSnapshot.logo_url} alt=""
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <Briefcase size={24} color={colors.textMuted} />
                          )}
                        </div>

                        {/* Title & Org */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: colors.text, margin: "0 0 4px", lineHeight: 1.3 }}>
                            {listing.jobSnapshot.title}
                          </h3>
                          {listing.jobSnapshot.organization && (
                            <div style={{ fontSize: "0.8rem", color: colors.textSecondary, fontWeight: 500 }}>
                              {listing.jobSnapshot.organization}
                            </div>
                          )}
                        </div>

                        {/* Status badge */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: "6px",
                          padding: "5px 12px", borderRadius: "20px", flexShrink: 0,
                          background: `${status.color}12`,
                          border: `1px solid ${status.color}30`,
                        }}>
                          <div style={{
                            width: "7px", height: "7px", borderRadius: "50%",
                            background: status.dotColor,
                            boxShadow: listing.isActive && !listing.positionFilled ? `0 0 6px ${status.dotColor}` : "none",
                          }} />
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: status.color }}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Metadata row */}
                      <div style={{
                        display: "flex", gap: "16px", flexWrap: "wrap",
                        fontSize: "0.78rem", color: colors.textMuted,
                        marginBottom: "16px", paddingBottom: "14px",
                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                      }}>
                        {listing.jobSnapshot.location && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={13} color={colors.textMuted} /> {listing.jobSnapshot.location}
                          </span>
                        )}
                        {listing.jobSnapshot.opportunity_type && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Briefcase size={13} color={colors.textMuted} /> {listing.jobSnapshot.opportunity_type}
                          </span>
                        )}
                        {listing.jobSnapshot.compensation && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <DollarSign size={13} color={colors.textMuted} /> {listing.jobSnapshot.compensation}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Calendar size={13} color={colors.textMuted} /> {formatDate(listing.createdAt)}
                        </span>
                      </div>

                      {/* Bottom: Stats + Actions */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        {/* Stats pills */}
                        <div style={{ display: "flex", gap: "12px" }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            padding: "5px 12px", borderRadius: "10px",
                            background: isDark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.06)",
                          }}>
                            <Eye size={14} color="#8B5CF6" />
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#8B5CF6" }}>{listing.stats.viewCount}</span>
                            <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>views</span>
                          </div>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            padding: "5px 12px", borderRadius: "10px",
                            background: isDark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.06)",
                          }}>
                            <Users size={14} color="#F59E0B" />
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#F59E0B" }}>{listing.stats.applicationCount}</span>
                            <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>applicants</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <Link
                            to={`/jobs/employer/applicants/${listing.jobId}`}
                            title="View applicants"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "8px 16px", borderRadius: "10px",
                              background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
                              color: "#3B82F6", textDecoration: "none",
                              fontSize: "0.78rem", fontWeight: 600, transition: "all 0.2s",
                            }}
                          >
                            <Users size={14} /> Applicants
                            <ChevronRight size={14} />
                          </Link>

                          {listing.jobData && (
                            <Link
                              to={`/jobs/post/${listing.jobId}`}
                              title="Edit listing"
                              style={{
                                padding: "8px", borderRadius: "10px",
                                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                color: colors.textMuted, textDecoration: "none",
                                display: "inline-flex", alignItems: "center", transition: "all 0.2s",
                              }}
                            >
                              <Pencil size={15} />
                            </Link>
                          )}

                          {!listing.positionFilled && listing.isActive && (
                            <button
                              onClick={() => handleMarkFilled(listing.jobId)}
                              title="Mark as filled"
                              style={{
                                padding: "8px", borderRadius: "10px",
                                background: "rgba(34,197,94,0.08)", color: "#22C55E",
                                border: "none", cursor: "pointer",
                                display: "inline-flex", alignItems: "center", transition: "all 0.2s",
                              }}
                            >
                              <CheckCircle size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggle(listing.jobId)}
                            title={listing.isActive ? "Pause listing" : "Activate listing"}
                            style={{
                              padding: "7px 14px", borderRadius: "10px",
                              fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                              border: `1px solid ${listing.isActive ? "#10B98133" : colors.border}`,
                              background: listing.isActive ? "#10B98110" : "transparent",
                              color: listing.isActive ? "#10B981" : colors.textMuted,
                              transition: "all 0.2s",
                            }}
                          >
                            {listing.isActive ? "Pause" : "Activate"}
                          </button>

                          <button
                            onClick={() => setDeleteConfirmId(listing.jobId)}
                            title="Delete listing"
                            style={{
                              padding: "8px", borderRadius: "10px",
                              background: "rgba(239,68,68,0.06)", color: "#EF4444",
                              border: "none", cursor: "pointer",
                              display: "inline-flex", alignItems: "center", transition: "all 0.2s",
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ HIRING PIPELINE ═══ */}
        {listings.length > 0 && (
          <div style={{ ...glassCard, padding: "28px", marginTop: "32px", borderRadius: "24px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "28px",
            }}>
              <div>
                <h2 style={{
                  fontSize: "1.1rem", fontWeight: 700, color: colors.text, margin: "0 0 4px",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "10px",
                    background: `${colors.accent}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BarChart3 size={16} color={colors.accent} />
                  </div>
                  Hiring Pipeline
                </h2>
                <p style={{ fontSize: "0.8rem", color: colors.textMuted, margin: 0 }}>
                  Track candidates through your hiring process
                </p>
              </div>
            </div>

            {/* Pipeline nodes */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "0", overflow: "auto", paddingBottom: "8px",
            }}>
              {funnelData.map((stage, idx) => {
                const Icon = stage.icon;
                const nextStage = funnelData[idx + 1];
                const convRate = nextStage && stage.value > 0
                  ? Math.round((nextStage.value / stage.value) * 100)
                  : null;

                return (
                  <React.Fragment key={stage.label}>
                    {/* Node */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", minWidth: "80px" }}>
                      <div style={{
                        width: "60px", height: "60px", borderRadius: "50%",
                        background: `${stage.color}15`,
                        border: `2px solid ${stage.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                      }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: stage.color }}>
                          {stage.value}
                        </span>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.text }}>
                          {stage.label}
                        </div>
                      </div>
                    </div>

                    {/* Connector line + conversion rate */}
                    {idx < funnelData.length - 1 && (
                      <div style={{
                        flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", gap: "4px", minWidth: "40px",
                      }}>
                        <div style={{
                          height: "2px", width: "100%", borderRadius: "1px",
                          background: `linear-gradient(to right, ${stage.color}60, ${funnelData[idx + 1].color}60)`,
                        }} />
                        {convRate !== null && (
                          <span style={{
                            fontSize: "0.6rem", fontWeight: 700,
                            color: convRate >= 50 ? "#22C55E" : convRate >= 20 ? "#F59E0B" : colors.textMuted,
                          }}>
                            {convRate}%
                          </span>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
