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
} from "lucide-react";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useResponsive } from '../hooks/useResponsive';

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
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setProfiles(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, filters]);

  // Load featured profiles
  const loadFeatured = useCallback(async () => {
    try {
      const response = await fetch(`${SB_API_BASE}/street-profiles/featured?limit=5`);
      if (response.ok) {
        const data = await response.json();
        setFeaturedProfiles(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load featured profiles:", error);
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

          {/* CTA Button — Gallery-style */}
          <a
            href="/social/signup"
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
              textDecoration: "none",
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
          </a>

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
                <a
                  href="/social/signup"
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
                    textDecoration: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Be the first — Create Your Street Profile
                </a>
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
                {profiles.map((profile) => (
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
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.background = colors.cardBg;
                      e.currentTarget.style.boxShadow = colors.glassShadow;
                    }}
                  >
                    {/* Top Half: Image */}
                    <div style={{ height: "50%", position: "relative", width: "100%" }}>
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
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
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {profiles.map((profile) => (
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
                    {profile.avatar_url ? (
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
                          src={profile.avatar_url}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
