import { useState, useEffect, useCallback, useMemo } from "react";
import { isDirectory } from '~/config/appVariant';
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
  Search,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Filter,
  X,
  Grid3X3,
  LayoutList,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Users,
  Briefcase,
  Globe,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useResponsive } from '../hooks/useResponsive';
import { getAcademyStreetProfiles, hydrateStreetProfileRecord, mergeStreetProfiles } from "./academyStreetProfiles";
import { ensureStreetProfilesForActiveAcademyUsers, listCmsDirectoryStreetProfiles } from "./academyProfileSync";
import { getStreetProfileAvatarUrl } from "./profileAvatarResolver";

// =============================================================================
// Types
// =============================================================================

type StreetProfile = {
  id: string;
  username: string;
  display_name: string;
  primary_roles: string[];
  tagline?: string;
  avatar_url?: string;
  city?: string;
  country?: string;
  location_display?: string;
  availability_status: string;
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
};

type FilterState = {
  search: string;
  roles: string[];
  city: string;
  availability: string;
};

// =============================================================================
// Filter Options
// =============================================================================

const ROLE_OPTIONS = [
  "Instructor",
  "Student",
  "Facilitator",
  "Community Learner",
  "Visual Artist",
  "Muralist",
  "Illustrator",
  "Photographer",
  "Videographer",
  "DJ",
  "Music Producer",
  "Sound Designer",
  "UI/UX Designer",
  "Brand Designer",
  "Graphic Designer",
  "Motion Designer",
  "3D Artist",
  "Creative Developer",
  "Writer",
  "Journalist",
  "Architect",
  "Filmmaker",
];

const ROLE_CATEGORIES: Record<string, string[]> = {
  Academy: ["Instructor", "Student", "Facilitator", "Community Learner"],
  Visual: ["Visual Artist", "Muralist", "Illustrator", "Photographer", "Videographer", "Filmmaker"],
  Audio: ["DJ", "Music Producer", "Sound Designer"],
  Design: ["UI/UX Designer", "Brand Designer", "Graphic Designer", "Motion Designer", "3D Artist"],
  Tech: ["Creative Developer", "Writer", "Journalist", "Architect"],
};

const CITY_OPTIONS = [
  "Toronto",
  "Vancouver",
  "Montreal",
  "Los Angeles",
  "New York",
  "Berlin",
  "London",
  "Seoul",
];

const AVAILABILITY_OPTIONS = [
  { value: "open", label: "Open to work" },
  { value: "busy", label: "Currently busy" },
];

function matchesFilters(profile: StreetProfile, searchTerm: string, filters: FilterState) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  if (normalizedSearch) {
    const searchable = [
      profile.display_name,
      profile.username,
      profile.tagline || "",
      profile.location_display || "",
      ...(profile.primary_roles || []),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchable.includes(normalizedSearch)) {
      return false;
    }
  }

  if (filters.roles.length > 0 && !filters.roles.some((role) => profile.primary_roles.includes(role))) {
    return false;
  }

  if (filters.city) {
    const location = [profile.city || "", profile.location_display || "", profile.country || ""].join(" ").toLowerCase();
    if (!location.includes(filters.city.toLowerCase())) {
      return false;
    }
  }

  if (filters.availability && profile.availability_status !== filters.availability) {
    return false;
  }

  return true;
}

