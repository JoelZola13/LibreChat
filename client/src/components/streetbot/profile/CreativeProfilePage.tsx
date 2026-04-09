import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { useResponsive } from "../hooks/useResponsive";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Sparkles,
  Users,
  Bookmark,
  BookmarkCheck,
  Globe,
  Mail,
  ExternalLink,
  Briefcase,
  Calendar,
  Eye,
  TrendingUp,
  Wrench,
  MessageSquare,
  CheckSquare,
  FileText,
  Info,
  HardDrive,
  Share2,
  Contact,
  Activity,
  Settings,
  Search,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  Image,
  Upload,
  X,
  ZoomIn,
  Heart,
  Download,
  Camera,
  Grid,
  Layers,
  Plus,
  Home,
  User,
  MessageCircle,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type StreetProfile = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  primary_roles: string[];
  secondary_skills: string[];
  bio: string;
  tagline: string;
  avatar_url: string | null;
  cover_url: string | null;
  city: string;
  country: string;
  location_display: string;
  portfolio_items: any[];
  external_links: any[];
  website: string | null;
  availability_status: string;
  open_to: string[];
  contact_email: string | null;
  contact_preference: string;
  is_public: boolean;
  is_featured: boolean;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  saves_count: number;
  profile_views: number;
  completeness_score: number;
  created_at: string;
  updated_at: string;
};

type TabId =
  | "news"
  | "portfolio"
  | "services"
  | "messages"
  | "tasks"
  | "calendar"
  | "documents"
  | "about"
  | "storage"
  | "social-media"
  | "activity"
  | "street-gallery"
  | "jobs"
  | "settings";

type TabDef = {
  id: TabId;
  label: string;
  icon: React.ReactNode;
};

// =============================================================================
// Helpers
// =============================================================================

