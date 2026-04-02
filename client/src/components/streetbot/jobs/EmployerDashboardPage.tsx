import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Eye, Users, BarChart3, Briefcase } from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { getEmployerListings, toggleListingActive, seedIfNeeded } from "./jobsStorage";
import type { EmployerListing } from "./types";

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

export default function EmployerDashboardPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const [listings, setListings] = useState<EmployerListing[]>([]);
  const [search, setSearch] = useState("");

  const userId = useMemo(() => getUserId(), []);

  useEffect(() => {
    seedIfNeeded(userId);
    setListings(getEmployerListings(userId));
  }, [userId]);

  const stats = useMemo(() => {
    const active = listings.filter((l) => l.isActive);
    return {
      total: listings.length,
      active: active.length,
      totalViews: listings.reduce((s, l) => s + l.stats.viewCount, 0),
      totalApps: listings.reduce((s, l) => s + l.stats.applicationCount, 0),
    };
  }, [listings]);

  const filtered = useMemo(() => {
    if (!search) return listings;
    const q = search.toLowerCase();
    return listings.filter(
      (l) =>
        l.jobSnapshot.title.toLowerCase().includes(q) ||
        (l.jobSnapshot.organization || "").toLowerCase().includes(q),
    );
  }, [listings, search]);

  const handleToggle = (jobId: string) => {
    toggleListingActive(userId, jobId);
    setListings(getEmployerListings(userId));
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const statCards = [
    { label: "Total Listings", value: stats.total, color: "#3B82F6", icon: Briefcase },
    { label: "Active", value: stats.active, color: "#10B981", icon: BarChart3 },
    { label: "Total Views", value: stats.totalViews.toLocaleString(), color: "#8B5CF6", icon: Eye },
    { label: "Applications", value: stats.totalApps, color: "#F59E0B", icon: Users },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      <div style={{ position: "relative", zIndex: 1, padding: "48px 24px 60px", maxWidth: "1000px", margin: "0 auto" }}>
        {/* Back link */}
        <Link
          to="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 500,
            color: colors.textMuted,
            textDecoration: "none",
            marginBottom: "20px",
            transition: "all 0.2s",
          }}
        >
          <ArrowLeft size={14} /> Job Seeker View
        </Link>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
              Employer Dashboard
            </h1>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: "1rem" }}>
              Manage your job listings and track applicants
            </p>
          </div>
          <Link
            to="/jobs/post"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "14px",
              background: colors.accent,
              color: "#000",
              fontWeight: 700,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(255, 214, 0, 0.3)",
              transition: "all 0.2s",
            }}
          >
            <Plus size={18} /> Create New Listing
          </Link>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                style={{
                  ...glassSurface,
                  padding: "20px",
                  borderRadius: "18px",
                  textAlign: "center",
                }}
              >
                <Icon size={20} color={s.color} style={{ marginBottom: "8px" }} />
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "4px" }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div
          style={{
            ...glassSurface,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 20px",
            borderRadius: "14px",
            marginBottom: "24px",
            maxWidth: "400px",
          }}
        >
          <Eye size={18} color={colors.textMuted} />
          <input
            type="text"
            placeholder="Search your listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              fontSize: "0.9rem",
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
            }}
          />
        </div>

        {/* Listings */}
        {filtered.length === 0 ? (
          <div style={{ ...glassSurface, borderRadius: "20px", padding: "60px 24px", textAlign: "center" }}>
            <Briefcase size={48} color={colors.textMuted} style={{ marginBottom: "16px" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>
              {search ? "No matching listings" : "No listings yet"}
            </h3>
            <p style={{ color: colors.textSecondary, margin: "0 0 20px" }}>
              {search ? "Try a different search term." : "Post your first job to start attracting candidates."}
            </p>
            {!search && (
              <Link
                to="/jobs/post"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  background: colors.accent,
                  color: "#000",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Plus size={16} /> Post Your First Job
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filtered.map((listing) => (
              <div
                key={listing.jobId}
                style={{
                  ...glassCard,
                  padding: "20px 24px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  transition: "all 0.2s",
                }}
              >
                {/* Logo */}
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "#f8f8f8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {listing.jobSnapshot.logo_url ? (
                    <img
                      src={listing.jobSnapshot.logo_url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Briefcase size={22} color={colors.textMuted} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
                    {listing.jobSnapshot.title}
                  </h3>
                  <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: colors.textMuted, flexWrap: "wrap" }}>
                    {listing.jobSnapshot.organization && <span>{listing.jobSnapshot.organization}</span>}
                    {listing.jobSnapshot.location && <span>{listing.jobSnapshot.location}</span>}
                    {listing.jobSnapshot.opportunity_type && (
                      <span
                        style={{
                          padding: "1px 8px",
                          borderRadius: "6px",
                          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {listing.jobSnapshot.opportunity_type}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: colors.textMuted, marginTop: "6px" }}>
                    Posted {formatDate(listing.createdAt)}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: "20px", flexShrink: 0, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8B5CF6", fontSize: "0.8rem", fontWeight: 600 }}>
                      <Eye size={14} /> {listing.stats.viewCount}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: colors.textMuted }}>views</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#F59E0B", fontSize: "0.8rem", fontWeight: 600 }}>
                      <Users size={14} /> {listing.stats.applicationCount}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: colors.textMuted }}>applicants</div>
                  </div>
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => handleToggle(listing.jobId)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.2s",
                    background: listing.isActive ? "#10B98122" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    color: listing.isActive ? "#10B981" : colors.textMuted,
                    minWidth: "80px",
                  }}
                >
                  {listing.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