// =============================================================================
// Component
// =============================================================================

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isDark, colors: sharedColors, glassCard, glassSurface, glassButton, accentButton, glassTag, cardHoverHandlers, accentButtonHoverHandlers, gradientOrbs } = useGlassStyles();
  const { isMobile } = useResponsive();

  // State
  const [profiles, setProfiles] = useState<StreetProfile[]>([]);
  const [featuredProfiles, setFeaturedProfiles] = useState<StreetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 250);
  const [savedProfiles, setSavedProfiles] = useState<Set<string>>(new Set());
  const [isGridView, setIsGridView] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["roles", "city"])
  );
  const [stats, setStats] = useState({ total_profiles: 0, available_count: 0 });

  // Create Profile modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    display_name: "",
    username: "",
    role: "",
    bio: "",
    city: "",
    avatar: "" as string,
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    roles: [],
    city: "",
    availability: "",
  });

  // Extend shared colors with page-specific profile colors
  const colors = useMemo(
    () => ({
      ...sharedColors,
      accentText: isDark ? "#FFD600" : "#000",
      accentDark: "#E6C200",
      glassGlow: isDark
        ? "0 0 0 1px rgba(255, 255, 255, 0.1)"
        : "0 0 0 1px rgba(255, 255, 255, 0.4)",
    }),
    [sharedColors, isDark]
  );

  // Load profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append("q", debouncedSearchTerm);
      if (filters.roles.length > 0) params.append("roles", filters.roles.join(","));
      if (filters.city) params.append("city", filters.city);
      if (filters.availability) params.append("availability", filters.availability);

      const url = `${SB_API_BASE}/street-profiles/directory${params.toString() ? `?${params.toString()}` : ""}`;
      const seededAcademyProfiles = getAcademyStreetProfiles().filter((profile) =>
        matchesFilters(profile, debouncedSearchTerm, filters),
      ) as StreetProfile[];
      await ensureStreetProfilesForActiveAcademyUsers().catch(() => []);
      const [response, cmsProfiles] = await Promise.all([
        fetch(url),
        listCmsDirectoryStreetProfiles().catch(() => []),
      ]);
      const cmsAcademyProfiles = cmsProfiles
        .map((profile) => hydrateStreetProfileRecord(profile as any) as StreetProfile)
        .filter((profile) => matchesFilters(profile, debouncedSearchTerm, filters));
      const academyProfiles = mergeStreetProfiles(cmsAcademyProfiles, seededAcademyProfiles);

      if (response.ok) {
        const data = await response.json();
        setProfiles(mergeStreetProfiles(Array.isArray(data) ? data : [], academyProfiles));
      } else {
        setProfiles(academyProfiles);
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
      setProfiles(
        getAcademyStreetProfiles().filter((profile) => matchesFilters(profile, debouncedSearchTerm, filters)) as StreetProfile[],
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, filters]);

  // Load featured profiles
  const loadFeatured = useCallback(async () => {
    try {
      const response = await fetch(`${SB_API_BASE}/street-profiles/featured?limit=5`);
      const academyFeatured = getAcademyStreetProfiles().filter((profile) => profile.is_featured) as StreetProfile[];
      if (response.ok) {
        const data = await response.json();
        setFeaturedProfiles(mergeStreetProfiles(Array.isArray(data) ? data : [], academyFeatured));
      } else {
        setFeaturedProfiles(academyFeatured);
      }
    } catch (error) {
      console.error("Failed to load featured profiles:", error);
      setFeaturedProfiles(getAcademyStreetProfiles().filter((profile) => profile.is_featured) as StreetProfile[]);
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${SB_API_BASE}/street-profiles/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    loadFeatured();
    loadStats();
  }, [loadFeatured, loadStats]);

  // Handlers
  const toggleSave = (id: string) => {
    setSavedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleRole = (role: string) => {
    setFilters((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const clearFilters = () => {
    setFilters({ search: "", roles: [], city: "", availability: "" });
    setSearchTerm("");
  };

  const hasActiveFilters =
    filters.roles.length > 0 || filters.city !== "" || filters.availability !== "";

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <GlassBackground />

      {/* Hero Section - Enhanced with glass effect */}
      <section
        style={{
          background: "transparent",
          padding: isMobile ? "32px 16px 24px" : "60px 24px 48px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto", textAlign: "center" }}>
          {/* Hero Text */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "999px",
              background: "rgba(255, 214, 0, 0.1)",
              border: "1px solid rgba(255, 214, 0, 0.3)",
              marginBottom: "24px",
            }}
          >
            <Sparkles size={14} color={colors.accent} />
            <span style={{ fontSize: "13px", color: colors.accentText, fontWeight: 500 }}>
              Street Profile Directory
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
              fontWeight: 800,
              color: colors.accent,
              marginBottom: "16px",
              lineHeight: 1.1,
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Discover Creatives
          </h1>

          <p
            style={{
              fontSize: "1.2rem",
              color: colors.textSecondary,
              marginBottom: "24px",
              maxWidth: "600px",
              margin: "0 auto 24px",
              lineHeight: 1.6,
            }}
          >
            Connect with artists, designers, musicians, and creators.
            Find talent for your next project or discover inspiring work.
          </p>

          {/* CTA Button — opens create profile modal */}
          <button
            onClick={() => { setShowCreateModal(true); setCreateStep(1); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "999px",
              background: "#FFD700",
              color: "#000",
              fontSize: "0.9rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "24px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)"; }}
          >
            Create Your Street Profile
          </button>

          {/* Search Bar — Full width, below CTA */}
          <div style={{ maxWidth: "900px", margin: "0 auto", width: "100%", padding: "0 16px" }}>
            <div style={{ display: "flex", gap: 0 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <div
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                  }}
                >
                  <Search size={20} color={colors.textMuted} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadProfiles()}
                  placeholder="Search by name, role, or skill..."
                  style={{
                    width: "100%",
                    height: "54px",
                    paddingLeft: "48px",
                    paddingRight: "16px",
                    background: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.95)",
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "14px 0 0 14px",
                    fontSize: "16px",
                    outline: "none",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                />
              </div>
              <button
                onClick={loadProfiles}
                style={{
                  height: "54px",
                  padding: "0 28px",
                  background: colors.accent,
                  color: "#000",
                  border: "none",
                  borderRadius: "0 14px 14px 0",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "15px",
                  boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)";
                }}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div style={{ margin: "0 auto", padding: "0" }}>
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <p style={{ fontSize: "1rem", color: colors.textSecondary }}>
              <span style={{ fontWeight: 600, color: colors.text }}>{profiles.length}</span> profiles
            </p>

            {/* Filter Toggle - Desktop */}
            <button
              onClick={() => isMobile ? setIsMobileFilterOpen(!isMobileFilterOpen) : setIsFilterOpen(!isFilterOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                background: colors.surface,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                border: `1px solid ${colors.border}`,
                borderRadius: "14px",
                boxShadow: colors.glassShadow,
                fontSize: "14px",
                fontWeight: 500,
                color: colors.text,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Filter size={16} />
              {isMobile ? "Filters" : (isFilterOpen ? "Hide Filters" : "Show Filters")}
              {hasActiveFilters && (
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: colors.accent,
                    color: "#000",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {filters.roles.length + (filters.city ? 1 : 0) + (filters.availability ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* View Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: colors.surface,
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              padding: "5px",
              borderRadius: "16px",
              border: `1px solid ${colors.border}`,
              boxShadow: colors.glassShadow,
            }}
          >
            <button
              onClick={() => setIsGridView(true)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: isGridView ? colors.accent : "transparent",
                color: isGridView ? "#000" : colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setIsGridView(false)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: !isGridView ? colors.accent : "transparent",
                color: !isGridView ? "#000" : colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <LayoutList size={16} />
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div style={{ display: "flex", gap: isMobile ? "0" : "32px" }}>
          {/* Filter Sidebar - TRUE GLASSMORPHISM */}
          {(isMobile ? isMobileFilterOpen : isFilterOpen) && (
            <>
              {/* Mobile overlay backdrop */}
              {isMobile && (
                <div
                  onClick={() => setIsMobileFilterOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.5)",
                    zIndex: 998,
                  }}
                />
              )}
            <aside
              style={{
                ...(isMobile
                  ? {
                      position: "fixed" as const,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: "300px",
                      maxWidth: "85vw",
                      zIndex: 999,
                      overflowY: "auto" as const,
                      borderRadius: "24px 0 0 24px",
                    }
                  : {
                      width: "280px",
                      flexShrink: 0,
                      height: "fit-content",
                      position: "sticky" as const,
                      top: "24px",
                      borderRadius: "24px",
                    }),
                background: colors.surface,
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: `1px solid ${colors.border}`,
                boxShadow: colors.glassShadow,
              }}
            >
              <div style={{ padding: "20px", borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>Filters</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      style={{
                        background: "none",
                        border: "none",
                        color: colors.accentText,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Clear all
                    </button>
                  )}
                  {isMobile && (
                    <button
                      onClick={() => setIsMobileFilterOpen(false)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <X size={18} color={colors.textSecondary} />
                    </button>
                  )}
                  </div>
                </div>
              </div>

              <div style={{ padding: "20px", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
                {/* Roles */}
                <div style={{ marginBottom: "24px" }}>
                  <button
                    onClick={() => toggleSection("roles")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
                      Creative Role
                      {filters.roles.length > 0 && (
                        <span
                          style={{
                            marginLeft: "8px",
                            padding: "2px 8px",
                            background: `rgba(255, 214, 0, 0.2)`,
                            borderRadius: "10px",
                            fontSize: "12px",
                            color: colors.accentText,
                          }}
                        >
                          {filters.roles.length}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      size={16}
                      color={colors.textSecondary}
                      style={{
                        transform: expandedSections.has("roles") ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                  {expandedSections.has("roles") && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Object.entries(ROLE_CATEGORIES).map(([category, roles]) => (
                        <div key={category}>
                          <button
                            onClick={() => toggleSection(`role-${category}`)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              width: "100%",
                              padding: "6px 10px",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span style={{ fontSize: "13px", fontWeight: 600, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {category}
                              {roles.filter((r) => filters.roles.includes(r)).length > 0 && (
                                <span style={{ marginLeft: "6px", padding: "1px 6px", background: "rgba(255, 214, 0, 0.2)", borderRadius: "8px", fontSize: "11px", color: colors.accentText }}>
                                  {roles.filter((r) => filters.roles.includes(r)).length}
                                </span>
                              )}
                            </span>
                            <ChevronDown
                              size={14}
                              color={colors.textMuted}
                              style={{ transform: expandedSections.has(`role-${category}`) ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                            />
                          </button>
                          {expandedSections.has(`role-${category}`) && (
                            <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "4px" }}>
                              {roles.map((role) => (
                                <label
                                  key={role}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    cursor: "pointer",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    background: filters.roles.includes(role) ? "rgba(255, 214, 0, 0.1)" : "transparent",
                                    transition: "background 0.2s",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={filters.roles.includes(role)}
                                    onChange={() => toggleRole(role)}
                                    style={{ accentColor: colors.accent, width: 16, height: 16 }}
                                  />
                                  <span style={{ fontSize: "14px", color: colors.text }}>{role}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* City */}
                <div style={{ marginBottom: "24px" }}>
                  <button
                    onClick={() => toggleSection("city")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Location</span>
                    <ChevronDown
                      size={16}
                      color={colors.textSecondary}
                      style={{
                        transform: expandedSections.has("city") ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                  {expandedSections.has("city") && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {CITY_OPTIONS.map((city) => (
                        <label
                          key={city}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: filters.city === city ? `rgba(255, 214, 0, 0.1)` : "transparent",
                          }}
                        >
                          <input
                            type="radio"
                            name="city"
                            checked={filters.city === city}
                            onChange={() => setFilters((prev) => ({ ...prev, city }))}
                            style={{ accentColor: colors.accent, width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: "14px", color: colors.text }}>{city}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Availability */}
                <div>
                  <button
                    onClick={() => toggleSection("availability")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Availability</span>
                    <ChevronDown
                      size={16}
                      color={colors.textSecondary}
                      style={{
                        transform: expandedSections.has("availability") ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                  {expandedSections.has("availability") && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background:
                              filters.availability === opt.value ? `rgba(255, 214, 0, 0.1)` : "transparent",
                          }}
                        >
                          <input
                            type="radio"
                            name="availability"
                            checked={filters.availability === opt.value}
                            onChange={() => setFilters((prev) => ({ ...prev, availability: opt.value }))}
                            style={{ accentColor: colors.accent, width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: "14px", color: colors.text }}>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
            </>
          )}

          {/* Profile Grid/List */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: colors.textSecondary }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: `3px solid ${colors.border}`,
                    borderTopColor: colors.accent,
                    borderRadius: "50%",
                    margin: "0 auto 16px",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Loading profiles...
              </div>
            ) : profiles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <Users size={56} color={colors.textMuted} style={{ marginBottom: "16px" }} />
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
                  No profiles found
                </h3>
                <p style={{ color: colors.textSecondary, marginBottom: "16px" }}>Try adjusting your filters or search terms</p>
                <button
                  onClick={() => { setShowCreateModal(true); setCreateStep(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 20px",
                    borderRadius: "999px",
                    background: colors.accent,
                    color: "#000",
                    fontWeight: "bold",
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Be the first — Create Your Street Profile
                </button>
              </div>
            ) : isGridView ? (
              // Grid View
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: isMobile ? "16px" : "24px",
                }}
              >
                {profiles.map((profile) => {
                  const avatarUrl = getStreetProfileAvatarUrl(profile);

                  return (
                  <div
                    key={profile.id}
                    onClick={() => navigate(`/creatives/${profile.username}`)}
                    style={{
                      background: colors.cardBg,
                      backdropFilter: "blur(24px) saturate(180%)",
                      WebkitBackdropFilter: "blur(24px) saturate(180%)",
                      borderRadius: "24px",
                      border: `1px solid ${colors.border}`,
                      boxShadow: colors.glassShadow,
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                      height: "450px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderHover;
                      e.currentTarget.style.transform = "translateY(-8px)";
                      e.currentTarget.style.background = colors.surfaceHover;
                      e.currentTarget.style.boxShadow = isDark
                        ? "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)"
                        : "0 20px 40px rgba(31, 38, 135, 0.2)";
                      const overlay = e.currentTarget.querySelector<HTMLDivElement>(".sv-hover-overlay");
                      if (overlay) { overlay.style.opacity = "1"; overlay.style.transform = "translateY(0)"; }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.background = colors.cardBg;
                      e.currentTarget.style.boxShadow = colors.glassShadow;
                      const overlay = e.currentTarget.querySelector<HTMLDivElement>(".sv-hover-overlay");
                      if (overlay) { overlay.style.opacity = "0"; overlay.style.transform = "translateY(12px)"; }
                    }}
                  >
                    {/* Top Half: Image */}
                    <div style={{ height: "50%", position: "relative", width: "100%" }}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={profile.display_name}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8800 100%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "80px",
                            fontWeight: 800,
                            color: "rgba(0,0,0,0.1)",
                          }}
                        >
                          {profile.display_name.charAt(0)}
                        </div>
                      )}

                      {/* Save Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(profile.id);
                        }}
                        style={{
                          position: "absolute",
                          top: "16px",
                          right: "16px",
                          zIndex: 10,
                          padding: "8px",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          cursor: "pointer",
                          backdropFilter: "blur(8px)",
                          color: "#fff",
                        }}
                      >
                        {savedProfiles.has(profile.id) ? (
                          <BookmarkCheck size={18} color={colors.accent} fill={colors.accent} />
                        ) : (
                          <Bookmark size={18} color="#fff" />
                        )}
                      </button>

                      {/* Featured Badge */}
                      {profile.is_featured && (
                        <div
                          style={{
                            position: "absolute",
                            top: "16px",
                            left: "16px",
                            zIndex: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: colors.accent,
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#000",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          }}
                        >
                          <Sparkles size={14} />
                          Featured
                        </div>
                      )}
                    </div>

                    {/* Bottom Half: Info */}
                    <div
                      style={{
                        height: "50%",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        background: colors.cardBg,
                      }}
                    >
                      <div>
                        {/* Name & Verified */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <h3
                            style={{
                              fontSize: "1.25rem",
                              fontWeight: 700,
                              color: colors.text,
                              margin: 0,
                            }}
                          >
                            {profile.display_name}
                          </h3>
                          {profile.is_verified && (
                            <CheckCircle2 size={18} color={colors.accent} fill={colors.accent} />
                          )}
                        </div>

                        {/* Username */}
                        <p
                          style={{
                            fontSize: "14px",
                            color: colors.textSecondary,
                            marginBottom: "12px",
                          }}
                        >
                          @{profile.username}
                        </p>

                        {/* Roles */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            marginBottom: "12px",
                          }}
                        >
                          {profile.primary_roles.slice(0, 3).map((role) => (
                            <span
                              key={role}
                              style={{
                                fontSize: "12px",
                                padding: "4px 10px",
                                borderRadius: "100px",
                                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                color: colors.textSecondary,
                                fontWeight: 500,
                                border: `1px solid ${colors.border}`,
                              }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Footer Stats */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "16px",
                          borderTop: `1px solid ${colors.border}`,
                        }}
                      >
                        {profile.location_display ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "13px",
                              color: colors.textSecondary,
                            }}
                          >
                            <MapPin size={14} />
                            {profile.location_display}
                          </div>
                        ) : (
                          <div /> /* Spacer if no location */
                        )}

                        <div style={{ display: "flex", gap: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "13px",
                              color: colors.textSecondary,
                            }}
                          >
                            <Users size={14} />
                            {formatFollowers(profile.followers_count)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hover Overlay — quick action CTAs */}
                    <div
                      className="sv-hover-overlay"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: "16px",
                        background: isDark
                          ? "linear-gradient(to top, rgba(10,10,20,0.96) 0%, rgba(10,10,20,0.9) 70%, rgba(10,10,20,0) 100%)"
                          : "linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 70%, rgba(255,255,255,0) 100%)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        borderBottomLeftRadius: "24px",
                        borderBottomRightRadius: "24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        opacity: 0,
                        transform: "translateY(12px)",
                        transition: "opacity 0.25s ease-out, transform 0.25s ease-out",
                        pointerEvents: "auto",
                      }}
                    >
                      {/* CTA Buttons */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/messages?to=${encodeURIComponent(profile.username || "")}`);
                          }}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            border: `1px solid ${colors.border}`,
                            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            color: colors.text,
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
                        >
                          <MessageSquare size={14} /> Message
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/creatives/${profile.username}`);
                          }}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            border: "none",
                            background: "#eab308",
                            color: "#000",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#facc15"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#eab308"; }}
                        >
                          View Profile <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            ) : (
              // List View
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {profiles.map((profile) => {
                  const avatarUrl = getStreetProfileAvatarUrl(profile);

                  return (
                  <div
                    key={profile.id}
                    onClick={() => navigate(`/creatives/${profile.username}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      background: colors.cardBg,
                      backdropFilter: "blur(24px) saturate(180%)",
                      WebkitBackdropFilter: "blur(24px) saturate(180%)",
                      borderRadius: "24px",
                      border: `1px solid ${colors.border}`,
                      boxShadow: colors.glassShadow,
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderHover;
                      e.currentTarget.style.background = colors.surfaceHover;
                      e.currentTarget.style.transform = "translateX(8px)";
                      e.currentTarget.style.boxShadow = isDark
                        ? "0 16px 32px rgba(0,0,0,0.35), 0 0 16px rgba(139, 92, 246, 0.1)"
                        : "0 16px 32px rgba(31, 38, 135, 0.18)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.background = colors.cardBg;
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = colors.glassShadow;
                    }}
                  >
                    {/* Avatar */}
                    {avatarUrl ? (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          overflow: "hidden",
                          flexShrink: 0,
                          position: "relative",
                        }}
                      >
                        <img
                          src={avatarUrl}
                          alt={profile.display_name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8800 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "24px",
                          fontWeight: 700,
                          color: "#000",
                          flexShrink: 0,
                        }}
                      >
                        {profile.display_name.charAt(0)}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: colors.text, margin: 0 }}>
                          {profile.display_name}
                        </h3>
                        {profile.is_verified && <CheckCircle2 size={16} color={colors.accent} fill={colors.accent} />}
                        {profile.is_featured && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: `rgba(255, 214, 0, 0.2)`,
                              fontSize: "11px",
                              fontWeight: 600,
                              color: colors.accentText,
                            }}
                          >
                            <Sparkles size={10} />
                            Featured
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "8px" }}>
                        @{profile.username} {profile.location_display && `· ${profile.location_display}`}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {profile.primary_roles.map((role) => (
                          <span
                            key={role}
                            style={{
                              fontSize: "12px",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              color: colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right Side */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                      {profile.availability_status === "open" && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            background: `rgba(34, 197, 94, 0.1)`,
                            fontSize: "13px",
                            color: colors.success,
                            fontWeight: 500,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.success }} />
                          Available
                        </span>
                      )}

                      <div style={{ fontSize: "13px", color: colors.textMuted }}>
                        {formatFollowers(profile.followers_count)} followers
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(profile.id);
                        }}
                        style={{
                          padding: "8px",
                          borderRadius: "8px",
                          background: "transparent",
                          border: `1px solid ${colors.border}`,
                          cursor: "pointer",
                        }}
                      >
                        {savedProfiles.has(profile.id) ? (
                          <BookmarkCheck size={18} color={colors.accent} fill={colors.accent} />
                        ) : (
                          <Bookmark size={18} color={colors.textSecondary} />
                        )}
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Street Profile Modal */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "rgba(20,20,30,0.98)" : "#fff",
              borderRadius: "20px",
              padding: "32px",
              width: "100%", maxWidth: "540px", maxHeight: "90vh", overflowY: "auto",
              border: `1px solid ${colors.border}`,
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "4px 10px", borderRadius: "100px",
                  background: "rgba(255,215,0,0.15)", color: "#FFD700",
                  fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                  marginBottom: "10px",
                }}>
                  <Sparkles size={12} /> Step {createStep} of 3
                </div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: colors.text }}>
                  {createStep === 1 ? "Create your Street Profile" : createStep === 2 ? "Tell us about you" : "Almost done!"}
                </h2>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: colors.textSecondary }}>
                  {createStep === 1
                    ? "Your public identity on Street Voices."
                    : createStep === 2
                    ? "Add a few details so people can find you."
                    : "Add a photo and a short bio — you can change all of this later."}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress dots */}
            <div style={{ display: "flex", gap: "6px", margin: "18px 0 22px" }}>
              {[1, 2, 3].map((s) => (
                <div key={s} style={{
                  flex: 1, height: "4px", borderRadius: "100px",
                  background: s <= createStep ? "#FFD700" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"),
                  transition: "background 0.2s",
                }} />
              ))}
            </div>

            {/* Step 1: Display name + username */}
            {createStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "6px", display: "block" }}>
                    Display name *
                  </label>
                  <input
                    autoFocus
                    value={createForm.display_name}
                    onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value, username: createForm.username || e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) })}
                    placeholder="e.g. Jane Doe or Ghost"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${colors.border}`, color: colors.text,
                      fontSize: "14px", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "6px", display: "block" }}>
                    Username *
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "0 14px" }}>
                    <span style={{ color: colors.textSecondary, fontSize: "14px" }}>@</span>
                    <input
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) })}
                      placeholder="your_handle"
                      style={{
                        width: "100%", padding: "12px 0",
                        background: "transparent", border: "none", color: colors.text,
                        fontSize: "14px", outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "11px", color: colors.textSecondary, marginTop: "6px" }}>
                    This is your profile URL: /creatives/{createForm.username || "your_handle"}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Role + City */}
            {createStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "6px", display: "block" }}>
                    What do you do? *
                  </label>
                  <input
                    autoFocus
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    placeholder="e.g. Photographer, Muralist, Music Producer"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${colors.border}`, color: colors.text,
                      fontSize: "14px", outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                    {["Photographer", "Visual Artist", "Muralist", "Music Producer", "Designer", "Videographer", "Writer", "Filmmaker"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setCreateForm({ ...createForm, role: r })}
                        style={{
                          fontSize: "12px", padding: "5px 12px", borderRadius: "100px",
                          background: createForm.role === r ? "#FFD700" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                          color: createForm.role === r ? "#000" : colors.textSecondary,
                          border: `1px solid ${createForm.role === r ? "#FFD700" : colors.border}`,
                          cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "6px", display: "block" }}>
                    Location
                  </label>
                  <input
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder="e.g. Toronto, Canada"
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${colors.border}`, color: colors.text,
                      fontSize: "14px", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Avatar + Bio */}
            {createStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "8px", display: "block" }}>
                    Profile photo
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{
                      width: "72px", height: "72px", borderRadius: "50%", overflow: "hidden",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `2px dashed ${colors.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {createForm.avatar ? (
                        <img src={createForm.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Users size={26} color={colors.textSecondary} />
                      )}
                    </div>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "8px 14px", borderRadius: "10px", cursor: "pointer",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${colors.border}`,
                      color: colors.text, fontSize: "13px", fontWeight: 600,
                    }}>
                      <input
                        type="file" accept="image/*" style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => setCreateForm({ ...createForm, avatar: reader.result as string });
                          reader.readAsDataURL(file);
                        }}
                      />
                      Upload photo
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: colors.text, marginBottom: "6px", display: "block" }}>
                    Short bio
                  </label>
                  <textarea
                    value={createForm.bio}
                    onChange={(e) => setCreateForm({ ...createForm, bio: e.target.value.slice(0, 280) })}
                    placeholder="Tell people who you are and what you create..."
                    rows={4}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: "10px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${colors.border}`, color: colors.text,
                      fontSize: "14px", fontFamily: "inherit", lineHeight: 1.5,
                      resize: "vertical", outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: "11px", color: colors.textSecondary, marginTop: "4px", textAlign: "right" }}>
                    {createForm.bio.length}/280
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", gap: "10px" }}>
              {createStep > 1 ? (
                <button
                  onClick={() => setCreateStep(createStep - 1)}
                  style={{
                    padding: "10px 18px", borderRadius: "10px",
                    background: "transparent", border: `1px solid ${colors.border}`,
                    color: colors.text, fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Back
                </button>
              ) : <div />}
              {createStep < 3 ? (
                <button
                  onClick={() => setCreateStep(createStep + 1)}
                  disabled={
                    (createStep === 1 && (!createForm.display_name.trim() || !createForm.username.trim())) ||
                    (createStep === 2 && !createForm.role.trim())
                  }
                  style={{
                    padding: "10px 22px", borderRadius: "10px", border: "none",
                    background:
                      (createStep === 1 && (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")
                        : "#FFD700",
                    color:
                      (createStep === 1 && (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? colors.textSecondary
                        : "#000",
                    fontSize: "13px", fontWeight: 700,
                    cursor:
                      (createStep === 1 && (!createForm.display_name.trim() || !createForm.username.trim())) ||
                      (createStep === 2 && !createForm.role.trim())
                        ? "not-allowed"
                        : "pointer",
                    display: "inline-flex", alignItems: "center", gap: "6px",
                  }}
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  disabled={createSubmitting}
                  onClick={() => {
                    setCreateSubmitting(true);
                    try {
                      // Save draft to localStorage so the Street Profile page can pick it up
                      localStorage.setItem("sv_new_profile_draft", JSON.stringify({
                        ...createForm,
                        created_at: new Date().toISOString(),
                      }));
                    } catch {}
                    setTimeout(() => {
                      setCreateSubmitting(false);
                      setShowCreateModal(false);
                      navigate("/settings");
                    }, 600);
                  }}
                  style={{
                    padding: "10px 22px", borderRadius: "10px", border: "none",
                    background: "#FFD700", color: "#000",
                    fontSize: "13px", fontWeight: 700, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {createSubmitting ? "Creating..." : (<>Create Profile <Sparkles size={14} /></>)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