function formatFollowers(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function getAvailabilityInfo(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "open":
      return { label: "Open to Work", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" };
    case "busy":
      return { label: "Currently Busy", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" };
    case "unavailable":
      return { label: "Not Available", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" };
    default:
      return { label: status, color: "#999", bg: "rgba(153, 153, 153, 0.15)" };
  }
}

// =============================================================================
// Tab Definitions
// =============================================================================

const TABS: TabDef[] = [
  { id: "about", label: "About", icon: <Info size={16} /> },
  { id: "news", label: "News", icon: <TrendingUp size={16} /> },
  { id: "services", label: "Services", icon: <Wrench size={16} /> },
  { id: "messages", label: "Messages", icon: <MessageSquare size={16} /> },
  { id: "tasks", label: "Tasks", icon: <CheckSquare size={16} /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
  { id: "documents", label: "Documents", icon: <FileText size={16} /> },
  { id: "storage", label: "Storage", icon: <HardDrive size={16} /> },
  { id: "social-media", label: "Social Media", icon: <Share2 size={16} /> },
  { id: "activity", label: "Activity", icon: <Activity size={16} /> },
  { id: "street-gallery", label: "Street Gallery", icon: <Image size={16} /> },
  { id: "jobs", label: "Jobs", icon: <Briefcase size={16} /> },
  { id: "settings", label: "", icon: <Settings size={16} /> },
];

// =============================================================================
// Global Search Bar
// =============================================================================

function GlobalSearchBar({ colors, isDark, navigate }: { colors: any; isDark: boolean; navigate: any }) {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <form onSubmit={handleSearch} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 14px",
          height: "42px",
          minWidth: "220px",
          maxWidth: "320px",
          borderRadius: "12px",
          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          border: `1px solid ${colors.border}`,
          backdropFilter: "blur(12px)",
          transition: "all 0.2s",
        }}
      >
        <Search size={16} style={{ color: colors.textSecondary, flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Street Voices..."
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: colors.text,
            fontSize: "14px",
            fontFamily: "inherit",
          }}
        />
      </div>
    </form>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function CreativeProfilePage({ initialProfile }: { initialProfile?: StreetProfile }) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { isDark, colors: sharedColors } = useGlassStyles();
  const { isMobile } = useResponsive();

  const [profile, setProfile] = useState<StreetProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("about");

  const tabScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const colors = useMemo(
    () => ({
      ...sharedColors,
      accentText: isDark ? "#FFD600" : "#000",
    }),
    [sharedColors, isDark]
  );

  useEffect(() => {
    // Skip API fetch if we have an initialProfile
    if (initialProfile) return;
    if (!username) return;
    setLoading(true);
    setError(null);

    fetch(`${SB_API_BASE}/street-profiles/${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Profile not found (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [username, initialProfile]);

  // Check scroll state for tab arrows
  useEffect(() => {
    const el = tabScrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    };
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [profile]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = tabScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            color: colors.textSecondary,
            fontSize: "16px",
            position: "relative",
            zIndex: 1,
          }}
        >
          Loading profile...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <GlassBackground />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <p style={{ color: colors.textSecondary, fontSize: "16px" }}>
            {error || "Profile not found"}
          </p>
          <button
            onClick={() => navigate("/profile")}
            style={{
              padding: "10px 24px",
              borderRadius: "12px",
              background: colors.accent,
              color: "#000",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  const availability = getAvailabilityInfo(profile.availability_status);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <GlassBackground />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: isMobile ? "16px" : "32px",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {/* Top Navigation Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            {/* Back Button */}
            <button
              onClick={() => navigate("/profile")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${colors.border}`,
                color: colors.text,
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                backdropFilter: "blur(12px)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)";
              }}
            >
              <ArrowLeft size={18} />
              Back to Directory
            </button>

            {/* Global Nav Icons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Home */}
              <button
                onClick={() => navigate("/")}
                title="Home"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${colors.border}`,
                  color: colors.textSecondary,
                  cursor: "pointer",
                  backdropFilter: "blur(12px)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
                  e.currentTarget.style.color = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <Home size={20} />
              </button>

              {/* Global Search Bar */}
              <GlobalSearchBar colors={colors} isDark={isDark} navigate={navigate} />

              {/* My Street Profile */}
              <button
                onClick={() => navigate("/settings")}
                title="My Street Profile"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: colors.accent,
                  border: "none",
                  color: "#000",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: `0 2px 8px ${colors.accent}40`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent}60`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40`;
                }}
              >
                <User size={20} />
              </button>
            </div>
          </div>

          {/* Street Profile Title */}
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: colors.accent,
              fontStyle: "italic",
              margin: "0 0 20px 0",
              letterSpacing: "-0.5px",
            }}
          >
            Street Profile
          </h1>

          {/* Cover / Hero Section */}
          <div
            style={{
              borderRadius: "24px",
              overflow: "hidden",
              background: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.7)",
              border: `1px solid ${colors.border}`,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.4)"
                : "0 8px 32px rgba(31,38,135,0.15)",
            }}
          >
            {/* Cover Image */}
            <div
              style={{
                width: "100%",
                height: isMobile ? "160px" : "220px",
                position: "relative",
                background: profile.cover_url
                  ? `url(${profile.cover_url}) center/cover`
                  : `linear-gradient(135deg, ${colors.accent} 0%, #7c3aed 50%, #2563eb 100%)`,
              }}
            >
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
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: colors.accent,
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#000",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  <Sparkles size={14} />
                  Featured Creative
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={() => setIsSaved(!isSaved)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  padding: "10px",
                  borderRadius: "12px",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                }}
              >
                {isSaved ? (
                  <BookmarkCheck size={20} color={colors.accent} fill={colors.accent} />
                ) : (
                  <Bookmark size={20} color="#fff" />
                )}
              </button>
            </div>

            {/* Profile Info Section */}
            <div
              style={{
                padding: isMobile ? "20px" : "32px",
                position: "relative",
              }}
            >
              {/* Avatar - overlapping the cover */}
              <div
                style={{
                  position: "absolute",
                  top: isMobile ? "-50px" : "-60px",
                  left: isMobile ? "20px" : "32px",
                  width: isMobile ? "100px" : "120px",
                  height: isMobile ? "100px" : "120px",
                  borderRadius: "24px",
                  overflow: "hidden",
                  border: `4px solid ${isDark ? "#1a1a2e" : "#fff"}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    style={{
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
                      fontSize: "48px",
                      fontWeight: 800,
                      color: "rgba(0,0,0,0.15)",
                    }}
                  >
                    {profile.display_name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Name & Info - offset for avatar */}
              <div style={{ marginTop: isMobile ? "60px" : "70px" }}>
                {/* Name Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    flexDirection: isMobile ? "column" : "row",
                    gap: isMobile ? "12px" : "16px",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h1
                      style={{
                        fontSize: isMobile ? "1.75rem" : "2rem",
                        fontWeight: 800,
                        color: colors.text,
                        margin: 0,
                      }}
                    >
                      {profile.display_name}
                    </h1>
                    {profile.is_verified && (
                      <CheckCircle2 size={24} color={colors.accent} fill={colors.accent} />
                    )}
                  </div>

                  {/* Availability Badge */}
                  <span
                    style={{
                      padding: "6px 14px",
                      borderRadius: "100px",
                      background: availability.bg,
                      color: availability.color,
                      fontSize: "13px",
                      fontWeight: 600,
                      border: `1px solid ${availability.color}30`,
                    }}
                  >
                    {availability.label}
                  </span>
                </div>

                {/* Username */}
                <p
                  style={{
                    fontSize: "16px",
                    color: colors.textSecondary,
                    marginBottom: "12px",
                  }}
                >
                  @{profile.username}
                </p>

                {/* Tagline */}
                {profile.tagline && (
                  <p
                    style={{
                      fontSize: "18px",
                      fontStyle: "italic",
                      color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                      marginBottom: "20px",
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;{profile.tagline}&rdquo;
                  </p>
                )}

                {/* Roles */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "24px",
                  }}
                >
                  {profile.primary_roles.map((role) => (
                    <span
                      key={role}
                      style={{
                        fontSize: "13px",
                        padding: "6px 14px",
                        borderRadius: "100px",
                        background: isDark ? "rgba(255,214,0,0.12)" : "rgba(0,0,0,0.06)",
                        color: isDark ? colors.accent : "#333",
                        fontWeight: 600,
                        border: `1px solid ${isDark ? "rgba(255,214,0,0.2)" : "rgba(0,0,0,0.1)"}`,
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>

                {/* Stats Row */}
                <div
                  style={{
                    display: "flex",
                    gap: isMobile ? "16px" : "32px",
                    flexWrap: "wrap",
                    paddingBottom: "24px",
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <StatItem icon={<Users size={16} />} value={formatFollowers(profile.followers_count)} label="Followers" colors={colors} />
                  <StatItem icon={<Users size={16} />} value={formatFollowers(profile.following_count)} label="Following" colors={colors} />
                  <StatItem icon={<Eye size={16} />} value={formatFollowers(profile.profile_views)} label="Views" colors={colors} />
                  {profile.location_display && (
                    <StatItem icon={<MapPin size={16} />} value={profile.location_display} label="Location" colors={colors} />
                  )}
                  <StatItem icon={<Calendar size={16} />} value={formatDate(profile.created_at)} label="Joined" colors={colors} />
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Tab Navigation Bar                                               */}
          {/* ================================================================ */}
          <div
            style={{
              marginTop: "16px",
              borderRadius: "16px",
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
              border: `1px solid ${colors.border}`,
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Left scroll arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollTabs("left")}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDark
                    ? "linear-gradient(to right, rgba(20,20,30,0.95) 60%, transparent)"
                    : "linear-gradient(to right, rgba(255,255,255,0.95) 60%, transparent)",
                  border: "none",
                  cursor: "pointer",
                  zIndex: 2,
                  borderRadius: "16px 0 0 16px",
                  color: colors.textSecondary,
                }}
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Scrollable tabs */}
            <div
              ref={tabScrollRef}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                overflowX: "auto",
                scrollbarWidth: "none",
                padding: "6px 8px",
                flex: 1,
              }}
              // Hide scrollbar with inline CSS
              onScroll={() => {}}
            >
              <style>{`
                .sv-tab-scroll::-webkit-scrollbar { display: none; }
              `}</style>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const isSettingsTab = tab.id === "settings";
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: isSettingsTab ? "8px 10px" : "8px 14px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.2s",
                      background: isActive
                        ? isDark
                          ? "rgba(255,214,0,0.15)"
                          : "rgba(255,214,0,0.25)"
                        : "transparent",
                      color: isActive
                        ? colors.accent
                        : colors.textSecondary,
                      borderBottom: isActive ? `2px solid ${colors.accent}` : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {tab.icon}
                    {tab.label && <span>{tab.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* Right scroll arrow */}
            {canScrollRight && (
              <button
                onClick={() => scrollTabs("right")}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDark
                    ? "linear-gradient(to left, rgba(20,20,30,0.95) 60%, transparent)"
                    : "linear-gradient(to left, rgba(255,255,255,0.95) 60%, transparent)",
                  border: "none",
                  cursor: "pointer",
                  zIndex: 2,
                  borderRadius: "0 16px 16px 0",
                  color: colors.textSecondary,
                }}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {/* ================================================================ */}
          {/* Tab Content                                                       */}
          {/* ================================================================ */}
          <div style={{ marginTop: "24px" }}>
            {activeTab === "news" && (
              <TabNews profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "portfolio" && (
              <TabPortfolio profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "services" && (
              <TabServices profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "messages" && (
              <TabMessages profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "tasks" && (
              <TabTasks profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "calendar" && (
              <TabCalendar profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "documents" && (
              <TabDocuments profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "about" && (
              <TabAbout profile={profile} colors={colors} isDark={isDark} isMobile={isMobile} />
            )}
            {activeTab === "storage" && (
              <TabStorage profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "social-media" && (
              <TabSocialMedia profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "activity" && (
              <TabActivity profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "street-gallery" && (
              <TabStreetGallery profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "jobs" && (
              <TabJobs profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "settings" && (
              <TabSettings profile={profile} colors={colors} isDark={isDark} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Shared Sub-Components
// =============================================================================

function StatItem({
  icon,
  value,
  label,
  colors,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  colors: any;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: colors.text,
          fontSize: "15px",
          fontWeight: 700,
        }}
      >
        <span style={{ color: colors.textSecondary }}>{icon}</span>
        {value}
      </div>
      <span style={{ fontSize: "12px", color: colors.textSecondary }}>{label}</span>
    </div>
  );
}

function GlassCard({
  title,
  children,
  colors,
  isDark,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  colors: any;
  isDark: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: "20px",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
        border: `1px solid ${colors.border}`,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        padding: "24px",
        boxShadow: isDark
          ? "0 4px 16px rgba(0,0,0,0.3)"
          : "0 4px 16px rgba(31,38,135,0.1)",
        ...style,
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: colors.text,
            margin: "0 0 16px 0",
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  colors,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  colors: any;
  isDark: boolean;
}) {
  return (
    <GlassCard colors={colors} isDark={isDark}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          gap: "16px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: isDark ? "rgba(255,214,0,0.1)" : "rgba(255,214,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.accent,
          }}
        >
          {icon}
        </div>
        <h3 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: 0 }}>
          {title}
        </h3>
        <p style={{ fontSize: "14px", color: colors.textSecondary, margin: 0, maxWidth: "400px", lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </GlassCard>
  );
}

function ListRow({
  icon,
  title,
  subtitle,
  rightText,
  colors,
  isDark,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightText?: string;
  colors: any;
  isDark: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 16px",
        borderRadius: "12px",
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${colors.border}`,
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: accent
            ? isDark ? "rgba(255,214,0,0.12)" : "rgba(255,214,0,0.2)"
            : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent ? colors.accent : colors.textSecondary,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "2px" }}>
            {subtitle}
          </div>
        )}
      </div>
      {rightText && (
        <span style={{ fontSize: "12px", color: colors.textSecondary, flexShrink: 0 }}>
          {rightText}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Tab Content Components
// =============================================================================

function TabNews({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const savedArticles = [
    {
      title: "The Rise of Street Art in the Digital Age",
      source: "Street Voices Magazine",
      date: "Apr 5, 2026",
      readTime: "8 min read",
      category: "Culture",
      excerpt: "How digital tools and social platforms are transforming the way street artists create, share, and monetize their work.",
      imageUrl: "https://picsum.photos/seed/streetart1/300/200",
      saved: true,
    },
    {
      title: "Grant Opportunities for Emerging Artists — Spring 2026",
      source: "Arts Council Weekly",
      date: "Apr 3, 2026",
      readTime: "5 min read",
      category: "Opportunities",
      excerpt: "A roundup of the latest grants, residencies, and funding programs open to visual artists and muralists.",
      imageUrl: "https://picsum.photos/seed/grants2/300/200",
      saved: true,
    },
    {
      title: "How to Price Your Creative Services",
      source: "The Creative Independent",
      date: "Mar 28, 2026",
      readTime: "12 min read",
      category: "Business",
      excerpt: "A practical guide to setting rates, negotiating contracts, and valuing your time as a freelance creative.",
      imageUrl: "https://picsum.photos/seed/pricing3/300/200",
      saved: true,
    },
    {
      title: "Toronto's Most Instagrammable Murals in 2026",
      source: "BlogTO",
      date: "Mar 22, 2026",
      readTime: "6 min read",
      category: "Culture",
      excerpt: "From Kensington Market to the Distillery District, these are the walls turning heads this year.",
      imageUrl: "https://picsum.photos/seed/murals4/300/200",
      saved: true,
    },
    {
      title: "Building a Portfolio That Gets You Hired",
      source: "Creative Boom",
      date: "Mar 15, 2026",
      readTime: "10 min read",
      category: "Career",
      excerpt: "Art directors share what they look for when reviewing creative portfolios and how to stand out.",
      imageUrl: "https://picsum.photos/seed/portfolio5/300/200",
      saved: true,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {savedArticles.map((article, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: "16px",
            padding: "14px",
            borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
            e.currentTarget.style.borderColor = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <div style={{
            width: "120px",
            minWidth: "120px",
            height: "80px",
            borderRadius: "8px",
            overflow: "hidden",
            flexShrink: 0,
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <img
              src={article.imageUrl}
              alt={article.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: colors.accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {article.category}
              </span>
              <span style={{ fontSize: "11px", color: colors.textMuted }}>{"\u00B7"}</span>
              <span style={{ fontSize: "11px", color: colors.textMuted }}>{article.readTime}</span>
            </div>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: colors.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {article.title}
            </h4>
            <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {article.excerpt}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              <span style={{ fontSize: "12px", color: colors.textMuted }}>{article.source}</span>
              <span style={{ fontSize: "11px", color: colors.textMuted }}>{"\u00B7"}</span>
              <span style={{ fontSize: "12px", color: colors.textMuted }}>{article.date}</span>
              <Bookmark size={14} style={{ marginLeft: "auto", color: colors.accent, fill: colors.accent }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Portfolio Gallery Tab
// =============================================================================

type PortfolioItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  date: string;
  likes: number;
  isLiked: boolean;
};

const SAMPLE_PORTFOLIO: PortfolioItem[] = [
  {
    id: "1",
    title: "Neon Dreams Mural",
    description: "A 40ft mural exploring the intersection of urban culture and digital art. Commissioned by the City of Toronto for the Dundas West revitalization project.",
    imageUrl: "https://images.unsplash.com/photo-1561059488-916d69792237?w=600&h=400&fit=crop",
    category: "Murals",
    date: "2025-11-15",
    likes: 342,
    isLiked: false,
  },
  {
    id: "2",
    title: "Street Canvas Series",
    description: "A collection of paste-up artworks displayed across multiple cities. Each piece tells a story of the neighborhood it was placed in.",
    imageUrl: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=600&h=400&fit=crop",
    category: "Street Art",
    date: "2025-09-22",
    likes: 218,
    isLiked: true,
  },
  {
    id: "3",
    title: "Warehouse Transformation",
    description: "Complete interior mural design for a converted warehouse space. 4 walls, each representing a season through abstract expressionism.",
    imageUrl: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=400&fit=crop",
    category: "Murals",
    date: "2025-08-10",
    likes: 567,
    isLiked: false,
  },
  {
    id: "4",
    title: "Faces of the City",
    description: "Portrait series celebrating the diverse faces of Toronto's street culture scene. Spray paint on concrete.",
    imageUrl: "https://images.unsplash.com/photo-1578926288207-a90a5366759d?w=600&h=400&fit=crop",
    category: "Portraits",
    date: "2025-07-04",
    likes: 891,
    isLiked: false,
  },
  {
    id: "5",
    title: "Abstract Flow",
    description: "Experimental piece using drip techniques and bold color palettes. Part of the 2025 Street Art Festival showcase.",
    imageUrl: "https://images.unsplash.com/photo-1541280910158-c4e14f9c94a3?w=600&h=400&fit=crop",
    category: "Abstract",
    date: "2025-06-20",
    likes: 445,
    isLiked: true,
  },
  {
    id: "6",
    title: "Community Garden Wall",
    description: "Collaborative mural project with local youth. Painted over 3 weekends with community participation.",
    imageUrl: "https://images.unsplash.com/photo-1551913902-c92207136625?w=600&h=400&fit=crop",
    category: "Community",
    date: "2025-05-12",
    likes: 723,
    isLiked: false,
  },
  {
    id: "7",
    title: "Night Lights Installation",
    description: "UV-reactive mural that transforms under blacklight. Installed in a nightclub in Kensington Market.",
    imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=400&fit=crop",
    category: "Installations",
    date: "2025-04-08",
    likes: 334,
    isLiked: false,
  },
  {
    id: "8",
    title: "The Alley Project",
    description: "Transforming forgotten alleyways into open-air galleries. An ongoing series across downtown Toronto.",
    imageUrl: "https://images.unsplash.com/photo-1555448248-2571daf6344b?w=600&h=400&fit=crop",
    category: "Street Art",
    date: "2025-03-15",
    likes: 612,
    isLiked: true,
  },
];

const PORTFOLIO_CATEGORIES = ["All", "Murals", "Street Art", "Portraits", "Abstract", "Community", "Installations"];

function TabPortfolio({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const [items, setItems] = useState<PortfolioItem[]>(SAMPLE_PORTFOLIO);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "masonry">("grid");
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Street Art");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = selectedCategory === "All" ? items : items.filter((i) => i.category === selectedCategory);

  const toggleLike = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isLiked: !item.isLiked, likes: item.isLiked ? item.likes - 1 : item.likes + 1 }
          : item
      )
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!uploadTitle.trim() || !uploadPreview) return;
    const newItem: PortfolioItem = {
      id: String(Date.now()),
      title: uploadTitle,
      description: uploadDesc,
      imageUrl: uploadPreview,
      category: uploadCategory,
      date: new Date().toISOString().split("T")[0],
      likes: 0,
      isLiked: false,
    };
    setItems((prev) => [newItem, ...prev]);
    setShowUploadModal(false);
    setUploadTitle("");
    setUploadDesc("");
    setUploadCategory("Street Art");
    setUploadPreview(null);
  };

  return (
    <div>
      {/* Header with controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: colors.text }}>
            Portfolio
          </h3>
          <span style={{ fontSize: "13px", color: colors.textSecondary }}>
            {filteredItems.length} {filteredItems.length === 1 ? "piece" : "pieces"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {/* View mode toggle */}
          <div style={{ display: "flex", borderRadius: "10px", overflow: "hidden", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}` }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{
                padding: "8px 12px",
                background: viewMode === "grid" ? "rgba(255,214,0,0.15)" : "transparent",
                border: "none",
                color: viewMode === "grid" ? colors.accent : colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode("masonry")}
              style={{
                padding: "8px 12px",
                background: viewMode === "masonry" ? "rgba(255,214,0,0.15)" : "transparent",
                border: "none",
                color: viewMode === "masonry" ? colors.accent : colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Layers size={16} />
            </button>
          </div>
          {/* Upload button */}
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              background: colors.accent,
              color: "#000",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Upload size={14} /> Upload Work
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "4px" }}>
        {PORTFOLIO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: "6px 16px",
              borderRadius: "100px",
              background: selectedCategory === cat ? "rgba(255,214,0,0.15)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              border: selectedCategory === cat ? `1px solid ${colors.accent}` : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              color: selectedCategory === cat ? colors.accent : colors.textSecondary,
              fontWeight: selectedCategory === cat ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <GlassCard colors={colors} isDark={isDark} style={{ textAlign: "center", padding: "60px 20px" }}>
          <Camera size={40} color={colors.textSecondary} style={{ marginBottom: "12px", opacity: 0.5 }} />
          <h4 style={{ color: colors.text, margin: "0 0 8px" }}>No work in this category yet</h4>
          <p style={{ color: colors.textSecondary, fontSize: "14px", margin: 0 }}>
            Upload your first piece to start building your portfolio.
          </p>
        </GlassCard>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(280px, 1fr))" : "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          {filteredItems.map((item, idx) => (
            <div
              key={item.id}
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer",
                ...(viewMode === "masonry" ? { gridRow: idx % 3 === 0 ? "span 2" : "span 1" } : {}),
              }}
              onClick={() => setLightboxItem(item)}
            >
              {/* Image */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: viewMode === "masonry" && idx % 3 === 0 ? "320px" : "220px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" fill="${isDark ? '#1a1a2e' : '#f0f0f0'}"><rect width="600" height="400"/><text x="50%" y="50%" fill="${isDark ? '#555' : '#aaa'}" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="18">${item.title}</text></svg>`
                    )}`;
                  }}
                />
                {/* Overlay on hover */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(transparent 50%, rgba(0,0,0,0.7))",
                    opacity: 0.8,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        background: "rgba(255,214,0,0.2)",
                        color: "#FFD600",
                        fontWeight: 600,
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                </div>
                {/* Zoom icon */}
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <ZoomIn size={14} color="#fff" />
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: "14px 16px" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: colors.text }}>
                  {item.title}
                </h4>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "13px",
                    color: colors.textSecondary,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: colors.textSecondary }}>
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(item.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px",
                      borderRadius: "100px",
                      background: item.isLiked ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                      border: "none",
                      color: item.isLiked ? "#ef4444" : colors.textSecondary,
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Heart size={14} fill={item.isLiked ? "#ef4444" : "none"} /> {item.likes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Lightbox Modal ===== */}
      {lightboxItem && (
        <div
          onClick={() => setLightboxItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.9)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "20px",
              overflow: "hidden",
              background: isDark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.95)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxItem(null)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <X size={20} />
            </button>

            {/* Image */}
            <div style={{ position: "relative", maxHeight: "60vh", overflow: "hidden" }}>
              <img
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                style={{ width: "100%", height: "100%", objectFit: "contain", maxHeight: "60vh" }}
              />
            </div>

            {/* Details */}
            <div style={{ padding: "24px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: colors.text }}>
                    {lightboxItem.title}
                  </h3>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        background: "rgba(255,214,0,0.15)",
                        color: colors.accent,
                        fontWeight: 600,
                      }}
                    >
                      {lightboxItem.category}
                    </span>
                    <span style={{ fontSize: "13px", color: colors.textSecondary }}>
                      {new Date(lightboxItem.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => toggleLike(lightboxItem.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      background: lightboxItem.isLiked ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                      color: lightboxItem.isLiked ? "#ef4444" : colors.text,
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Heart size={16} fill={lightboxItem.isLiked ? "#ef4444" : "none"} /> {lightboxItem.likes}
                  </button>
                  <button
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                      color: colors.text,
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={16} /> Save
                  </button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "15px", color: colors.textSecondary, lineHeight: 1.6 }}>
                {lightboxItem.description}
              </p>
              <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: colors.textSecondary }}>By</span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: colors.accent }}>
                  {profile.display_name}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Upload Modal ===== */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "550px",
              width: "100%",
              borderRadius: "20px",
              background: isDark ? "rgba(30,30,40,0.97)" : "rgba(255,255,255,0.97)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              padding: "32px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: colors.text }}>
                Upload Work
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* File upload area */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            {uploadPreview ? (
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <img
                  src={uploadPreview}
                  alt="Preview"
                  style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                    borderRadius: "12px",
                  }}
                />
                <button
                  onClick={() => {
                    setUploadPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                  borderRadius: "12px",
                  padding: "40px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: "20px",
                  transition: "border-color 0.2s ease",
                }}
              >
                <Camera size={32} color={colors.textSecondary} style={{ marginBottom: "8px" }} />
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600, color: colors.text }}>
                  Click to upload
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary }}>
                  JPG, PNG, GIF, or WebP &bull; Max 20MB
                </p>
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: colors.text, display: "block", marginBottom: "6px" }}>
                Title <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Give your work a title"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  color: colors.text,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: colors.text, display: "block", marginBottom: "6px" }}>
                Description
              </label>
              <textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Describe your work, materials used, inspiration..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  color: colors.text,
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: colors.text, display: "block", marginBottom: "6px" }}>
                Category
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PORTFOLIO_CATEGORIES.filter((c) => c !== "All").map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "100px",
                      background: uploadCategory === cat ? "rgba(255,214,0,0.15)" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                      border: uploadCategory === cat ? `1px solid ${colors.accent}` : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                      color: uploadCategory === cat ? colors.accent : colors.textSecondary,
                      fontWeight: uploadCategory === cat ? 600 : 400,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadTitle.trim() || !uploadPreview}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  background: uploadTitle.trim() && uploadPreview ? colors.accent : "rgba(255,255,255,0.08)",
                  color: uploadTitle.trim() && uploadPreview ? "#000" : colors.textSecondary,
                  fontWeight: 700,
                  fontSize: "14px",
                  border: "none",
                  cursor: uploadTitle.trim() && uploadPreview ? "pointer" : "not-allowed",
                  opacity: uploadTitle.trim() && uploadPreview ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={16} /> Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabServices({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const navigate = useNavigate();
  const services = [
    { id: "mural-commission", name: "Mural Commission", desc: "Custom large-scale wall murals for businesses & homes", price: "Starting at $2,500", available: true },
    { id: "live-painting", name: "Live Painting", desc: "Live art performance for events, festivals & parties", price: "Starting at $1,000", available: true },
    { id: "art-direction", name: "Art Direction", desc: "Creative direction for brands, campaigns & productions", price: "Custom quote", available: true },
    { id: "workshop-teaching", name: "Workshop / Teaching", desc: "Group or 1-on-1 street art workshops", price: "Starting at $500", available: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {services.map((svc, i) => (
        <GlassCard key={i} colors={colors} isDark={isDark}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: colors.text }}>{svc.name}</h4>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "100px",
                    background: svc.available ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: svc.available ? "#22c55e" : "#ef4444",
                    fontWeight: 600,
                  }}
                >
                  {svc.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: colors.textSecondary, lineHeight: 1.5 }}>{svc.desc}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: colors.accent }}>{svc.price}</div>
              {svc.available && (
                <button
                  onClick={() => navigate(`/creatives/${profile.username}/book?service=${svc.id}`)}
                  style={{
                    marginTop: "8px",
                    padding: "8px 20px",
                    borderRadius: "10px",
                    background: colors.accent,
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "13px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Book Now
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function TabMessages({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  return (
    <EmptyState
      icon={<MessageSquare size={28} />}
      title="Messages"
      description={`Start a conversation with ${profile.display_name}. Messages will appear here once you connect.`}
      colors={colors}
      isDark={isDark}
    />
  );
}

function TabTasks({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const tasks = [
    { title: "Update portfolio with latest mural project", status: "In Progress", due: "Apr 10" },
    { title: "Review collaboration proposal from @street_collective", status: "Pending", due: "Apr 12" },
    { title: "Submit artwork for gallery exhibition", status: "Completed", due: "Apr 3" },
  ];

  return (
    <GlassCard title="Active Tasks" colors={colors} isDark={isDark}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {tasks.map((task, i) => (
          <ListRow
            key={i}
            icon={<CheckSquare size={18} />}
            title={task.title}
            subtitle={`Status: ${task.status}`}
            rightText={`Due: ${task.due}`}
            colors={colors}
            isDark={isDark}
            accent={task.status === "Completed"}
          />
        ))}
      </div>
    </GlassCard>
  );
}

function TabCalendar({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const events = [
    { title: "Live Mural Painting — Downtown Arts District", date: "Apr 8, 2026", time: "10:00 AM — 4:00 PM" },
    { title: "Portfolio Review with Gallery Owner", date: "Apr 11, 2026", time: "2:00 PM" },
    { title: "Street Art Festival — Panel Discussion", date: "Apr 15, 2026", time: "1:00 PM — 3:00 PM" },
    { title: "Workshop: Spray Can Techniques", date: "Apr 20, 2026", time: "11:00 AM — 1:00 PM" },
  ];

  return (
    <GlassCard title="Upcoming Events" colors={colors} isDark={isDark}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {events.map((evt, i) => (
          <ListRow
            key={i}
            icon={<Calendar size={18} />}
            title={evt.title}
            subtitle={evt.time}
            rightText={evt.date}
            colors={colors}
            isDark={isDark}
            accent
          />
        ))}
      </div>
    </GlassCard>
  );
}

function TabDocuments({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const docs = [
    { name: "Artist Statement 2026.pdf", size: "245 KB", date: "Mar 28" },
    { name: "Commission Contract Template.docx", size: "89 KB", date: "Mar 15" },
    { name: "Portfolio Deck — Q1 2026.pdf", size: "4.2 MB", date: "Feb 20" },
    { name: "Insurance Certificate.pdf", size: "1.1 MB", date: "Jan 5" },
  ];

  return (
    <GlassCard title="Documents" colors={colors} isDark={isDark}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {docs.map((doc, i) => (
          <ListRow
            key={i}
            icon={<FileText size={18} />}
            title={doc.name}
            subtitle={doc.size}
            rightText={doc.date}
            colors={colors}
            isDark={isDark}
          />
        ))}
      </div>
    </GlassCard>
  );
}

function TabAbout({
  profile,
  colors,
  isDark,
  isMobile,
}: {
  profile: StreetProfile;
  colors: any;
  isDark: boolean;
  isMobile: boolean;
}) {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [lovedProjects, setLovedProjects] = useState<Set<number>>(new Set());
  const [projectComments, setProjectComments] = useState<Record<number, Array<{ name: string; avatar: string; text: string; time: string }>>>({
    0: [
      { name: "Maya Chen", avatar: "https://picsum.photos/seed/user-maya/100/100", text: "This mural is incredible. The layering technique gives it so much depth!", time: "2 days ago" },
      { name: "Derin Falana", avatar: "https://picsum.photos/seed/user-derin/100/100", text: "Walked past this last week — photos don't do it justice. The scale is massive.", time: "5 days ago" },
    ],
    2: [
      { name: "Suki Park", avatar: "https://picsum.photos/seed/user-suki/100/100", text: "The found object work in this series is next level. Love the transit tokens embedded in resin.", time: "1 week ago" },
    ],
    5: [
      { name: "Carlos Rivera", avatar: "https://picsum.photos/seed/user-carlos/100/100", text: "Was at Nuit Blanche for this — the UV reveal was absolutely magical. Best piece of the night.", time: "3 weeks ago" },
      { name: "Asha Williams", avatar: "https://picsum.photos/seed/user-asha/100/100", text: "How long did the UV paint take to apply? This must have been so meticulous.", time: "2 weeks ago" },
      { name: "Ghost", avatar: "", text: "Thanks Asha! About 3 weeks of daytime work — painting something you can't see until nightfall is wild.", time: "2 weeks ago" },
    ],
  });
  const [commentInput, setCommentInput] = useState("");

  const toggleLove = (idx: number) => {
    setLovedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const addComment = (idx: number) => {
    if (!commentInput.trim()) return;
    setProjectComments((prev) => ({
      ...prev,
      [idx]: [...(prev[idx] || []), { name: "You", avatar: "", text: commentInput.trim(), time: "Just now" }],
    }));
    setCommentInput("");
  };

  const portfolioWorks = profile.portfolio_items && profile.portfolio_items.length > 0
    ? profile.portfolio_items
    : [
        {
          title: "Voices of the Underground",
          image_url: "https://picsum.photos/seed/port-voices/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-voices/600/400",
          category: "Mural",
          year: "2026",
          tools: ["Spray Paint", "Acrylic", "Stencils"],
          description: "A large-scale mural exploring the hidden narratives of Toronto's underground music scene. This 40-foot wall piece was commissioned by the Dundas West BIA and features layered portraits of local musicians, DJs, and producers who shaped the city's sound. The work uses a mix of freehand spray paint and precision stencil work to create depth and movement.",
          views: 1247,
          appreciations: 89,
        },
        {
          title: "Concrete Canvas — Dundas & Ossington",
          image_url: "https://picsum.photos/seed/port-concrete/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-concrete/600/400",
          category: "Installation",
          year: "2025",
          tools: ["Wheat Paste", "Photography", "Mixed Media"],
          description: "An ephemeral installation that transformed a construction hoarding into a living timeline of the neighbourhood. Using large-format wheat paste prints combined with hand-painted elements, the piece documented 50 years of community stories gathered through interviews with local residents. The installation stood for 3 months before the site was developed.",
          views: 892,
          appreciations: 67,
        },
        {
          title: "Chromatic Rebellion Series",
          image_url: "https://picsum.photos/seed/port-chromatic/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-chromatic/600/400",
          category: "Mixed Media",
          year: "2025",
          tools: ["Acrylic", "Resin", "Found Objects"],
          description: "A 12-piece gallery series examining the intersection of street culture and fine art. Each canvas incorporates found objects from Toronto streets — transit tokens, torn posters, broken glass — embedded in layers of acrylic and resin. The series was exhibited at the AGO's First Thursday and later acquired by a private collector.",
          views: 2034,
          appreciations: 156,
        },
        {
          title: "City Pulse — Queen West",
          image_url: "https://picsum.photos/seed/port-pulse/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-pulse/600/400",
          category: "Digital Print",
          year: "2025",
          tools: ["Digital Illustration", "Large Format Print", "UV Ink"],
          description: "A series of limited-edition digital prints capturing the energy of Queen Street West at different times of day. Created using a combination of photography, digital painting, and generative algorithms, each print in the edition of 25 represents a unique moment in the street's daily rhythm.",
          views: 534,
          appreciations: 41,
        },
        {
          title: "Roots & Routes",
          image_url: "https://picsum.photos/seed/port-roots/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-roots/600/400",
          category: "Spray Paint",
          year: "2024",
          tools: ["Montana Gold", "Ironlak", "Hand-cut Stencils"],
          description: "A community mural project in collaboration with newcomer youth in the Jane-Finch corridor. Over 6 weeks, participants shared migration stories that were woven into a 60-foot narrative mural. The piece traces routes from countries of origin to Toronto, connecting personal histories with the geography of the city.",
          views: 1678,
          appreciations: 112,
        },
        {
          title: "Neon Ghosts — Kensington Nights",
          image_url: "https://picsum.photos/seed/port-neon/1200/800",
          thumbnail_url: "https://picsum.photos/seed/port-neon/600/400",
          category: "UV Installation",
          year: "2024",
          tools: ["UV Reactive Paint", "Black Light", "Projection Mapping"],
          description: "A site-specific night installation in Kensington Market that revealed hidden murals only visible under UV light. Painted during the day in clear UV-reactive medium, the works came alive after sunset when custom black light fixtures were activated. The project ran for Nuit Blanche 2024 and drew over 3,000 visitors.",
          views: 3210,
          appreciations: 245,
        },
      ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
        gap: "24px",
      }}
    >
      {/* Left Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {profile.bio && (
          <GlassCard title="About" colors={colors} isDark={isDark}>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.7,
                color: colors.text,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {profile.bio}
            </p>
          </GlassCard>
        )}

        {profile.secondary_skills && profile.secondary_skills.length > 0 && (
          <GlassCard title="Skills & Expertise" colors={colors} isDark={isDark}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {profile.secondary_skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    fontSize: "13px",
                    padding: "6px 14px",
                    borderRadius: "100px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    color: colors.textSecondary,
                    fontWeight: 500,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Portfolio Section — Behance-style */}
        <GlassCard title="Portfolio" colors={colors} isDark={isDark}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {portfolioWorks.map((item: any, i: number) => (
              <div
                key={i}
                onClick={() => setSelectedProject(i)}
                style={{
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: `1px solid ${colors.border}`,
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  transition: "all 0.3s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ position: "relative", width: "100%", paddingTop: "66%", overflow: "hidden" }}>
                  <img
                    src={item.thumbnail_url || item.image_url}
                    alt={item.title || "Portfolio item"}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                      const p = t.parentElement;
                      if (p) { p.style.display = "flex"; p.style.alignItems = "center"; p.style.justifyContent = "center"; p.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; p.innerHTML += '<div style="font-size:48px">🖼️</div>'; }
                    }}
                  />
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>
                    {item.title || "Untitled"}
                  </div>
                  {(item.category || item.year) && (
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      {item.category}{item.category && item.year ? " · " : ""}{item.year}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Behance-style Project Detail Modal */}
        {selectedProject !== null && portfolioWorks[selectedProject] && (() => {
          const project = portfolioWorks[selectedProject];
          return (
            <div
              onClick={() => setSelectedProject(null)}
              style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.85)", zIndex: 9999,
                overflowY: "auto", backdropFilter: "blur(8px)",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "900px", margin: "40px auto", padding: "0 20px 60px",
                }}
              >
                {/* Close + Nav */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", position: "sticky", top: 0, zIndex: 10 }}>
                  <button
                    onClick={() => setSelectedProject(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "10px 20px", borderRadius: "10px",
                      background: "rgba(255,255,255,0.1)", border: "none",
                      color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 500,
                    }}
                  >
                    <ArrowLeft size={16} /> Back to Portfolio
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {selectedProject > 0 && (
                      <button
                        onClick={() => setSelectedProject(selectedProject - 1)}
                        style={{
                          width: "40px", height: "40px", borderRadius: "50%",
                          background: "rgba(255,255,255,0.1)", border: "none",
                          color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    {selectedProject < portfolioWorks.length - 1 && (
                      <button
                        onClick={() => setSelectedProject(selectedProject + 1)}
                        style={{
                          width: "40px", height: "40px", borderRadius: "50%",
                          background: "rgba(255,255,255,0.1)", border: "none",
                          color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Hero Image — Full Width */}
                <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "32px", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
                  <img
                    src={project.image_url}
                    alt={project.title}
                    style={{ width: "100%", display: "block" }}
                  />
                </div>

                {/* Project Info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", margin: "0 0 8px 0" }}>
                      {project.title}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
                      <span>{profile.display_name}</span>
                      <span>·</span>
                      <span>{project.category}</span>
                      <span>·</span>
                      <span>{project.year}</span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div style={{ display: "flex", gap: "20px", fontSize: "14px", color: "rgba(255,255,255,0.6)" }}>
                    {project.views !== undefined && (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Eye size={16} /> {project.views.toLocaleString()}
                      </span>
                    )}
                    {project.appreciations !== undefined && (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Heart size={16} /> {project.appreciations.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "0 0 24px 0" }} />

                {/* Description */}
                {project.description && (
                  <div style={{ marginBottom: "32px" }}>
                    <p style={{
                      fontSize: "16px", lineHeight: 1.8, color: "rgba(255,255,255,0.85)",
                      margin: 0, maxWidth: "700px",
                    }}>
                      {project.description}
                    </p>
                  </div>
                )}

                {/* Tools Used */}
                {project.tools && project.tools.length > 0 && (
                  <div style={{ marginBottom: "32px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px 0" }}>
                      Tools & Materials
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {project.tools.map((tool: string, i: number) => (
                        <span key={i} style={{
                          fontSize: "13px", padding: "6px 16px", borderRadius: "100px",
                          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Love Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
                  <button
                    onClick={() => toggleLove(selectedProject)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "12px 16px", borderRadius: "100px",
                      background: lovedProjects.has(selectedProject) ? "#ef4444" : "rgba(255,255,255,0.08)",
                      border: lovedProjects.has(selectedProject) ? "none" : "1px solid rgba(255,255,255,0.15)",
                      color: "#fff", cursor: "pointer", fontSize: "15px", fontWeight: 600,
                      transition: "all 0.2s",
                    }}
                  >
                    <Heart size={20} fill={lovedProjects.has(selectedProject) ? "#fff" : "none"} />
                  </button>
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                    {(project.appreciations || 0) + (lovedProjects.has(selectedProject) ? 1 : 0)} appreciations
                  </span>
                </div>

                {/* Artist Card */}
                <div style={{
                  padding: "20px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", gap: "16px",
                  marginBottom: "32px",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <User size={24} color="rgba(255,255,255,0.5)" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{profile.display_name}</div>
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                      {profile.primary_roles?.join(", ") || "Creative"} · {profile.location_display || profile.city}
                    </div>
                  </div>
                  <button style={{
                    padding: "8px 20px", borderRadius: "8px",
                    background: colors.accent, color: "#000", fontWeight: 700,
                    fontSize: "13px", border: "none", cursor: "pointer",
                  }}>
                    Follow
                  </button>
                </div>

                {/* Comments Section */}
                <div style={{ marginBottom: "32px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 20px 0" }}>
                    Comments ({(projectComments[selectedProject] || []).length})
                  </h3>

                  {/* Comment Input */}
                  <div style={{
                    display: "flex", gap: "12px", marginBottom: "24px",
                    padding: "16px", borderRadius: "14px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: colors.accent, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: 700, color: "#000",
                    }}>
                      Y
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                      <textarea
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Share your thoughts on this project..."
                        style={{
                          width: "100%", minHeight: "60px", padding: "10px 14px",
                          borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.04)", color: "#fff",
                          fontSize: "14px", fontFamily: "inherit", resize: "vertical",
                          outline: "none",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = colors.accent; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => addComment(selectedProject)}
                          disabled={!commentInput.trim()}
                          style={{
                            padding: "8px 20px", borderRadius: "8px",
                            background: commentInput.trim() ? colors.accent : "rgba(255,255,255,0.06)",
                            color: commentInput.trim() ? "#000" : "rgba(255,255,255,0.3)",
                            fontWeight: 700, fontSize: "13px", border: "none",
                            cursor: commentInput.trim() ? "pointer" : "default",
                          }}
                        >
                          Post Comment
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Comment List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {(projectComments[selectedProject] || []).map((comment, ci) => (
                      <div key={ci} style={{
                        display: "flex", gap: "12px",
                        padding: "16px", borderRadius: "14px",
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "50%",
                          background: "rgba(255,255,255,0.1)", flexShrink: 0,
                          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {comment.avatar ? (
                            <img src={comment.avatar} alt={comment.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <User size={18} color="rgba(255,255,255,0.5)" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{comment.name}</span>
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{comment.time}</span>
                          </div>
                          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!projectComments[selectedProject] || projectComments[selectedProject].length === 0) && (
                      <div style={{ textAlign: "center", padding: "24px", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
                        No comments yet. Be the first to share your thoughts!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Right Column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <GlassCard title="Connect" colors={colors} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                background: colors.accent,
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Follow
            </button>
            <button
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                color: colors.text,
                fontWeight: 600,
                fontSize: "14px",
                border: `1px solid ${colors.border}`,
                cursor: "pointer",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Mail size={16} />
              Message
            </button>
          </div>
        </GlassCard>

        {profile.open_to && profile.open_to.length > 0 && (
          <GlassCard title="Open To" colors={colors} isDark={isDark}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {profile.open_to.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: colors.text,
                  }}
                >
                  <Briefcase size={14} color={colors.accent} />
                  {item}
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {(profile.website || (profile.external_links && profile.external_links.length > 0)) && (
          <GlassCard title="Links" colors={colors} isDark={isDark}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: colors.accent,
                    textDecoration: "none",
                  }}
                >
                  <Globe size={14} />
                  {profile.website.replace(/^https?:\/\//, "")}
                  <ExternalLink size={12} style={{ opacity: 0.5 }} />
                </a>
              )}
              {profile.external_links?.map((link: any, i: number) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: colors.accent,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={14} />
                  {link.label || link.url?.replace(/^https?:\/\//, "")}
                </a>
              ))}
            </div>
          </GlassCard>
        )}

        <GlassCard title="Profile Strength" colors={colors} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "14px",
                color: colors.textSecondary,
              }}
            >
              <span>Completeness</span>
              <span style={{ fontWeight: 700, color: colors.accent }}>
                {profile.completeness_score}%
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "100px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${profile.completeness_score}%`,
                  height: "100%",
                  borderRadius: "100px",
                  background: `linear-gradient(90deg, ${colors.accent}, #ff8800)`,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function TabStorage({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const storageUsed = 2.4;
  const storageTotal = 10;
  const pct = (storageUsed / storageTotal) * 100;

  const files = [
    { name: "Mural Designs", type: "Folder", size: "1.2 GB", items: "24 files" },
    { name: "Reference Photos", type: "Folder", size: "820 MB", items: "156 files" },
    { name: "Client Work", type: "Folder", size: "380 MB", items: "12 files" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <GlassCard title="Storage Usage" colors={colors} isDark={isDark}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>
              {storageUsed} GB of {storageTotal} GB used
            </span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: colors.accent }}>{pct.toFixed(0)}%</span>
          </div>
          <div style={{ height: "8px", borderRadius: "100px", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: "100px", background: `linear-gradient(90deg, ${colors.accent}, #ff8800)` }} />
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Files" colors={colors} isDark={isDark}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {files.map((f, i) => (
            <ListRow
              key={i}
              icon={<HardDrive size={18} />}
              title={f.name}
              subtitle={`${f.items} · ${f.size}`}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function TabSocialMedia({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const socials = [
    { platform: "Instagram", handle: `@${profile.username}`, followers: "12.3K", connected: true },
    { platform: "TikTok", handle: `@${profile.username}`, followers: "8.7K", connected: true },
    { platform: "YouTube", handle: profile.display_name, followers: "5.2K", connected: true },
    { platform: "Twitter / X", handle: `@${profile.username}`, followers: "3.1K", connected: false },
    { platform: "Behance", handle: profile.display_name, followers: "2.8K", connected: false },
  ];

  return (
    <GlassCard title="Connected Social Media" colors={colors} isDark={isDark}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {socials.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: s.connected
                  ? isDark ? "rgba(255,214,0,0.12)" : "rgba(255,214,0,0.2)"
                  : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: s.connected ? colors.accent : colors.textSecondary,
                flexShrink: 0,
              }}
            >
              <Share2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{s.platform}</div>
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>{s.handle} · {s.followers} followers</div>
            </div>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "100px",
                background: s.connected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: s.connected ? "#22c55e" : colors.textSecondary,
                fontWeight: 600,
              }}
            >
              {s.connected ? "Connected" : "Not linked"}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function TabContacts({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const contacts = [
    { name: "Maya Chen", role: "Gallery Curator", mutual: true },
    { name: "Rico Vega", role: "Muralist", mutual: true },
    { name: "Alex Rivers", role: "Art Director", mutual: false },
    { name: "Priya Sharma", role: "Photographer", mutual: true },
    { name: "DJ Frost", role: "Music Producer", mutual: false },
  ];

  return (
    <GlassCard title={`${profile.display_name}'s Network`} colors={colors} isDark={isDark}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {contacts.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8800 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 800,
                color: "rgba(0,0,0,0.2)",
                flexShrink: 0,
              }}
            >
              {c.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{c.name}</div>
              <div style={{ fontSize: "12px", color: colors.textSecondary }}>{c.role}</div>
            </div>
            {c.mutual && (
              <span style={{ fontSize: "11px", color: colors.accent, fontWeight: 600 }}>Mutual</span>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function TabActivity({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const activities = [
    { action: "Updated portfolio", detail: "Added 3 new mural photos", time: "2 hours ago", type: "update" },
    { action: "Received a review", detail: "5 stars from @maya_chen", time: "1 day ago", type: "review" },
    { action: "Completed a commission", detail: "Mural for Downtown Cafe", time: "3 days ago", type: "completed" },
    { action: "Published a post", detail: "Behind the scenes of latest project", time: "5 days ago", type: "post" },
    { action: "Joined Street Voices", detail: "Welcome to the community!", time: formatDate(profile.created_at), type: "join" },
  ];

  return (
    <GlassCard title="Recent Activity" colors={colors} isDark={isDark}>
      <div style={{ position: "relative", paddingLeft: "24px" }}>
        {/* Timeline line */}
        <div
          style={{
            position: "absolute",
            left: "7px",
            top: "8px",
            bottom: "8px",
            width: "2px",
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {activities.map((a, i) => (
            <div key={i} style={{ position: "relative" }}>
              {/* Timeline dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-21px",
                  top: "4px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: i === 0 ? colors.accent : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                  border: `2px solid ${isDark ? "#1a1a2e" : "#fff"}`,
                }}
              />
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{a.action}</div>
                <div style={{ fontSize: "13px", color: colors.textSecondary, marginTop: "2px" }}>{a.detail}</div>
                <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "4px", opacity: 0.7 }}>
                  <Clock size={11} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                  {a.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function TabStreetGallery({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Artworks created by this specific profile owner
  const ownerName = profile.display_name || "This Creative";
  const artworks = [
    {
      id: "own-1",
      title: "Voices of the Underground",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-voices/600/400",
      medium: "Spray Paint",
      style: "Street Art",
      price: 2800,
      is_for_sale: true,
      is_sold: false,
      view_count: 1247,
      favorite_count: 89,
      comment_count: 12,
    },
    {
      id: "own-2",
      title: "Concrete Canvas — Dundas & Ossington",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-concrete/600/400",
      medium: "Acrylic & Wheat Paste",
      style: "Muralism",
      price: 4500,
      is_for_sale: true,
      is_sold: false,
      view_count: 892,
      favorite_count: 67,
      comment_count: 8,
    },
    {
      id: "own-3",
      title: "Chromatic Rebellion",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-chromatic/600/400",
      medium: "Mixed Media",
      style: "Abstract",
      price: 1200,
      is_for_sale: false,
      is_sold: true,
      view_count: 2034,
      favorite_count: 156,
      comment_count: 23,
    },
    {
      id: "own-4",
      title: "City Pulse — Queen West Series",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-pulse/600/400",
      medium: "Digital Print",
      style: "Contemporary",
      price: 650,
      is_for_sale: true,
      is_sold: false,
      view_count: 534,
      favorite_count: 41,
      comment_count: 5,
    },
    {
      id: "own-5",
      title: "Roots & Routes",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-roots/600/400",
      medium: "Spray Paint & Acrylic",
      style: "Figurative",
      price: 3200,
      is_for_sale: true,
      is_sold: false,
      view_count: 1678,
      favorite_count: 112,
      comment_count: 19,
    },
    {
      id: "own-6",
      title: "Neon Ghosts — Kensington Nights",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-neon/600/400",
      medium: "UV Paint & Projection",
      style: "Installation",
      price: 0,
      is_for_sale: false,
      is_sold: false,
      view_count: 3210,
      favorite_count: 245,
      comment_count: 34,
    },
  ];

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Gallery Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {artworks.map((art, i) => {
          const isFav = favorites.has(art.id);
          return (
            <div
              key={art.id}
              onClick={() => setSelectedImage(i)}
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                cursor: "pointer",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Image with badges */}
              <div style={{ position: "relative", width: "100%", paddingTop: "66%", overflow: "hidden" }}>
                <img
                  src={art.image_url || art.thumbnail_url}
                  alt={art.title}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = "none";
                    const p = t.parentElement;
                    if (p) { p.style.display = "flex"; p.style.alignItems = "center"; p.style.justifyContent = "center"; p.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; p.innerHTML += '<div style="font-size:48px">🖼️</div>'; }
                  }}
                />
                {/* FOR SALE badge */}
                {art.is_for_sale && !art.is_sold && (
                  <div style={{
                    position: "absolute", top: "12px", left: "12px",
                    background: "#22c55e", color: "#fff", fontSize: "11px", fontWeight: 700,
                    padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px",
                  }}>
                    FOR SALE
                  </div>
                )}
                {art.is_sold && (
                  <div style={{
                    position: "absolute", top: "12px", left: "12px",
                    background: "#ef4444", color: "#fff", fontSize: "11px", fontWeight: 700,
                    padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px",
                  }}>
                    SOLD
                  </div>
                )}
                {/* Favorite heart */}
                <button
                  onClick={(e) => toggleFavorite(art.id, e)}
                  style={{
                    position: "absolute", top: "12px", right: "12px",
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: isFav ? "rgba(234, 179, 8, 0.9)" : "rgba(0,0,0,0.4)",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <Heart size={16} fill={isFav ? "#000" : "none"} color={isFav ? "#000" : "#fff"} />
                </button>
              </div>

              {/* Card info */}
              <div style={{ padding: "14px 16px" }}>
                {/* Title + Price */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text, flex: 1 }}>
                    {art.title}
                  </div>
                  {art.is_for_sale && art.price && (
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#eab308", marginLeft: "12px", whiteSpace: "nowrap" }}>
                      ${art.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* Artist */}
                <div style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "10px" }}>
                  by {art.artist_name}
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  {art.medium && (
                    <span style={{
                      fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      color: colors.textSecondary,
                    }}>
                      {art.medium}
                    </span>
                  )}
                  {art.style && (
                    <span style={{
                      fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      color: colors.textSecondary,
                    }}>
                      {art.style}
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: colors.textSecondary }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Eye size={13} /> {art.view_count || 0}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Heart size={13} /> {art.favorite_count || 0}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MessageCircle size={13} /> {art.comment_count || art.comments || 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {selectedImage !== null && artworks[selectedImage] && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "40px",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            style={{
              position: "absolute", top: "20px", right: "20px",
              background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
              width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
          {selectedImage > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(selectedImage - 1); }}
              style={{
                position: "absolute", left: "20px",
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {selectedImage < artworks.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(selectedImage + 1); }}
              style={{
                position: "absolute", right: "20px",
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronRight size={24} />
            </button>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "80vh", textAlign: "center" }}>
            <img
              src={artworks[selectedImage].image_url}
              alt={artworks[selectedImage].title}
              style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: "12px", objectFit: "contain" }}
            />
            <div style={{ color: "#fff", marginTop: "16px", fontSize: "20px", fontWeight: 700 }}>
              {artworks[selectedImage].title}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", marginTop: "6px", fontSize: "14px" }}>
              by {artworks[selectedImage].artist_name} · {artworks[selectedImage].medium} · {artworks[selectedImage].style}
            </div>
            {artworks[selectedImage].is_for_sale && artworks[selectedImage].price && (
              <div style={{ color: "#eab308", marginTop: "8px", fontSize: "18px", fontWeight: 700 }}>
                ${artworks[selectedImage].price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabJobs({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const jobs = [
    {
      title: "Mural Artist for Restaurant Rebrand",
      client: "The Urban Kitchen",
      status: "Active",
      budget: "$3,500",
      deadline: "Apr 30, 2026",
      description: "Looking for a talented muralist to create a vibrant wall piece for our restaurant renovation.",
    },
    {
      title: "Live Art Performance — Music Festival",
      client: "SoundWave Festival",
      status: "Pending Review",
      budget: "$2,000",
      deadline: "May 15, 2026",
      description: "Live painting during the 3-day music festival. Must be comfortable performing in front of large crowds.",
    },
    {
      title: "Street Art Installation — City Commission",
      client: "Toronto Arts Council",
      status: "Completed",
      budget: "$8,000",
      deadline: "Mar 20, 2026",
      description: "Public art installation for the downtown revitalization project. Successfully completed and featured in local media.",
    },
    {
      title: "Brand Mural — Sneaker Store Launch",
      client: "StreetKicks Co.",
      status: "Active",
      budget: "$4,200",
      deadline: "Apr 22, 2026",
      description: "Interior and exterior mural work for a new sneaker retail location.",
    },
  ];

  const statusColor = (s: string) => {
    if (s === "Active") return { color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    if (s === "Completed") return { color: colors.accent, bg: "rgba(255,214,0,0.12)" };
    return { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <GlassCard colors={colors} isDark={isDark}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: colors.text, margin: 0 }}>
            Jobs & Commissions
          </h3>
          <span style={{ fontSize: "13px", color: colors.textSecondary }}>
            {jobs.filter((j) => j.status === "Active").length} active · {jobs.filter((j) => j.status === "Completed").length} completed
          </span>
        </div>
        <p style={{ fontSize: "13px", color: colors.textSecondary, margin: "4px 0 0 0" }}>
          See who is building with {profile.display_name} and current commission work.
        </p>
      </GlassCard>

      {jobs.map((job, i) => {
        const sc = statusColor(job.status);
        return (
          <GlassCard key={i} colors={colors} isDark={isDark}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: colors.text }}>{job.title}</h4>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "3px 10px",
                      borderRadius: "100px",
                      background: sc.bg,
                      color: sc.color,
                      fontWeight: 600,
                    }}
                  >
                    {job.status}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: colors.textSecondary, lineHeight: 1.5 }}>
                  {job.description}
                </p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: colors.textSecondary }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Briefcase size={13} /> {job.client}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={13} /> {job.deadline}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: colors.accent }}>{job.budget}</div>
                {job.status === "Active" && (
                  <button
                    style={{
                      marginTop: "8px",
                      padding: "8px 20px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      color: colors.text,
                      fontWeight: 600,
                      fontSize: "13px",
                      border: `1px solid ${colors.border}`,
                      cursor: "pointer",
                    }}
                  >
                    View Details
                  </button>
                )}
                {job.status === "Completed" && (
                  <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                    <Star size={14} color={colors.accent} fill={colors.accent} />
                    <Star size={14} color={colors.accent} fill={colors.accent} />
                    <Star size={14} color={colors.accent} fill={colors.accent} />
                    <Star size={14} color={colors.accent} fill={colors.accent} />
                    <Star size={14} color={colors.accent} fill={colors.accent} />
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function TabSettings({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const sections = [
    {
      title: "Profile Visibility",
      items: [
        { label: "Public Profile", desc: "Allow anyone to view your profile", enabled: profile.is_public },
        { label: "Show in Directory", desc: "Appear in the Street Profile directory", enabled: true },
        { label: "Show Activity", desc: "Display recent activity on your profile", enabled: true },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "New Followers", desc: "Get notified when someone follows you", enabled: true },
        { label: "Messages", desc: "Receive notifications for new messages", enabled: true },
        { label: "Job Inquiries", desc: "Get notified about new job offers", enabled: true },
        { label: "Community Updates", desc: "Receive Street Voices community news", enabled: false },
      ],
    },
    {
      title: "Privacy",
      items: [
        { label: "Show Email", desc: "Display contact email on profile", enabled: false },
        { label: "Allow Direct Messages", desc: "Let anyone send you messages", enabled: true },
        { label: "Show Online Status", desc: "Display when you are online", enabled: false },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {sections.map((section, si) => (
        <GlassCard key={si} title={section.title} colors={colors} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {section.items.map((item, ii) => (
              <div
                key={ii}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: ii < section.items.length - 1 ? `1px solid ${colors.border}` : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "2px" }}>{item.desc}</div>
                </div>
                {/* Toggle */}
                <div
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "100px",
                    background: item.enabled
                      ? colors.accent
                      : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: item.enabled ? "22px" : "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: item.enabled ? "#000" : isDark ? "#666" : "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
