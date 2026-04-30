import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, User, MapPin, Briefcase, Award, Star } from "lucide-react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { getResumeVersions } from "./jobsStorage";
import type { ResumeVersion, Resume } from "./types";

function getUserId(): string {
  let id = localStorage.getItem("sb_user_id");
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("sb_user_id", id);
  }
  return id;
}

/**
 * Search candidates from available resume data.
 * Currently reads from localStorage; designed with abstracted interface for future API migration.
 */
function searchCandidates(query: string, skillFilter: string, locationFilter: string): Resume[] {
  // Gather all resumes from localStorage (resume versions)
  const allResumes: Resume[] = [];
  try {
    const raw = localStorage.getItem("sb_resume_versions");
    if (raw) {
      const versions: ResumeVersion[] = JSON.parse(raw);
      const seen = new Set<string>();
      for (const v of versions) {
        if (!seen.has(v.userId) && v.resume.fullName) {
          seen.add(v.userId);
          allResumes.push(v.resume);
        }
      }
    }
    // Also check legacy single resume
    const legacyRaw = localStorage.getItem("sb_user_resume");
    if (legacyRaw) {
      const legacy: Resume = JSON.parse(legacyRaw);
      if (legacy.fullName && !allResumes.some((r) => r.userId === legacy.userId)) {
        allResumes.push(legacy);
      }
    }
  } catch { /* ignore */ }

  return allResumes.filter((r) => {
    const q = query.toLowerCase();
    const matchesQuery = !q || [
      r.fullName, r.summary, r.location,
      ...(r.skills || []),
      ...(r.experience || []).map((e) => `${e.title} ${e.company} ${e.description}`),
    ].some((field) => (field || "").toLowerCase().includes(q));

    const matchesSkill = !skillFilter || (r.skills || []).some((s) => s.toLowerCase().includes(skillFilter.toLowerCase()));
    const matchesLocation = !locationFilter || (r.location || "").toLowerCase().includes(locationFilter.toLowerCase());

    return matchesQuery && matchesSkill && matchesLocation;
  });
}

export default function CandidateSearchPage() {
  const { isDark, colors, glassCard, glassSurface } = useGlassStyles();
  const [query, setQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [results, setResults] = useState<Resume[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    setResults(searchCandidates(query, skillFilter, locationFilter));
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "12px",
    border: `1px solid ${colors.border}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    color: colors.text,
    fontSize: "0.9rem",
    outline: "none",
    minWidth: "120px",
  };

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <GlassBackground />

      <div style={{ position: "relative", zIndex: 1, padding: "48px 24px 60px", maxWidth: "900px", margin: "0 auto" }}>
        <Link
          to="/jobs/employer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 500, color: colors.textMuted, textDecoration: "none", marginBottom: "20px" }}
        >
          <ArrowLeft size={14} /> Employer Dashboard
        </Link>

        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
            Candidate Search
          </h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: "0.9rem" }}>
            Search candidates by skills, experience, and keywords
          </p>
        </div>

        {/* Search Panel */}
        <div style={{ ...glassCard, padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div style={{ flex: 2, minWidth: "200px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.textMuted, marginBottom: "6px" }}>Keywords</label>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search by name, skills, experience..." style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.textMuted, marginBottom: "6px" }}>Skill</label>
              <input type="text" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} onKeyDown={handleKeyDown} placeholder="e.g. React" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: "120px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: colors.textMuted, marginBottom: "6px" }}>Location</label>
              <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} onKeyDown={handleKeyDown} placeholder="e.g. Toronto" style={inputStyle} />
            </div>
          </div>
          <button
            onClick={handleSearch}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "12px 28px", borderRadius: "12px", border: "none",
              background: colors.accent, color: "#000", fontWeight: 700,
              fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            <Search size={16} /> Search Candidates
          </button>
        </div>

        {/* Results */}
        {hasSearched && results.length === 0 && (
          <div style={{ ...glassSurface, borderRadius: "20px", padding: "60px 24px", textAlign: "center" }}>
            <User size={48} color={colors.textMuted} style={{ marginBottom: "16px" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>No Candidates Found</h3>
            <p style={{ color: colors.textSecondary, margin: 0, fontSize: "0.9rem" }}>
              Try adjusting your search terms. Currently searching local resume data only.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ fontSize: "0.85rem", color: colors.textMuted, marginBottom: "16px" }}>
              {results.length} candidate{results.length !== 1 ? "s" : ""} found
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {results.map((resume, idx) => (
                <div
                  key={`${resume.userId}-${idx}`}
                  style={{
                    ...glassCard,
                    padding: "20px 24px",
                    display: "flex",
                    gap: "16px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <User size={24} color={colors.textMuted} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
                      {resume.fullName || "Anonymous Candidate"}
                    </h3>

                    <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: colors.textMuted, flexWrap: "wrap", marginBottom: "8px" }}>
                      {resume.location && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={12} /> {resume.location}
                        </span>
                      )}
                      {resume.experience && resume.experience.length > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Briefcase size={12} /> {resume.experience.length} role{resume.experience.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {resume.certifications && resume.certifications.length > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Award size={12} /> {resume.certifications.length} cert{resume.certifications.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Summary */}
                    {resume.summary && (
                      <p style={{ fontSize: "0.8rem", color: colors.textSecondary, margin: "0 0 10px", lineHeight: 1.5 }}>
                        {resume.summary.length > 200 ? `${resume.summary.slice(0, 200)}...` : resume.summary}
                      </p>
                    )}

                    {/* Experience highlights */}
                    {resume.experience && resume.experience.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginBottom: "8px" }}>
                        <strong>Latest:</strong> {resume.experience[0].title} at {resume.experience[0].company}
                      </div>
                    )}

                    {/* Skills */}
                    {resume.skills && resume.skills.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {resume.skills.slice(0, 8).map((skill) => (
                          <span
                            key={skill}
                            style={{
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              background: isDark ? "rgba(255,214,0,0.1)" : "rgba(255,214,0,0.15)",
                              color: isDark ? "#FFD600" : "#B8960F",
                              border: "1px solid rgba(255,214,0,0.2)",
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                        {resume.skills.length > 8 && (
                          <span style={{ fontSize: "0.7rem", color: colors.textMuted, alignSelf: "center" }}>
                            +{resume.skills.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
