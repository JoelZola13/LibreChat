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
  Bell,
  RefreshCw,
  CheckCheck,
  Send,
  BookOpen,
  Pin,
  GripVertical,
  FolderOpen,
  ArrowUp,
  ArrowDown,
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
  | "notifications"
  | "academy"
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
  { id: "messages", label: "Messages", icon: <MessageSquare size={16} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  { id: "tasks", label: "Tasks", icon: <CheckSquare size={16} /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
  { id: "documents", label: "Documents", icon: <FileText size={16} /> },
  { id: "storage", label: "Storage", icon: <HardDrive size={16} /> },
  { id: "street-gallery", label: "Street Gallery", icon: <Image size={16} /> },
  { id: "social-media", label: "Social Media", icon: <Share2 size={16} /> },
  { id: "academy", label: "Academy", icon: <BookOpen size={16} /> },
  { id: "activity", label: "Activity", icon: <Activity size={16} /> },
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
  const [bannerUrl, setBannerUrl] = useState<string | null>(profile?.cover_url || null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
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
                background: bannerUrl
                  ? `url(${bannerUrl}) center/cover`
                  : `linear-gradient(135deg, ${colors.accent} 0%, #7c3aed 50%, #2563eb 100%)`,
              }}
            >
              {/* Banner Upload */}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setBannerUrl(url);
                  }
                }}
              />
              <button
                onClick={() => bannerInputRef.current?.click()}
                title="Upload banner image"
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 500,
                  transition: "all 0.2s",
                  zIndex: 5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.7)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}
              >
                <Camera size={16} />
                {bannerUrl ? "Change Banner" : "Add Banner"}
              </button>

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
            {activeTab === "academy" && (
              <TabAcademy profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "activity" && (
              <TabActivity profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "street-gallery" && (
              <TabStreetGallery profile={profile} colors={colors} isDark={isDark} />
            )}
            {activeTab === "notifications" && (
              <TabNotifications profile={profile} colors={colors} isDark={isDark} />
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
      title: "The 25 Most Influential Works of American Protest Art Since World War II",
      source: "The New York Times",
      date: "Apr 5, 2026",
      readTime: "15 min read",
      category: "Culture",
      excerpt: "From the AIDS crisis to Black Lives Matter, how artists have used their work to challenge power and demand change.",
      imageUrl: "https://picsum.photos/seed/nyt-protest/300/200",
      url: "https://www.nytimes.com/2020/10/15/t-magazine/most-influential-protest-art.html",
      saved: true,
    },
    {
      title: "How Banksy Became the World's Most Famous Street Artist",
      source: "BBC Culture",
      date: "Apr 3, 2026",
      readTime: "8 min read",
      category: "Culture",
      excerpt: "The anonymous artist has become a global phenomenon, but the mystery of his identity only adds to his appeal.",
      imageUrl: "https://picsum.photos/seed/bbc-banksy/300/200",
      url: "https://www.bbc.com/culture/article/20210803-how-banksy-became-the-worlds-most-famous-artist",
      saved: true,
    },
    {
      title: "A Practical Guide to Pricing Your Artwork",
      source: "Artwork Archive",
      date: "Mar 28, 2026",
      readTime: "10 min read",
      category: "Business",
      excerpt: "Learn the formulas, strategies, and market research behind pricing your creative work with confidence.",
      imageUrl: "https://picsum.photos/seed/pricing-art/300/200",
      url: "https://www.artworkarchive.com/blog/how-to-price-your-artwork",
      saved: true,
    },
    {
      title: "Street Art Cities: The App Mapping Urban Art Around the World",
      source: "Lonely Planet",
      date: "Mar 22, 2026",
      readTime: "6 min read",
      category: "Opportunities",
      excerpt: "A community-driven platform is documenting murals and street art in over 1,000 cities worldwide.",
      imageUrl: "https://picsum.photos/seed/lp-streetart/300/200",
      url: "https://www.lonelyplanet.com/articles/street-art-cities-app",
      saved: true,
    },
    {
      title: "How to Build an Art Portfolio That Stands Out",
      source: "Creative Bloq",
      date: "Mar 15, 2026",
      readTime: "12 min read",
      category: "Career",
      excerpt: "Industry professionals share their top tips for creating a portfolio that showcases your skills and lands you work.",
      imageUrl: "https://picsum.photos/seed/portfolio-cb/300/200",
      url: "https://www.creativebloq.com/career/how-to-create-a-portfolio-that-will-get-you-hired-71621369",
      saved: true,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {savedArticles.map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            gap: "16px",
            padding: "14px",
            borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: `1px solid ${colors.border}`,
            cursor: "pointer",
            transition: "all 0.2s",
            textDecoration: "none",
            color: "inherit",
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
        </a>
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
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "agenda">("month");
  const [selectedDate, setSelectedDate] = useState<number | null>(today.getDate());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [calendarFilters, setCalendarFilters] = useState({ personal: true, community: true, work: true });

  // Sample events with calendar categories
  const events = [
    { title: "Live Mural Painting — Downtown Arts District", date: 8, month: 3, year: 2026, time: "10:00 AM — 4:00 PM", calendar: "work", color: "#3b82f6" },
    { title: "Portfolio Review with Gallery Owner", date: 11, month: 3, year: 2026, time: "2:00 PM", calendar: "work", color: "#3b82f6" },
    { title: "Street Art Festival — Panel Discussion", date: 15, month: 3, year: 2026, time: "1:00 PM — 3:00 PM", calendar: "community", color: "#22c55e" },
    { title: "Workshop: Spray Can Techniques", date: 20, month: 3, year: 2026, time: "11:00 AM — 1:00 PM", calendar: "work", color: "#3b82f6" },
    { title: "Gallery Opening Night", date: 24, month: 3, year: 2026, time: "7:00 PM — 10:00 PM", calendar: "community", color: "#22c55e" },
    { title: "Commission Deadline — Urban Kitchen", date: 30, month: 3, year: 2026, time: "All Day", calendar: "work", color: "#3b82f6" },
    { title: "Dentist Appointment", date: 14, month: 3, year: 2026, time: "9:30 AM", calendar: "personal", color: "#eab308" },
    { title: "Rent Due", date: 1, month: 3, year: 2026, time: "All Day", calendar: "personal", color: "#eab308" },
    { title: "Community Mural Meetup", date: 29, month: 3, year: 2026, time: "6:00 PM", calendar: "community", color: "#22c55e" },
  ];

  const getEventsForDate = (day: number) => {
    return events.filter((e) => e.date === day && e.month === currentMonth && e.year === currentYear && calendarFilters[e.calendar as keyof typeof calendarFilters]);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); setSelectedDate(today.getDate()); };

  // Mini calendar for sidebar
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  const miniCalDays: Array<{ day: number; currentMonth: boolean }> = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) miniCalDays.push({ day: prevMonthDays - i, currentMonth: false });
  for (let i = 1; i <= daysInMonth; i++) miniCalDays.push({ day: i, currentMonth: true });
  const remaining = 42 - miniCalDays.length;
  for (let i = 1; i <= remaining; i++) miniCalDays.push({ day: i, currentMonth: false });

  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  return (
    <div style={{ display: "flex", gap: "0", minHeight: "700px", borderRadius: "16px", overflow: "hidden", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}` }}>
      {/* Left Sidebar */}
      <div style={{
        width: "240px", flexShrink: 0, padding: "20px",
        background: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)",
        borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
        display: "flex", flexDirection: "column", gap: "20px",
      }}>
        {/* Create Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: "12px 0", borderRadius: "12px", background: colors.accent, color: "#000",
            fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
        >
          + Create
        </button>

        {/* Mini Calendar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <button onClick={prevMonth} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px" }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: "13px", fontWeight: 700, color: colors.text }}>{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={nextMonth} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer", padding: "4px" }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} style={{ fontSize: "10px", fontWeight: 600, color: colors.textSecondary, padding: "4px 0" }}>{d}</div>
            ))}
            {miniCalDays.map((d, i) => (
              <button
                key={i}
                onClick={() => d.currentMonth && setSelectedDate(d.day)}
                style={{
                  fontSize: "11px", padding: "4px 0", border: "none", cursor: d.currentMonth ? "pointer" : "default",
                  borderRadius: "50%", width: "28px", height: "28px", margin: "0 auto",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: d.currentMonth && isToday(d.day) ? colors.accent : d.currentMonth && selectedDate === d.day ? "rgba(234,179,8,0.2)" : "transparent",
                  color: d.currentMonth && isToday(d.day) ? "#000" : d.currentMonth ? colors.text : "rgba(128,128,128,0.3)",
                  fontWeight: isToday(d.day) ? 700 : 400,
                }}
              >
                {d.day}
              </button>
            ))}
          </div>
        </div>

        {/* My Calendars */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: colors.textSecondary, letterSpacing: "0.5px", textTransform: "uppercase" }}>My Calendars</span>
            <span style={{ fontSize: "16px", color: colors.textSecondary, cursor: "pointer" }}>+</span>
          </div>
          {[
            { key: "personal", label: "Personal", color: "#eab308", isDefault: true },
            { key: "community", label: "Community Events", color: "#22c55e", isDefault: false },
            { key: "work", label: "Work", color: "#3b82f6", isDefault: false },
          ].map((cal) => (
            <div
              key={cal.key}
              onClick={() => setCalendarFilters((prev) => ({ ...prev, [cal.key]: !prev[cal.key as keyof typeof prev] }))}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", cursor: "pointer" }}
            >
              <div style={{
                width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${cal.color}`,
                background: calendarFilters[cal.key as keyof typeof calendarFilters] ? cal.color : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {calendarFilters[cal.key as keyof typeof calendarFilters] && <CheckSquare size={12} color="#fff" />}
              </div>
              <span style={{ fontSize: "13px", color: colors.text, fontWeight: 500 }}>{cal.label}</span>
              {cal.isDefault && (
                <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(234,179,8,0.2)", color: "#eab308", fontWeight: 700 }}>Default</span>
              )}
            </div>
          ))}
        </div>

        {/* View All Tasks */}
        <button style={{
          padding: "10px 0", borderRadius: "10px", width: "100%",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          color: colors.text, fontSize: "13px", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}>
          <CheckSquare size={14} /> View All Tasks
        </button>

        {/* Connect Google Calendar */}
        <button style={{
          padding: "10px 0", borderRadius: "10px", width: "100%",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          color: colors.accent, fontSize: "13px", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}>
          ⚡ Connect Google Calendar
        </button>
      </div>

      {/* Main Calendar Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px",
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)",
          flexWrap: "wrap", gap: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Calendar size={18} color={colors.accent} />
            <button onClick={goToToday} style={{
              padding: "6px 16px", borderRadius: "8px",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              color: colors.text, fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}>Today</button>
            <button onClick={prevMonth} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}><ChevronLeft size={18} /></button>
            <button onClick={nextMonth} style={{ background: "none", border: "none", color: colors.textSecondary, cursor: "pointer" }}><ChevronRight size={18} /></button>
            <span style={{ fontSize: "18px", fontWeight: 700, color: colors.text }}>{monthNames[currentMonth]} {currentYear}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {(["month", "week", "day", "agenda"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  background: viewMode === mode ? colors.accent : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  color: viewMode === mode ? "#000" : colors.textSecondary,
                  border: viewMode === mode ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  textTransform: "capitalize",
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                {mode === "month" && <Calendar size={12} />}
                {mode === "agenda" && "≡"}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
            <div style={{ width: "1px", height: "24px", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", margin: "0 4px" }} />
            <button style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              color: colors.textSecondary, display: "flex", alignItems: "center", gap: "4px",
            }}>
              <CheckSquare size={12} /> Task
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                background: colors.accent, border: "none", color: "#000",
                display: "flex", alignItems: "center", gap: "4px",
              }}
            >
              + Event
            </button>
          </div>
        </div>

        {/* Calendar Grid — Month View */}
        {viewMode === "month" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Day Headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
              {dayNames.map((d) => (
                <div key={d} style={{
                  padding: "8px", textAlign: "center", fontSize: "11px", fontWeight: 700,
                  color: colors.textSecondary, letterSpacing: "0.5px",
                }}>{d}</div>
              ))}
            </div>
            {/* Day Cells */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${Math.ceil((firstDayOfMonth + daysInMonth) / 7)}, 1fr)` }}>
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} style={{
                  borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  padding: "6px",
                  background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                }}>
                  <span style={{ fontSize: "12px", color: "rgba(128,128,128,0.3)" }}>{new Date(currentYear, currentMonth, 0).getDate() - firstDayOfMonth + i + 1}</span>
                </div>
              ))}
              {/* Actual days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDate(day);
                const isTodayCell = isToday(day);
                const isSelected = selectedDate === day;
                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    style={{
                      borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                      borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                      padding: "6px", cursor: "pointer", minHeight: "90px",
                      background: isSelected ? (isDark ? "rgba(234,179,8,0.05)" : "rgba(234,179,8,0.05)") : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isTodayCell ? colors.accent : "transparent",
                      color: isTodayCell ? "#000" : colors.text,
                      fontSize: "13px", fontWeight: isTodayCell ? 700 : 400,
                      marginBottom: "4px",
                    }}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map((evt, ei) => (
                      <div key={ei} style={{
                        fontSize: "10px", padding: "2px 6px", borderRadius: "4px", marginBottom: "2px",
                        background: `${evt.color}22`, color: evt.color, fontWeight: 600,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        borderLeft: `2px solid ${evt.color}`,
                      }}>
                        {evt.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div style={{ fontSize: "9px", color: colors.textSecondary, paddingLeft: "6px" }}>+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                );
              })}
              {/* Empty cells after last day */}
              {Array.from({ length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7 }).map((_, i) => (
                <div key={`end-${i}`} style={{
                  borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                  padding: "6px",
                  background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                }}>
                  <span style={{ fontSize: "12px", color: "rgba(128,128,128,0.3)" }}>{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agenda View */}
        {viewMode === "agenda" && (
          <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {events
                .filter((e) => e.month === currentMonth && calendarFilters[e.calendar as keyof typeof calendarFilters])
                .sort((a, b) => a.date - b.date)
                .map((evt, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
                  borderRadius: "12px", background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                  borderLeft: `3px solid ${evt.color}`,
                }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: `${evt.color}22`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Calendar size={18} color={evt.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: colors.text }}>{evt.title}</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>{evt.time}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: colors.accent }}>{monthNames[evt.month].slice(0, 3)} {evt.date}, {evt.year}</div>
                    <div style={{ fontSize: "10px", color: colors.textSecondary, textTransform: "capitalize" }}>{evt.calendar}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week / Day placeholder */}
        {(viewMode === "week" || viewMode === "day") && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
            <div style={{ textAlign: "center" }}>
              <Calendar size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: "16px" }} />
              <div style={{ fontSize: "16px", fontWeight: 600, color: colors.text, marginBottom: "6px" }}>{viewMode === "week" ? "Week" : "Day"} View</div>
              <div style={{ fontSize: "13px", color: colors.textSecondary }}>Switch to Month or Agenda view for full event details</div>
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px", borderRadius: "16px", overflow: "hidden",
              background: isDark ? "rgba(30,30,30,0.98)" : "#fff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              padding: "28px",
            }}
          >
            <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 800, color: colors.text }}>Create Event</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>Event Title</label>
                <input
                  type="text"
                  placeholder="Enter event title..."
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    color: colors.text, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>Date</label>
                  <input
                    type="date"
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                      color: colors.text, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>Time</label>
                  <input
                    type="time"
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                      color: colors.text, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>Calendar</label>
                <select style={{
                  width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  color: colors.text, outline: "none", boxSizing: "border-box",
                }}>
                  <option value="personal">Personal</option>
                  <option value="community">Community Events</option>
                  <option value="work">Work</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>Description</label>
                <textarea
                  placeholder="Add details..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    color: colors.text, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  color: colors.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "10px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  background: colors.accent, border: "none", color: "#000",
                }}
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
  onViewFullPortfolio,
}: {
  profile: StreetProfile;
  colors: any;
  isDark: boolean;
  isMobile: boolean;
  onViewFullPortfolio?: () => void;
}) {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showFullPortfolio, setShowFullPortfolio] = useState(false);
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

        {/* Portfolio Section — Hero Showcase or Full View */}
        <GlassCard title="Portfolio" colors={colors} isDark={isDark}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {(showFullPortfolio ? portfolioWorks : portfolioWorks.slice(0, 3)).map((item: any, i: number) => (
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

          {/* View Full Portfolio button — opens full portfolio overlay */}
          {portfolioWorks.length > 3 && !showFullPortfolio && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "18px" }}>
              <button
                onClick={() => setShowFullPortfolio(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 20px",
                  borderRadius: "20px", border: "none",
                  background: "#eab308", color: "#fff",
                  fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#facc15"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#eab308"; }}
              >
                <Image size={14} /> View Full Portfolio
              </button>
            </div>
          )}
        </GlassCard>

        {/* Full Portfolio Overlay */}
        {showFullPortfolio && (
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.92)", zIndex: 9998,
              overflowY: "auto", backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 60px" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#fff" }}>
                    Full Portfolio
                  </h2>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>
                    {portfolioWorks.length} pieces by {profile.display_name || profile.username}
                  </div>
                </div>
                <button
                  onClick={() => setShowFullPortfolio(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)", color: "#fff",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <X size={16} /> Close
                </button>
              </div>
              {/* Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "20px",
              }}>
                {portfolioWorks.map((item: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedProject(i); setShowFullPortfolio(false); }}
                    style={{
                      borderRadius: "14px", overflow: "hidden", cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      transition: "all 0.3s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ position: "relative", width: "100%", paddingTop: "66%", overflow: "hidden" }}>
                      <img
                        src={item.thumbnail_url || item.image_url}
                        alt={item.title || "Portfolio item"}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                        {item.title || "Untitled"}
                      </div>
                      {(item.category || item.year) && (
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                          {item.category}{item.category && item.year ? " · " : ""}{item.year}
                        </div>
                      )}
                      {item.description && (
                        <div style={{
                          fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "6px", lineHeight: 1.4,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                          overflow: "hidden",
                        }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

        {/* Services */}
        <GlassCard title="Services" colors={colors} isDark={isDark}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { id: "mural-commission", name: "Mural Commission", price: "From $2,500", available: true },
              { id: "live-painting", name: "Live Painting", price: "From $1,000", available: true },
              { id: "art-direction", name: "Art Direction", price: "Custom quote", available: true },
              { id: "workshop-teaching", name: "Workshop / Teaching", price: "From $500", available: false },
            ].map((svc, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: colors.text }}>{svc.name}</span>
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "1px 6px",
                        borderRadius: "100px",
                        background: svc.available ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: svc.available ? "#22c55e" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {svc.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: colors.accent }}>{svc.price}</span>
                </div>
                {svc.available && (
                  <button
                    onClick={() => navigate(`/creatives/${profile.username}/book?service=${svc.id}`)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "8px",
                      background: colors.accent,
                      color: "#000",
                      fontWeight: 700,
                      fontSize: "11px",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Book Now
                  </button>
                )}
              </div>
            ))}
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
  const [selectedSavedImage, setSelectedSavedImage] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [savedFavorites, setSavedFavorites] = useState<Set<string>>(new Set(["saved-1", "saved-2", "saved-3", "saved-4", "saved-5"]));
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set(["own-1"]));
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [artworkOrder, setArtworkOrder] = useState<string[]>(["own-1","own-2","own-3","own-4","own-5","own-6"]);
  const [reorderMode, setReorderMode] = useState(false);
  const [inquiryArt, setInquiryArt] = useState<any | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ name: "", email: "", message: "", offerAmount: "" });
  const [inquirySent, setInquirySent] = useState(false);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  const toggleSavedFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Art saved/bookmarked from other artists in Street Gallery
  const savedArtworks = [
    {
      id: "saved-1",
      title: "Midnight Lotus — Chinatown Series",
      artist_name: "Maya Chen",
      image_url: "https://picsum.photos/seed/saved-lotus/600/400",
      medium: "Spray Paint & Ink",
      style: "Neo-Asian Fusion",
      description: "A striking fusion of traditional Chinese calligraphy and contemporary street art aesthetics. The lotus flower, a symbol of purity and resilience, emerges from layers of spray paint and sumi ink, blending East and West in a vivid nocturnal palette.",
      year: "2025",
      location: "Chinatown, Toronto",
      view_count: 3450,
      favorite_count: 234,
    },
    {
      id: "saved-2",
      title: "Fractures of Light",
      artist_name: "Diego Alvarez",
      image_url: "https://picsum.photos/seed/saved-fractures/600/400",
      medium: "Broken Glass & Resin",
      style: "Installation",
      description: "An installation piece that captures sunlight through fractured glass suspended in clear resin panels. As the sun moves, the piece casts shifting rainbow patterns across the surrounding walls, creating a constantly evolving artwork that changes with the time of day.",
      year: "2024",
      location: "Distillery District, Toronto",
      view_count: 1820,
      favorite_count: 156,
    },
    {
      id: "saved-3",
      title: "Echoes of Harlem",
      artist_name: "Keisha Williams",
      image_url: "https://picsum.photos/seed/saved-harlem/600/400",
      medium: "Acrylic on Brick",
      style: "Social Realism",
      description: "A powerful mural depicting the legacy of Black culture in urban spaces — from jazz musicians to civil rights leaders to modern-day community organizers. Painted directly on exposed brick, the raw texture of the wall becomes part of the narrative.",
      year: "2025",
      location: "Little Jamaica, Toronto",
      view_count: 5670,
      favorite_count: 421,
    },
    {
      id: "saved-4",
      title: "Steel Bloom",
      artist_name: "Tomoko Saito",
      image_url: "https://picsum.photos/seed/saved-bloom/600/400",
      medium: "Welded Metal & Paint",
      style: "Sculpture",
      description: "A 7-foot welded steel sculpture of a flower in bloom, with petals cut from reclaimed industrial metal and hand-painted in gradients of gold and copper. The piece explores the tension between nature and industry, softness and strength.",
      year: "2025",
      location: "Trinity Bellwoods Park, Toronto",
      view_count: 2890,
      favorite_count: 198,
    },
    {
      id: "saved-5",
      title: "Pixels & Pavement",
      artist_name: "Ravi Patel",
      image_url: "https://picsum.photos/seed/saved-pixels/600/400",
      medium: "Digital Projection",
      style: "New Media",
      description: "A cutting-edge new media installation that projects interactive pixel art onto sidewalks. Pedestrians trigger motion sensors that ripple the digital artwork, turning the pavement into a responsive canvas that reacts to the city's foot traffic.",
      year: "2025",
      location: "Yonge-Dundas Square, Toronto",
      view_count: 4120,
      favorite_count: 312,
    },
  ];

  // Artworks created by this specific profile owner
  const ownerName = profile.display_name || "This Creative";
  const artworks = [
    {
      id: "own-1",
      title: "Voices of the Underground",
      artist_name: ownerName,
      image_url: "https://picsum.photos/seed/own-voices/600/400",
      gallery_images: [
        { url: "https://picsum.photos/seed/own-voices/600/400", label: "Main View" },
        { url: "https://picsum.photos/seed/own-voices-close/600/400", label: "Close-Up Detail" },
        { url: "https://picsum.photos/seed/own-voices-context/600/400", label: "In-Situ — Dundas West Underpass" },
        { url: "https://picsum.photos/seed/own-voices-angle/600/400", label: "Side Angle" },
      ],
      medium: "Spray Paint",
      style: "Street Art",
      collection: "Urban Voices",
      description: "A large-scale mural exploring the stories of subway musicians and buskers who form the invisible soundtrack of the city. Each face is rendered in hyper-saturated color, their instruments dissolving into the surrounding architecture — a tribute to artists who perform without stages.",
      year: "2025",
      dimensions: "12ft × 8ft",
      location: "Dundas West Underpass, Toronto",
      tools: ["Montana Gold Spray Paint", "Molotow Markers", "Stencil Cut"],
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
      gallery_images: [
        { url: "https://picsum.photos/seed/own-concrete/600/400", label: "Main View" },
        { url: "https://picsum.photos/seed/own-concrete-wide/600/400", label: "Full Wall — Street Context" },
        { url: "https://picsum.photos/seed/own-concrete-detail/600/400", label: "Wheat Paste Layering Detail" },
      ],
      medium: "Acrylic & Wheat Paste",
      style: "Muralism",
      collection: "Urban Voices",
      description: "Commissioned by the Ossington BIA, this piece transforms a blank concrete wall into a living narrative of the neighborhood's evolution — from its immigrant roots to its current creative renaissance. Layers of wheat-pasted archival photographs blend with hand-painted contemporary portraits.",
      year: "2025",
      dimensions: "20ft × 10ft",
      location: "Ossington Ave, Toronto",
      tools: ["Golden Heavy Body Acrylics", "Wheat Paste", "Archival Inkjet Prints"],
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
      gallery_images: [
        { url: "https://picsum.photos/seed/own-chromatic/600/400", label: "Main View" },
        { url: "https://picsum.photos/seed/own-chromatic-texture/600/400", label: "Texture Close-Up" },
        { url: "https://picsum.photos/seed/own-chromatic-studio/600/400", label: "Studio Installation" },
        { url: "https://picsum.photos/seed/own-chromatic-process/600/400", label: "Process Shot" },
      ],
      medium: "Mixed Media",
      style: "Abstract",
      collection: "Studio Experiments",
      description: "An explosive abstract piece that challenges the sterile minimalism dominating gallery spaces. Built up through dozens of layers — dripped acrylics, torn newsprint, spray enamel, and coffee stains — it represents the beautiful chaos of the creative process itself.",
      year: "2024",
      dimensions: "48\" × 36\" (canvas)",
      location: "Studio Work",
      tools: ["Liquitex Acrylics", "Spray Enamel", "Found Materials", "Coffee"],
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
      gallery_images: [
        { url: "https://picsum.photos/seed/own-pulse/600/400", label: "Main Print" },
        { url: "https://picsum.photos/seed/own-pulse-framed/600/400", label: "Framed — Gallery Display" },
        { url: "https://picsum.photos/seed/own-pulse-detail/600/400", label: "Print Detail — Ink Layers" },
      ],
      medium: "Digital Print",
      style: "Contemporary",
      collection: "City Pulse Series",
      description: "Part of a limited edition series capturing the energy of Queen West at different times of day. This piece layers long-exposure street photography with hand-drawn illustrations, printed on archival cotton rag paper. Edition of 25.",
      year: "2025",
      dimensions: "24\" × 18\"",
      location: "Queen West, Toronto",
      tools: ["Canon R5", "Procreate", "Epson Ultrachrome Inks"],
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
      gallery_images: [
        { url: "https://picsum.photos/seed/own-roots/600/400", label: "Main View" },
        { url: "https://picsum.photos/seed/own-roots-close/600/400", label: "Face Detail — Central Figure" },
        { url: "https://picsum.photos/seed/own-roots-environment/600/400", label: "In-Situ — Kensington Market" },
        { url: "https://picsum.photos/seed/own-roots-night/600/400", label: "Night Lighting" },
      ],
      medium: "Spray Paint & Acrylic",
      style: "Figurative",
      collection: "Urban Voices",
      description: "A deeply personal piece exploring the artist's journey between cultures. Tree roots morph into subway maps, while branches become flight paths — connecting the places that shaped the artist's identity. The central figure stands at the crossroads, grounded but reaching upward.",
      year: "2024",
      dimensions: "15ft × 9ft",
      location: "Kensington Market, Toronto",
      tools: ["Montana Black", "Nova Color Acrylics", "Paint Rollers"],
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
      gallery_images: [
        { url: "https://picsum.photos/seed/own-neon/600/400", label: "Daytime View — UV Paint" },
        { url: "https://picsum.photos/seed/own-neon-glow/600/400", label: "Night Activation — UV Glow" },
        { url: "https://picsum.photos/seed/own-neon-proj/600/400", label: "Projection Mapping Detail" },
        { url: "https://picsum.photos/seed/own-neon-walk/600/400", label: "Visitor Walking Through" },
        { url: "https://picsum.photos/seed/own-neon-above/600/400", label: "Aerial View — Full Corridor" },
      ],
      medium: "UV Paint & Projection",
      style: "Installation",
      collection: "City Pulse Series",
      description: "An immersive night installation that transforms an alleyway into a glowing portal. UV-reactive paint on the walls activates under blacklight, while a projection maps animated spirits onto the architecture. Visitors walk through the piece, becoming part of the artwork themselves.",
      year: "2025",
      dimensions: "Site-Specific (30ft corridor)",
      location: "Kensington Market, Toronto",
      tools: ["UV Reactive Paint", "Resolume Arena", "Epson Projector", "Arduino"],
      price: 0,
      is_for_sale: false,
      is_sold: false,
      view_count: 3210,
      favorite_count: 245,
      comment_count: 34,
    },
  ];

  // Derive collections from artworks
  const collections = useMemo(() => {
    const collMap = new Map<string, number>();
    artworks.forEach(a => {
      if (a.collection) collMap.set(a.collection, (collMap.get(a.collection) || 0) + 1);
    });
    return Array.from(collMap.entries()).map(([name, count]) => ({ name, count }));
  }, []);

  // Sort artworks: pinned first, then by custom order
  const sortedArtworks = useMemo(() => {
    let filtered = collectionFilter === "all" ? [...artworks] : artworks.filter(a => a.collection === collectionFilter);
    filtered.sort((a, b) => {
      const aPin = pinnedIds.has(a.id) ? 0 : 1;
      const bPin = pinnedIds.has(b.id) ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      return artworkOrder.indexOf(a.id) - artworkOrder.indexOf(b.id);
    });
    return filtered;
  }, [collectionFilter, pinnedIds, artworkOrder]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveArtwork = (id: string, direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    setArtworkOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

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
      {/* ── Collection Filter & Reorder Controls ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "20px",
      }}>
        {/* Collection filter pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1 }}>
          <FolderOpen size={16} color={colors.textSecondary} />
          <button
            onClick={() => setCollectionFilter("all")}
            style={{
              padding: "5px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600,
              background: collectionFilter === "all" ? "#eab308" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
              color: collectionFilter === "all" ? "#000" : colors.textSecondary,
              transition: "all 0.2s",
            }}
          >
            All ({artworks.length})
          </button>
          {collections.map(c => (
            <button
              key={c.name}
              onClick={() => setCollectionFilter(collectionFilter === c.name ? "all" : c.name)}
              style={{
                padding: "5px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 600,
                background: collectionFilter === c.name ? "#eab308" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                color: collectionFilter === c.name ? "#000" : colors.textSecondary,
                transition: "all 0.2s",
              }}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        {/* Reorder toggle */}
        <button
          onClick={() => setReorderMode(!reorderMode)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontSize: "12px", fontWeight: 600,
            background: reorderMode ? "rgba(234,179,8,0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
            color: reorderMode ? "#eab308" : colors.textSecondary,
            transition: "all 0.2s",
          }}
        >
          <GripVertical size={14} /> {reorderMode ? "Done Reordering" : "Reorder"}
        </button>
      </div>

      {/* Gallery Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {sortedArtworks.map((art) => {
          const isFav = favorites.has(art.id);
          const isPinned = pinnedIds.has(art.id);
          const originalIndex = artworks.findIndex(a => a.id === art.id);
          return (
            <div
              key={art.id}
              onClick={() => !reorderMode && setSelectedImage(originalIndex)}
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
                border: isPinned
                  ? "2px solid rgba(234,179,8,0.5)"
                  : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                cursor: reorderMode ? "default" : "pointer",
                transition: "all 0.3s",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (!reorderMode) { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Image with badges */}
              <div style={{ position: "relative", width: "100%", paddingTop: "66%", overflow: "hidden" }}>
                <img
                  src={art.image_url || (art as any).thumbnail_url}
                  alt={art.title}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = "none";
                    const p = t.parentElement;
                    if (p) { p.style.display = "flex"; p.style.alignItems = "center"; p.style.justifyContent = "center"; p.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; p.innerHTML += '<div style="font-size:48px">🖼️</div>'; }
                  }}
                />
                {/* Pinned badge */}
                {isPinned && (
                  <div style={{
                    position: "absolute", top: "12px", left: art.is_for_sale || art.is_sold ? "auto" : "12px",
                    right: art.is_for_sale || art.is_sold ? "56px" : "auto",
                    ...(art.is_for_sale || art.is_sold ? { top: "12px", left: "auto" } : {}),
                    background: "rgba(234,179,8,0.9)", color: "#000", fontSize: "10px", fontWeight: 700,
                    padding: "3px 8px", borderRadius: "5px", letterSpacing: "0.5px",
                    display: "flex", alignItems: "center", gap: "3px", zIndex: 2,
                  }}>
                    <Pin size={10} /> PINNED
                  </div>
                )}
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
                {/* Reorder controls overlay */}
                {reorderMode && (
                  <div style={{
                    position: "absolute", bottom: "10px", right: "10px",
                    display: "flex", gap: "6px", zIndex: 3,
                  }}>
                    <button
                      onClick={(e) => togglePin(art.id, e)}
                      title={isPinned ? "Unpin" : "Pin to top"}
                      style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: isPinned ? "rgba(234,179,8,0.9)" : "rgba(0,0,0,0.6)",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Pin size={14} color={isPinned ? "#000" : "#fff"} />
                    </button>
                    <button
                      onClick={(e) => moveArtwork(art.id, "up", e)}
                      title="Move up"
                      style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowUp size={14} color="#fff" />
                    </button>
                    <button
                      onClick={(e) => moveArtwork(art.id, "down", e)}
                      title="Move down"
                      style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ArrowDown size={14} color="#fff" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card info */}
              <div style={{ padding: "14px 16px" }}>
                {/* Title + Price */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text, flex: 1 }}>
                    {art.title}
                  </div>
                  {art.is_for_sale && !art.is_sold && art.price && (
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#eab308", marginLeft: "12px", whiteSpace: "nowrap" }}>
                      ${art.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  {art.is_sold && art.price && (
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(239,68,68,0.8)", marginLeft: "12px", whiteSpace: "nowrap" }}>
                      Sold for ${art.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* Artist */}
                <div style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "6px" }}>
                  by {art.artist_name}
                </div>

                {/* Description snippet */}
                <div style={{
                  fontSize: "12px", color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                  marginBottom: "10px", lineHeight: "1.5",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {art.description}
                </div>

                {/* Inquire button for pieces that are for sale */}
                {art.is_for_sale && !art.is_sold && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInquiryArt(art);
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "6px 16px",
                      borderRadius: "8px", border: "none",
                      background: "#eab308", color: "#fff",
                      fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#facc15"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#eab308"; }}
                  >
                    <Mail size={13} /> Inquire
                  </button>
                  </div>
                )}

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  {art.collection && (
                    <span style={{
                      fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
                      background: "rgba(234,179,8,0.15)", color: "#eab308", fontWeight: 600,
                    }}>
                      {art.collection}
                    </span>
                  )}
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
                    <MessageCircle size={13} /> {art.comment_count || (art as any).comments || 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Saved Art Section ── */}
      <div style={{ marginTop: "48px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px",
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
          paddingTop: "32px",
        }}>
          <Bookmark size={20} color="#eab308" />
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: colors.text }}>
            Saved Art
          </h3>
          <span style={{
            fontSize: "12px", padding: "3px 10px", borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            color: colors.textSecondary,
          }}>
            {savedArtworks.length} pieces
          </span>
        </div>
        <p style={{ fontSize: "14px", color: colors.textSecondary, marginBottom: "20px", marginTop: 0 }}>
          Art from other creatives in the Street Gallery that you've saved for inspiration.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
          {savedArtworks.map((art, i) => {
            const isFav = savedFavorites.has(art.id);
            return (
              <div
                key={art.id}
                onClick={() => setSelectedSavedImage(i)}
                style={{
                  borderRadius: "14px",
                  overflow: "hidden",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  cursor: "pointer",
                  transition: "all 0.3s",
                  position: "relative",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Image */}
                <div style={{ position: "relative", width: "100%", paddingTop: "66%", overflow: "hidden" }}>
                  <img
                    src={art.image_url}
                    alt={art.title}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                      const p = t.parentElement;
                      if (p) { p.style.display = "flex"; p.style.alignItems = "center"; p.style.justifyContent = "center"; p.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"; p.innerHTML += '<div style="font-size:48px">🖼️</div>'; }
                    }}
                  />
                  {/* Saved badge */}
                  <div style={{
                    position: "absolute", top: "10px", left: "10px",
                    background: "rgba(234,179,8,0.9)", color: "#000", fontSize: "10px", fontWeight: 700,
                    padding: "3px 8px", borderRadius: "5px", letterSpacing: "0.5px",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    <Bookmark size={10} fill="#000" /> SAVED
                  </div>
                  {/* Unsave button */}
                  <button
                    onClick={(e) => toggleSavedFavorite(art.id, e)}
                    style={{
                      position: "absolute", top: "10px", right: "10px",
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: isFav ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.4)",
                      border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <Heart size={14} fill={isFav ? "#fff" : "none"} color="#fff" />
                  </button>
                </div>

                {/* Card info */}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: colors.text, marginBottom: "4px" }}>
                    {art.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#eab308", marginBottom: "6px", fontWeight: 600 }}>
                    by {art.artist_name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
                    {art.medium && (
                      <span style={{
                        fontSize: "10px", padding: "2px 8px", borderRadius: "5px",
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        color: colors.textSecondary,
                      }}>
                        {art.medium}
                      </span>
                    )}
                    {art.style && (
                      <span style={{
                        fontSize: "10px", padding: "2px 8px", borderRadius: "5px",
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        color: colors.textSecondary,
                      }}>
                        {art.style}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: colors.textSecondary }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <Eye size={12} /> {art.view_count || 0}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <Heart size={12} /> {art.favorite_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Saved Art Project Detail Modal ── */}
      {selectedSavedImage !== null && savedArtworks[selectedSavedImage] && (() => {
        const sArt = savedArtworks[selectedSavedImage];
        const isSavedFav = savedFavorites.has(sArt.id);
        return (
          <div
            onClick={() => setSelectedSavedImage(null)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-start", justifyContent: "center",
              zIndex: 9999, overflowY: "auto", padding: "40px 20px",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedSavedImage(null); }}
              style={{
                position: "fixed", top: "20px", right: "20px",
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                width: "44px", height: "44px", borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
              }}
            >
              <X size={22} />
            </button>
            {selectedSavedImage > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSavedImage(selectedSavedImage - 1); }}
                style={{
                  position: "fixed", left: "20px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                  width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {selectedSavedImage < savedArtworks.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSavedImage(selectedSavedImage + 1); }}
                style={{
                  position: "fixed", right: "20px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                  width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "900px", width: "100%", borderRadius: "16px", overflow: "hidden",
                background: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Hero Image */}
              <div style={{ width: "100%", position: "relative" }}>
                <img
                  src={sArt.image_url}
                  alt={sArt.title}
                  style={{ width: "100%", maxHeight: "60vh", objectFit: "cover", display: "block" }}
                />
                <div style={{
                  position: "absolute", top: "16px", left: "16px",
                  background: "rgba(234,179,8,0.9)", color: "#000", fontSize: "11px", fontWeight: 700,
                  padding: "4px 10px", borderRadius: "6px",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  <Bookmark size={11} fill="#000" /> SAVED
                </div>
              </div>

              {/* Project Info */}
              <div style={{ padding: "32px 36px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                    {sArt.title}
                  </h2>
                  <button
                    onClick={() => toggleSavedFavorite(sArt.id, { stopPropagation: () => {} } as React.MouseEvent)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "8px",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <Heart size={22} fill={isSavedFav ? "#ef4444" : "none"} color={isSavedFav ? "#ef4444" : "#fff"} />
                    <span style={{ color: isSavedFav ? "#ef4444" : "rgba(255,255,255,0.6)", fontSize: "14px" }}>
                      {sArt.favorite_count}
                    </span>
                  </button>
                </div>

                <div style={{ fontSize: "15px", color: "#eab308", fontWeight: 600, marginBottom: "16px" }}>
                  by {sArt.artist_name}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "24px" }}>
                  {sArt.year && <span>📅 {sArt.year}</span>}
                  {sArt.location && <span>📍 {sArt.location}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Eye size={13} /> {sArt.view_count}</span>
                </div>

                {/* Description */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px", marginBottom: "24px" }}>
                  <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
                    About This Piece
                  </h4>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px", lineHeight: 1.7, margin: 0 }}>
                    {sArt.description}
                  </p>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                  {sArt.medium && (
                    <span style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "8px",
                      background: "rgba(234,179,8,0.15)", color: "#eab308", fontWeight: 600,
                    }}>
                      {sArt.medium}
                    </span>
                  )}
                  {sArt.style && (
                    <span style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "8px",
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                    }}>
                      {sArt.style}
                    </span>
                  )}
                </div>

                {/* Artist Card */}
                <div style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px",
                  display: "flex", alignItems: "center", gap: "14px",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #eab308, #f59e0b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px", fontWeight: 700, color: "#000",
                  }}>
                    {sArt.artist_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{sArt.artist_name}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                      Street Gallery Artist
                    </div>
                  </div>
                  <button style={{
                    marginLeft: "auto", padding: "8px 20px", borderRadius: "8px",
                    background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)",
                    color: "#eab308", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  }}>
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Full Project Detail Modal (Behance-style) ── */}
      {selectedImage !== null && artworks[selectedImage] && (() => {
        const art = artworks[selectedImage];
        const isFav = favorites.has(art.id);
        const photos = art.gallery_images || [{ url: art.image_url, label: "Main View" }];
        return (
          <div
            onClick={() => { setSelectedImage(null); setDetailPhotoIndex(0); }}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-start", justifyContent: "center",
              zIndex: 9999, overflowY: "auto", padding: "40px 20px",
            }}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setDetailPhotoIndex(0); }}
              style={{
                position: "fixed", top: "20px", right: "20px",
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                width: "44px", height: "44px", borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
              }}
            >
              <X size={22} />
            </button>
            {/* Nav arrows */}
            {selectedImage > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedImage(selectedImage - 1); setDetailPhotoIndex(0); }}
                style={{
                  position: "fixed", left: "20px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                  width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {selectedImage < artworks.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedImage(selectedImage + 1); setDetailPhotoIndex(0); }}
                style={{
                  position: "fixed", right: "20px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                  width: "48px", height: "48px", borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Project Detail Content */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "900px", width: "100%", borderRadius: "16px", overflow: "hidden",
                background: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Hero Image with multi-photo nav */}
              <div style={{ width: "100%", position: "relative" }}>
                <img
                  src={photos[detailPhotoIndex]?.url || art.image_url}
                  alt={`${art.title} — ${photos[detailPhotoIndex]?.label || "View"}`}
                  style={{ width: "100%", maxHeight: "60vh", objectFit: "cover", display: "block" }}
                />
                {/* Photo label */}
                <div style={{
                  position: "absolute", bottom: "16px", left: "16px",
                  background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "12px", fontWeight: 500,
                  padding: "5px 12px", borderRadius: "8px", backdropFilter: "blur(8px)",
                }}>
                  {photos[detailPhotoIndex]?.label} · {detailPhotoIndex + 1}/{photos.length}
                </div>
                {/* Photo nav arrows */}
                {photos.length > 1 && detailPhotoIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailPhotoIndex(detailPhotoIndex - 1); }}
                    style={{
                      position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
                      width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                {photos.length > 1 && detailPhotoIndex < photos.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailPhotoIndex(detailPhotoIndex + 1); }}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
                      width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
                {/* Badges on image */}
                {art.is_for_sale && !art.is_sold && (
                  <div style={{
                    position: "absolute", top: "16px", left: "16px",
                    background: "#22c55e", color: "#fff", fontSize: "12px", fontWeight: 700,
                    padding: "5px 12px", borderRadius: "8px",
                  }}>
                    FOR SALE — ${art.price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                )}
                {art.is_sold && (
                  <div style={{
                    position: "absolute", top: "16px", left: "16px",
                    background: "#ef4444", color: "#fff", fontSize: "12px", fontWeight: 700,
                    padding: "5px 12px", borderRadius: "8px",
                  }}>
                    SOLD — ${art.price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>

              {/* Thumbnail strip for multi-photo */}
              {photos.length > 1 && (
                <div style={{
                  display: "flex", gap: "8px", padding: "12px 16px",
                  overflowX: "auto", background: "rgba(0,0,0,0.4)",
                }}>
                  {photos.map((photo: any, pi: number) => (
                    <button
                      key={pi}
                      onClick={() => setDetailPhotoIndex(pi)}
                      style={{
                        width: "72px", height: "48px", borderRadius: "6px", overflow: "hidden",
                        border: pi === detailPhotoIndex ? "2px solid #eab308" : "2px solid transparent",
                        cursor: "pointer", flexShrink: 0, padding: 0, background: "none",
                        opacity: pi === detailPhotoIndex ? 1 : 0.6,
                        transition: "all 0.2s",
                      }}
                    >
                      <img src={photo.url} alt={photo.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Project Info */}
              <div style={{ padding: "32px 36px" }}>
                {/* Title row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                    {art.title}
                  </h2>
                  <button
                    onClick={() => toggleFavorite(art.id, { stopPropagation: () => {} } as React.MouseEvent)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "8px",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <Heart size={22} fill={isFav ? "#ef4444" : "none"} color={isFav ? "#ef4444" : "#fff"} />
                    <span style={{ color: isFav ? "#ef4444" : "rgba(255,255,255,0.6)", fontSize: "14px" }}>
                      {art.favorite_count + (isFav ? 1 : 0)}
                    </span>
                  </button>
                </div>

                {/* Artist + meta */}
                <div style={{ fontSize: "15px", color: "#eab308", fontWeight: 600, marginBottom: "16px" }}>
                  by {art.artist_name}
                </div>

                {/* Price + Inquire row for detail view */}
                {art.is_for_sale && !art.is_sold && art.price && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px",
                    padding: "16px 20px", borderRadius: "12px",
                    background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>Asking Price</div>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#eab308" }}>
                        ${art.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedImage(null); setDetailPhotoIndex(0); setInquiryArt(art); }}
                      style={{
                        padding: "10px 24px", borderRadius: "10px", border: "none",
                        background: "#eab308", color: "#000", fontSize: "14px", fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#facc15"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#eab308"; }}
                    >
                      <Mail size={16} /> Inquire
                    </button>
                  </div>
                )}
                {art.is_sold && art.price && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px",
                    padding: "14px 20px", borderRadius: "12px",
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  }}>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginRight: "4px" }}>Sold for</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#ef4444" }}>
                      ${art.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "24px" }}>
                  {art.year && <span>📅 {art.year}</span>}
                  {art.dimensions && <span>📐 {art.dimensions}</span>}
                  {art.location && <span>📍 {art.location}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Eye size={13} /> {art.view_count}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MessageCircle size={13} /> {art.comment_count}</span>
                </div>

                {/* Description */}
                <div style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px", marginBottom: "24px",
                }}>
                  <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
                    About This Piece
                  </h4>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px", lineHeight: 1.7, margin: 0 }}>
                    {art.description}
                  </p>
                </div>

                {/* Medium & Style tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                  {art.collection && (
                    <span style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "8px",
                      background: "rgba(234,179,8,0.15)", color: "#eab308", fontWeight: 600,
                    }}>
                      {art.collection}
                    </span>
                  )}
                  {art.medium && (
                    <span style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "8px",
                      background: "rgba(234,179,8,0.15)", color: "#eab308", fontWeight: 600,
                    }}>
                      {art.medium}
                    </span>
                  )}
                  {art.style && (
                    <span style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "8px",
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                    }}>
                      {art.style}
                    </span>
                  )}
                </div>

                {/* Tools & Materials */}
                {art.tools && art.tools.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" }}>
                      Tools & Materials
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {art.tools.map((tool: string) => (
                        <span key={tool} style={{
                          fontSize: "11px", padding: "4px 12px", borderRadius: "6px",
                          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artist Card */}
                <div style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px",
                  display: "flex", alignItems: "center", gap: "14px",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #eab308, #f59e0b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px", fontWeight: 700, color: "#000",
                  }}>
                    {art.artist_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{art.artist_name}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                      {profile.primary_roles?.[0] || "Creative"} · {profile.city || "Toronto"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Inquiry / Make an Offer Modal ── */}
      {inquiryArt && (
        <div
          onClick={() => { setInquiryArt(null); setInquirySent(false); setInquiryForm({ name: "", email: "", message: "", offerAmount: "" }); }}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10002, padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "520px", width: "100%", borderRadius: "16px", overflow: "hidden",
              background: isDark ? "rgba(30,30,30,0.98)" : "#fff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
            }}
          >
            {/* Header */}
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: colors.text }}>
                  {inquirySent ? "Inquiry Sent!" : "Inquire About This Piece"}
                </h3>
                <div style={{ fontSize: "13px", color: colors.textSecondary, marginTop: "4px" }}>
                  {inquiryArt.title}
                </div>
              </div>
              <button
                onClick={() => { setInquiryArt(null); setInquirySent(false); setInquiryForm({ name: "", email: "", message: "", offerAmount: "" }); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px" }}>
              {inquirySent ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
                  <p style={{ fontSize: "15px", color: colors.text, fontWeight: 600, marginBottom: "8px" }}>
                    Your inquiry has been sent to {inquiryArt.artist_name}!
                  </p>
                  <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>
                    They'll get back to you via email. Check your inbox for updates.
                  </p>
                </div>
              ) : (
                <>
                  {/* Piece summary */}
                  <div style={{
                    display: "flex", gap: "14px", marginBottom: "20px", padding: "14px",
                    borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  }}>
                    <img src={inquiryArt.image_url} alt="" style={{ width: "80px", height: "56px", borderRadius: "8px", objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: colors.text }}>{inquiryArt.title}</div>
                      <div style={{ fontSize: "12px", color: colors.textSecondary }}>by {inquiryArt.artist_name}</div>
                      {inquiryArt.price && (
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#eab308", marginTop: "4px" }}>
                          ${inquiryArt.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form fields */}
                  {[
                    { key: "name", label: "Your Name", placeholder: "Full name", type: "text" },
                    { key: "email", label: "Email", placeholder: "your@email.com", type: "email" },
                    { key: "offerAmount", label: "Your Offer (optional)", placeholder: "e.g. $2,000", type: "text" },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key} style={{ marginBottom: "14px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>
                        {label}
                      </label>
                      <input
                        type={type}
                        value={(inquiryForm as any)[key]}
                        onChange={(e) => setInquiryForm(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{
                          width: "100%", padding: "10px 14px", borderRadius: "8px",
                          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                          color: colors.text, fontSize: "14px", outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: colors.textSecondary, display: "block", marginBottom: "6px" }}>
                      Message
                    </label>
                    <textarea
                      value={inquiryForm.message}
                      onChange={(e) => setInquiryForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="I'm interested in this piece. I'd love to know more about..."
                      rows={4}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "8px", resize: "vertical",
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        color: colors.text, fontSize: "14px", outline: "none", fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <button
                    onClick={() => setInquirySent(true)}
                    disabled={!inquiryForm.name || !inquiryForm.email || !inquiryForm.message}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: "10px", border: "none",
                      background: (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) ? "rgba(234,179,8,0.3)" : "#eab308",
                      color: (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) ? "rgba(0,0,0,0.4)" : "#000",
                      fontSize: "14px", fontWeight: 700, cursor: (!inquiryForm.name || !inquiryForm.email || !inquiryForm.message) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      transition: "all 0.2s",
                    }}
                  >
                    <Send size={16} /> Send Inquiry
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabJobs({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [jobFilter, setJobFilter] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [applyingJob, setApplyingJob] = useState<any | null>(null);
  const [applyForm, setApplyForm] = useState({ name: "", email: "", phone: "", message: "", portfolio: "" });
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [reminderToast, setReminderToast] = useState<{ jobTitle: string; deadline: string } | null>(null);
  const [sharingJob, setSharingJob] = useState<any | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const toggleReminder = (jobId: string, jobTitle: string, deadline: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        setReminderToast(null);
      } else {
        next.add(jobId);
        setReminderToast({ jobTitle, deadline });
        setTimeout(() => setReminderToast(null), 4000);
      }
      return next;
    });
  };

  const toggleSaveJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const jobs = [
    {
      id: "job-1",
      title: "Youth Media Producer",
      company: "Black Voices Media Collective",
      type: "PART-TIME",
      banner_color: "#1a1a2e",
      banner_text_color: "#fff",
      accent_color: "#eab308",
      image_url: "https://picsum.photos/seed/job-media/600/300",
      description: "Create engaging multimedia content that amplifies Black youth voices and experiences. Work with a team of creatives to produce podcasts, videos, and social media content.",
      full_description: "Black Voices Media Collective is looking for a passionate Youth Media Producer to join our creative team. You will help produce podcasts, short-form videos, social media reels, and written content that centers Black youth perspectives in Toronto.\n\nThis is a paid, part-time role ideal for emerging creatives aged 16-29 who want hands-on experience in media production. Full training is provided — no formal experience required. You'll work alongside experienced producers, editors, and community organizers in a supportive, youth-led environment.\n\nThe role includes access to professional-grade equipment, mentorship from industry professionals, and opportunities to have your work published across our platforms reaching 50,000+ monthly viewers.",
      qualifications: ["Basic video/audio editing skills", "Interest in storytelling & media", "Age 16-29", "No formal experience required"],
      responsibilities: ["Produce 2-3 short-form videos per week for social media", "Assist with podcast recording, editing, and publishing", "Attend weekly team meetings and creative brainstorms", "Participate in community events for content capture", "Collaborate with writers, designers, and other producers"],
      how_to_apply: "Submit your resume and a short portfolio (links to any videos, social posts, or creative work you've made — even personal projects count!) to careers@blackvoicesmedia.ca. Include a brief paragraph about why this role interests you. Applications are reviewed on a rolling basis.",
      contact_email: "careers@blackvoicesmedia.ca",
      posted_date: "Mar 15, 2026",
      tags: [
        { label: "Black-Led", color: "#ef4444", icon: "org" },
        { label: "No Experience", color: "#8b5cf6", icon: "sparkle" },
        { label: "Training", color: "#22c55e", icon: "training" },
        { label: "Creative", color: "#f97316", icon: "creative" },
        { label: "Media", color: "#3b82f6", icon: "media" },
      ],
      location: "Toronto, ON",
      salary: "$20-$25/hour",
      deadline: "Apr 30, 2026",
    },
    {
      id: "job-2",
      title: "Youth Outreach Worker",
      company: "Street Voices Community Services",
      type: "FULL-TIME",
      banner_color: "#f59e0b",
      banner_text_color: "#000",
      accent_color: "#f59e0b",
      image_url: "https://picsum.photos/seed/job-outreach/600/300",
      description: "Connect with youth experiencing homelessness and provide support, resources, and pathways to stability through creative engagement programs.",
      full_description: "Street Voices Community Services is hiring a full-time Youth Outreach Worker to connect with young people (ages 16-29) experiencing homelessness, housing insecurity, or other barriers in the Greater Toronto Area.\n\nYou will meet youth where they are — on the streets, in shelters, at drop-ins — and build trusting relationships that help them access housing, healthcare, employment, and creative programs. This role is rooted in harm reduction, trauma-informed care, and a strengths-based approach.\n\nLived experience with housing insecurity, the justice system, or mental health challenges is valued and considered an asset. Comprehensive training and ongoing supervision are provided.",
      qualifications: ["Lived experience with housing insecurity preferred", "Strong communication skills", "First Aid certification an asset", "Training provided"],
      responsibilities: ["Conduct street-level outreach across downtown Toronto", "Build rapport and trust with youth in crisis", "Connect youth to shelter, housing, and health resources", "Maintain case notes and documentation", "Participate in team debriefs and clinical supervision"],
      how_to_apply: "Send your resume and cover letter to hr@streetvoices.org with the subject line 'Youth Outreach Worker Application'. We encourage applications from people with lived experience. Accommodations are available upon request throughout the hiring process.",
      contact_email: "hr@streetvoices.org",
      posted_date: "Mar 22, 2026",
      tags: [
        { label: "No Experience", color: "#8b5cf6", icon: "sparkle" },
        { label: "Training", color: "#22c55e", icon: "training" },
      ],
      location: "Toronto, ON",
      salary: "$45,000-$55,000/year",
      deadline: "May 19, 2026",
    },
    {
      id: "job-3",
      title: "Peer Support Specialist",
      company: "Youth Wellness Hub",
      type: "PART-TIME",
      banner_color: "#14b8a6",
      banner_text_color: "#fff",
      accent_color: "#14b8a6",
      image_url: "https://picsum.photos/seed/job-peer/600/300",
      description: "Use your lived experience to support other young people navigating mental health challenges. Facilitate peer support groups and one-on-one sessions.",
      full_description: "Youth Wellness Hub is seeking a compassionate Peer Support Specialist to work with young people ages 18-29 who are navigating mental health and substance use challenges in Hamilton, ON.\n\nAs a peer specialist, you will draw on your own lived experience to build trust, reduce stigma, and help youth develop coping strategies. You'll facilitate weekly peer support groups, provide one-on-one check-ins, and connect youth to clinical services when needed.\n\nThis is a meaningful role for someone who has walked a similar path and wants to use their journey to help others. Full peer support certification training is provided through the Ontario Peer Development Initiative.",
      qualifications: ["Lived experience with mental health challenges", "Empathy and active listening", "Age 18-29", "Peer support training provided"],
      responsibilities: ["Facilitate 2-3 peer support groups per week", "Provide one-on-one peer check-ins", "Support youth in setting wellness goals", "Maintain confidential session notes", "Attend weekly clinical supervision"],
      how_to_apply: "Apply online at youthwellnesshub.ca/careers or email your resume to jobs@youthwellnesshub.ca. In your application, briefly share why peer support matters to you (1-2 paragraphs). We value lived experience and do not require a degree.",
      contact_email: "jobs@youthwellnesshub.ca",
      posted_date: "Mar 10, 2026",
      tags: [
        { label: "No Experience", color: "#8b5cf6", icon: "sparkle" },
        { label: "Training", color: "#22c55e", icon: "training" },
      ],
      location: "Hamilton, ON",
      salary: "$22-$26/hour",
      deadline: "Apr 15, 2026",
    },
    {
      id: "job-4",
      title: "Mural Artist — Restaurant Rebrand",
      company: "The Urban Kitchen",
      type: "COMMISSION",
      banner_color: "#7c3aed",
      banner_text_color: "#fff",
      accent_color: "#7c3aed",
      image_url: "https://picsum.photos/seed/job-mural/600/300",
      description: "Looking for a talented muralist to create a vibrant wall piece for our restaurant renovation. Must have experience with large-scale indoor murals.",
      full_description: "The Urban Kitchen is undergoing a full rebrand and we're looking for a talented muralist to create a vibrant, eye-catching wall piece for our main dining area.\n\nThe mural should reflect our brand values: community, culture, and fresh ingredients. We're open to styles ranging from realistic to abstract, but want something bold that becomes a conversation piece and Instagram-worthy backdrop for our guests.\n\nThe wall is approximately 12ft x 8ft. The artist will have full creative freedom within the agreed concept. Budget includes materials allowance. Work must be completed within 2 weeks during off-hours (restaurant closes at 11pm, work can begin at midnight).",
      qualifications: ["Portfolio of completed murals", "Experience with interior wall painting", "Own equipment & supplies", "Ability to work within a 2-week timeline"],
      responsibilities: ["Submit concept sketches for approval", "Source and purchase materials (reimbursed)", "Complete the mural within the 2-week timeline", "Apply protective sealant for longevity", "Clean up workspace nightly"],
      how_to_apply: "Send your portfolio and a brief concept pitch (mood board or rough sketches welcome) to hello@theurbankitchen.ca. Include your availability and any questions about the space. We'll schedule a site visit with shortlisted artists.",
      contact_email: "hello@theurbankitchen.ca",
      posted_date: "Apr 1, 2026",
      tags: [
        { label: "Creative", color: "#f97316", icon: "creative" },
        { label: "Commission", color: "#eab308", icon: "briefcase" },
      ],
      location: "Toronto, ON",
      salary: "$3,500 commission",
      deadline: "Apr 30, 2026",
    },
    {
      id: "job-5",
      title: "Live Art Performance — Music Festival",
      company: "SoundWave Festival",
      type: "COMMISSION",
      banner_color: "#ec4899",
      banner_text_color: "#fff",
      accent_color: "#ec4899",
      image_url: "https://picsum.photos/seed/job-festival/600/300",
      description: "Live painting during the 3-day music festival. Must be comfortable performing in front of large crowds and creating art in real-time.",
      full_description: "SoundWave Festival is looking for a dynamic visual artist to perform live painting across our 3-day music festival at Ontario Place. You'll be creating art in real-time as bands perform, with your work displayed prominently on the festival grounds.\n\nThis is a high-visibility opportunity — SoundWave draws 15,000+ attendees and significant media coverage. Your finished pieces will be auctioned at the closing ceremony with proceeds split 70/30 (artist/festival).\n\nWe provide the stage area, large-format canvases, lighting, and a dedicated assistant. You bring your paints, brushes, and creative energy. Housing and meals are covered for the duration of the event.",
      qualifications: ["Live painting experience", "Comfortable with public performance", "Own supplies (canvas & paints provided)", "Available for full 3-day event"],
      responsibilities: ["Perform live painting during headliner sets (3-4 hours/day)", "Engage with festival attendees during painting sessions", "Complete 2-3 finished pieces over the 3 days", "Participate in the closing ceremony art auction", "Be available for media interviews and photo ops"],
      how_to_apply: "Submit your portfolio and a 1-minute video of you painting (can be casual, phone-recorded) to artists@soundwavefest.com. Tell us what music inspires your art. Selected artists will be invited to a virtual interview.",
      contact_email: "artists@soundwavefest.com",
      posted_date: "Mar 28, 2026",
      tags: [
        { label: "Creative", color: "#f97316", icon: "creative" },
        { label: "Live Event", color: "#ef4444", icon: "sparkle" },
        { label: "Commission", color: "#eab308", icon: "briefcase" },
      ],
      location: "Toronto, ON",
      salary: "$2,000 commission",
      deadline: "May 15, 2026",
    },
    {
      id: "job-6",
      title: "Street Art Installation — City Commission",
      company: "Toronto Arts Council",
      type: "COMMISSION",
      banner_color: "#059669",
      banner_text_color: "#fff",
      accent_color: "#059669",
      image_url: "https://picsum.photos/seed/job-cityart/600/300",
      description: "Public art installation for the downtown revitalization project. Open call for emerging and established street artists to transform a public space.",
      full_description: "The Toronto Arts Council, in partnership with the City of Toronto, is issuing an open call for street artists to create a permanent public art installation as part of the Downtown East Revitalization Project.\n\nThe selected artist will transform a 40ft concrete retaining wall along the new pedestrian corridor into a landmark piece that reflects the cultural diversity and creative energy of the neighborhood. The project has strong community support and will be unveiled during Nuit Blanche 2026.\n\nThis is a significant opportunity for emerging or established artists to create a permanent, high-profile public artwork. The $8,000 budget covers artist fees, materials, equipment rental, and installation costs. The City provides permitting, site preparation, scaffolding, and project management support.",
      qualifications: ["Portfolio of public art or street art", "Proposal submission required", "Must carry liability insurance", "Experience with outdoor installations"],
      responsibilities: ["Submit a detailed proposal with concept renders", "Present to the community advisory panel", "Complete the installation within the agreed timeline", "Coordinate with city engineers on structural requirements", "Attend the public unveiling ceremony"],
      how_to_apply: "Download the full RFP from torontoartscouncil.org/public-art-2026. Submit your proposal package (artist statement, concept renders, budget breakdown, timeline, portfolio, and proof of insurance) to publicart@torontoarts.ca by the deadline. Info sessions are held every Tuesday at 2pm via Zoom — register on our website.",
      contact_email: "publicart@torontoarts.ca",
      posted_date: "Mar 5, 2026",
      tags: [
        { label: "Creative", color: "#f97316", icon: "creative" },
        { label: "Public Art", color: "#3b82f6", icon: "media" },
        { label: "Commission", color: "#eab308", icon: "briefcase" },
      ],
      location: "Toronto, ON",
      salary: "$8,000 commission",
      deadline: "May 20, 2026",
    },
  ];

  const typeColor = (t: string) => {
    if (t === "FULL-TIME") return { bg: "#22c55e", color: "#fff" };
    if (t === "COMMISSION") return { bg: "#f59e0b", color: "#000" };
    if (t === "CONTRACT") return { bg: "#f59e0b", color: "#000" };
    return { bg: "#eab308", color: "#000" };
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "24px", flexWrap: "wrap", gap: "12px",
      }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "0 0 4px 0" }}>
            Jobs & Opportunities
          </h3>
          <p style={{ fontSize: "13px", color: colors.textSecondary, margin: 0 }}>
            Opportunities relevant to {profile.display_name || "this creative"}
          </p>
        </div>
        <div style={{ fontSize: "13px", color: colors.textSecondary }}>
          {jobs.length} opportunities
        </div>
      </div>

      {/* Filter Buttons */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px",
        padding: "12px 16px", borderRadius: "12px",
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
      }}>
        {["ALL", "PART-TIME", "FULL-TIME", "COMMISSION", "CONTRACT"].map((filter) => {
          const isActive = jobFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setJobFilter(filter)}
              style={{
                padding: "8px 18px", borderRadius: "100px", fontSize: "12px", fontWeight: 700,
                border: "none", cursor: "pointer", transition: "all 0.2s",
                background: isActive ? "#eab308" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                color: isActive ? "#000" : colors.textSecondary,
                letterSpacing: "0.3px",
              }}
            >
              {filter === "ALL" ? "All Jobs" : filter.charAt(0) + filter.slice(1).toLowerCase().replace("-", "-")}
            </button>
          );
        })}
      </div>

      {/* Job Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
        {jobs.filter((job) => jobFilter === "ALL" || job.type === jobFilter).map((job) => {
          const tc = typeColor(job.type);
          const isSaved = savedJobs.has(job.id);
          return (
            <div
              key={job.id}
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.9)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                transition: "all 0.3s",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Banner with company name */}
              <div style={{ position: "relative", padding: "0" }}>
                {/* Type badge */}
                <div style={{
                  position: "absolute", top: "12px", left: "12px", zIndex: 2,
                  background: tc.bg, color: tc.color, fontSize: "10px", fontWeight: 800,
                  padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px",
                }}>
                  {job.type}
                </div>
                {/* Save & Share icons */}
                <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2, display: "flex", gap: "8px" }}>
                  <button
                    onClick={(e) => toggleSaveJob(job.id, e)}
                    style={{
                      width: "34px", height: "34px", borderRadius: "50%",
                      background: "rgba(0,0,0,0.35)", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Heart size={15} fill={isSaved ? "#ef4444" : "none"} color={isSaved ? "#ef4444" : "#fff"} />
                  </button>
                  <button
                    style={{
                      width: "34px", height: "34px", borderRadius: "50%",
                      background: "rgba(0,0,0,0.35)", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Share2 size={15} color="#fff" />
                  </button>
                </div>
                {/* Company banner */}
                <div style={{
                  background: job.banner_color,
                  padding: "40px 20px 24px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  borderRadius: "12px", margin: "12px 12px 0",
                }}>
                  <div style={{
                    fontSize: "22px", fontWeight: 900, color: job.banner_text_color,
                    textTransform: "uppercase", textAlign: "center", letterSpacing: "1px", lineHeight: 1.2,
                  }}>
                    {job.company.split(" ").slice(0, -1).join(" ")}
                  </div>
                  <div style={{
                    fontSize: "13px", fontWeight: 600, color: job.banner_text_color,
                    opacity: 0.8, marginTop: "4px", textAlign: "center",
                  }}>
                    {job.company.split(" ").slice(-1)[0]}
                  </div>
                </div>
              </div>

              {/* Job Image */}
              {job.image_url && (
                <div style={{ margin: "12px 12px 0", borderRadius: "10px", overflow: "hidden" }}>
                  <img
                    src={job.image_url}
                    alt={job.title}
                    style={{ width: "100%", height: "140px", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* Content */}
              <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Title */}
                <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: colors.text, textAlign: "center" }}>
                  {job.title}
                </h4>
                <div style={{ fontSize: "13px", color: colors.textSecondary, textAlign: "center", marginBottom: "12px" }}>
                  {job.company}
                </div>

                {/* Description */}
                <p style={{
                  fontSize: "13px", color: colors.textSecondary, lineHeight: 1.5,
                  margin: "0 0 14px 0", textAlign: "center",
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any, overflow: "hidden",
                }}>
                  {job.description}
                </p>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "16px" }}>
                  {job.tags.map((tag) => (
                    <span
                      key={tag.label}
                      style={{
                        fontSize: "11px", padding: "4px 10px", borderRadius: "100px",
                        background: tag.color, color: "#fff", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      {tag.icon === "org" && <Briefcase size={10} />}
                      {tag.icon === "sparkle" && <Sparkles size={10} />}
                      {tag.icon === "training" && <CheckCircle2 size={10} />}
                      {tag.icon === "creative" && <Layers size={10} />}
                      {tag.icon === "media" && <Camera size={10} />}
                      {tag.icon === "briefcase" && <Briefcase size={10} />}
                      {tag.label}
                    </span>
                  ))}
                </div>

                {/* Qualifications */}
                {job.qualifications && job.qualifications.length > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Qualifications
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {job.qualifications.map((q: string, qi: number) => (
                        <div key={qi} style={{ fontSize: "12px", color: colors.textSecondary, display: "flex", alignItems: "flex-start", gap: "6px" }}>
                          <CheckCircle2 size={12} color="#22c55e" style={{ marginTop: "2px", flexShrink: 0 }} />
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, margin: "0 0 12px 0" }} />

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: colors.textSecondary, marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <span>{job.location}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>$</span>
                    <span>{job.salary}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Clock size={14} color={colors.textSecondary} />
                    <span>Due: {job.deadline}</span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, margin: "0 0 14px 0" }} />

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "auto", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setSelectedJob(job)}
                    style={{
                    flex: 1, minWidth: "80px", padding: "10px 14px", borderRadius: "10px",
                    background: "#eab308", color: "#000", fontSize: "13px", fontWeight: 700,
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: "6px",
                  }}>
                    View Details <ExternalLink size={12} />
                  </button>
                  <button
                    onClick={() => { setApplyingJob(job); setApplySubmitted(false); setResumeFile(null); setApplyForm({ name: "", email: "", phone: "", message: "", portfolio: "" }); }}
                    style={{
                    padding: "10px 14px", borderRadius: "10px",
                    background: "#eab308", color: "#000", fontSize: "13px", fontWeight: 700,
                    border: "none", cursor: "pointer",
                  }}>
                    Quick Apply
                  </button>
                  <button
                    onClick={(e) => toggleReminder(job.id, job.title, job.deadline, e)}
                    style={{
                    padding: "10px 12px", borderRadius: "10px",
                    background: reminders.has(job.id) ? "rgba(234,179,8,0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    color: reminders.has(job.id) ? "#eab308" : colors.textSecondary, fontSize: "12px", fontWeight: 600,
                    border: `1px solid ${reminders.has(job.id) ? "rgba(234,179,8,0.3)" : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")}`,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    <Clock size={12} /> Remind Me
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Reminder Toast Notification ── */}
      {reminderToast && (
        <div style={{
          position: "fixed", bottom: "32px", right: "32px", zIndex: 10010,
          background: "rgba(25,25,25,0.98)", border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: "14px", padding: "20px 24px", maxWidth: "380px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          animation: "slideInUp 0.3s ease-out",
        }}>
          <style>{`@keyframes slideInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "rgba(234,179,8,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Clock size={20} color="#eab308" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                Reminder Set
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: "10px" }}>
                You'll be reminded about <strong style={{ color: "#eab308" }}>{reminderToast.jobTitle}</strong> at weekly intervals before the deadline.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={12} color="#22c55e" /> 1 week before deadline
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={12} color="#22c55e" /> 3 days before deadline
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={12} color="#22c55e" /> Day of deadline ({reminderToast.deadline})
                </div>
              </div>
            </div>
            <button
              onClick={() => setReminderToast(null)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                cursor: "pointer", padding: "4px", flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Job Detail Full-Page Modal ── */}
      {selectedJob && (() => {
        const job = selectedJob;
        const tc = typeColor(job.type);
        const isSaved = savedJobs.has(job.id);
        return (
          <div
            onClick={() => setSelectedJob(null)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "flex-start", justifyContent: "center",
              zIndex: 9999, overflowY: "auto", padding: "40px 20px",
            }}
          >
            {/* Close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedJob(null); }}
              style={{
                position: "fixed", top: "20px", right: "20px",
                background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
                width: "44px", height: "44px", borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001,
              }}
            >
              <X size={22} />
            </button>

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "800px", width: "100%", borderRadius: "16px", overflow: "hidden",
                background: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Hero Banner */}
              <div style={{ position: "relative" }}>
                <div style={{
                  background: job.banner_color,
                  padding: "48px 32px 32px",
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  {/* Type badge */}
                  <div style={{
                    position: "absolute", top: "16px", left: "16px",
                    background: tc.bg, color: tc.color, fontSize: "11px", fontWeight: 800,
                    padding: "5px 14px", borderRadius: "6px", letterSpacing: "0.5px",
                  }}>
                    {job.type}
                  </div>
                  {/* Save & Share */}
                  <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px" }}>
                    <button
                      onClick={(e) => toggleSaveJob(job.id, e)}
                      style={{
                        width: "38px", height: "38px", borderRadius: "50%",
                        background: "rgba(0,0,0,0.3)", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Heart size={16} fill={isSaved ? "#ef4444" : "none"} color={isSaved ? "#ef4444" : "#fff"} />
                    </button>
                    <button style={{
                      width: "38px", height: "38px", borderRadius: "50%",
                      background: "rgba(0,0,0,0.3)", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Share2 size={16} color="#fff" />
                    </button>
                  </div>
                  <div style={{
                    fontSize: "28px", fontWeight: 900, color: job.banner_text_color,
                    textTransform: "uppercase", textAlign: "center", letterSpacing: "1.5px", lineHeight: 1.2,
                  }}>
                    {job.company.split(" ").slice(0, -1).join(" ")}
                  </div>
                  <div style={{
                    fontSize: "15px", fontWeight: 600, color: job.banner_text_color,
                    opacity: 0.8, marginTop: "6px", textAlign: "center",
                  }}>
                    {job.company.split(" ").slice(-1)[0]}
                  </div>
                </div>
                {/* Job image */}
                {job.image_url && (
                  <img
                    src={job.image_url}
                    alt={job.title}
                    style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ padding: "32px 36px" }}>
                {/* Title */}
                <h2 style={{ margin: "0 0 6px 0", fontSize: "26px", fontWeight: 800, color: "#fff" }}>
                  {job.title}
                </h2>
                <div style={{ fontSize: "15px", color: job.accent_color || "#eab308", fontWeight: 600, marginBottom: "20px" }}>
                  {job.company}
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                  {job.tags.map((tag: any) => (
                    <span key={tag.label} style={{
                      fontSize: "12px", padding: "5px 14px", borderRadius: "100px",
                      background: tag.color, color: "#fff", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: "5px",
                    }}>
                      {tag.icon === "org" && <Briefcase size={11} />}
                      {tag.icon === "sparkle" && <Sparkles size={11} />}
                      {tag.icon === "training" && <CheckCircle2 size={11} />}
                      {tag.icon === "creative" && <Layers size={11} />}
                      {tag.icon === "media" && <Camera size={11} />}
                      {tag.icon === "briefcase" && <Briefcase size={11} />}
                      {tag.label}
                    </span>
                  ))}
                </div>

                {/* Key Details Grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px",
                  padding: "20px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  marginBottom: "28px",
                }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Location</div>
                    <div style={{ fontSize: "14px", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={14} color="rgba(255,255,255,0.5)" /> {job.location}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Compensation</div>
                    <div style={{ fontSize: "14px", color: "#eab308", fontWeight: 700 }}>{job.salary}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Deadline</div>
                    <div style={{ fontSize: "14px", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={14} color="rgba(255,255,255,0.5)" /> {job.deadline}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Posted</div>
                    <div style={{ fontSize: "14px", color: "#fff" }}>{job.posted_date || "Recently"}</div>
                  </div>
                </div>

                {/* About This Role */}
                <div style={{ marginBottom: "28px" }}>
                  <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
                    About This Role
                  </h4>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                    {job.full_description || job.description}
                  </div>
                </div>

                {/* Responsibilities */}
                {job.responsibilities && job.responsibilities.length > 0 && (
                  <div style={{ marginBottom: "28px" }}>
                    <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
                      Responsibilities
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {job.responsibilities.map((r: string, ri: number) => (
                        <div key={ri} style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: job.accent_color || "#eab308", marginTop: "7px", flexShrink: 0 }} />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Qualifications */}
                {job.qualifications && job.qualifications.length > 0 && (
                  <div style={{ marginBottom: "28px" }}>
                    <h4 style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
                      Qualifications
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {job.qualifications.map((q: string, qi: number) => (
                        <div key={qi} style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <CheckCircle2 size={16} color="#22c55e" style={{ marginTop: "2px", flexShrink: 0 }} />
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* How to Apply */}
                <div style={{
                  marginBottom: "28px", padding: "24px", borderRadius: "12px",
                  background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
                }}>
                  <h4 style={{ color: "#eab308", fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Mail size={16} /> How to Apply
                  </h4>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px", lineHeight: 1.7, margin: "0 0 16px 0" }}>
                    {job.how_to_apply || "Contact the employer directly for application details."}
                  </p>
                  {job.contact_email && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                      <Mail size={14} color="#eab308" />
                      <a href={`mailto:${job.contact_email}`} style={{ color: "#eab308", textDecoration: "none", fontWeight: 600 }}>
                        {job.contact_email}
                      </a>
                    </div>
                  )}
                </div>

                {/* Company Info Card */}
                <div style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "24px", marginBottom: "24px",
                  display: "flex", alignItems: "center", gap: "16px",
                }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "12px",
                    background: job.banner_color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "22px", fontWeight: 900, color: job.banner_text_color,
                  }}>
                    {job.company.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{job.company}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>{job.location}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setApplyingJob(job); setApplySubmitted(false); setResumeFile(null); setApplyForm({ name: "", email: "", phone: "", message: "", portfolio: "" }); }}
                    style={{
                    padding: "14px 28px", borderRadius: "12px",
                    background: "#eab308", color: "#000", fontSize: "15px", fontWeight: 700,
                    border: "none", cursor: "pointer",
                  }}>
                    Quick Apply
                  </button>
                  <button
                    onClick={(e) => toggleSaveJob(job.id, e)}
                    style={{
                    padding: "14px 24px", borderRadius: "12px",
                    background: isSaved ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
                    color: isSaved ? "#ef4444" : "#fff", fontSize: "14px", fontWeight: 600,
                    border: `1px solid ${isSaved ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  }}>
                    <Heart size={16} fill={isSaved ? "#ef4444" : "none"} /> {isSaved ? "Saved" : "Save Job"}
                  </button>
                  <button
                    onClick={() => { setSharingJob(job); setLinkCopied(false); }}
                    style={{
                    padding: "14px 24px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: "14px", fontWeight: 600,
                    border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px",
                  }}>
                    <Share2 size={16} /> Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Quick Apply Modal ── */}
      {applyingJob && (() => {
        const job = applyingJob;
        const inputStyle: React.CSSProperties = {
          width: "100%", padding: "12px 16px", borderRadius: "10px", fontSize: "14px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          color: "#fff", outline: "none", boxSizing: "border-box",
        };
        const labelStyle: React.CSSProperties = {
          fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block",
        };
        return (
          <div
            onClick={() => setApplyingJob(null)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10002, padding: "20px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "520px", width: "100%", borderRadius: "16px", overflow: "hidden",
                background: "rgba(25,25,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
                maxHeight: "90vh", overflowY: "auto",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "24px 28px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 800, color: "#fff" }}>
                    Quick Apply
                  </h3>
                  <div style={{ fontSize: "14px", color: "#eab308", fontWeight: 600 }}>
                    {job.title} — {job.company}
                  </div>
                </div>
                <button
                  onClick={() => setApplyingJob(null)}
                  style={{
                    background: "rgba(255,255,255,0.08)", border: "none", color: "#fff",
                    width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {applySubmitted ? (
                <div style={{ padding: "48px 28px", textAlign: "center" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
                  <h3 style={{ color: "#22c55e", fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0" }}>
                    Application Submitted!
                  </h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", margin: "0 0 8px 0" }}>
                    Your application for <strong style={{ color: "#fff" }}>{job.title}</strong> at <strong style={{ color: "#eab308" }}>{job.company}</strong> has been sent.
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "0 0 24px 0" }}>
                    You'll receive a confirmation email shortly. The employer will review your application and reach out if there's a fit.
                  </p>
                  <button
                    onClick={() => setApplyingJob(null)}
                    style={{
                      padding: "12px 32px", borderRadius: "10px",
                      background: "#eab308", color: "#000", fontSize: "14px", fontWeight: 700,
                      border: "none", cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ padding: "24px 28px" }}>
                  {/* Form Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    <div>
                      <label style={labelStyle}>Full Name *</label>
                      <input
                        type="text"
                        placeholder="Your full name"
                        value={applyForm.name}
                        onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Address *</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={applyForm.email}
                        onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Phone Number</label>
                      <input
                        type="tel"
                        placeholder="(416) 555-0123"
                        value={applyForm.phone}
                        onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Portfolio / Website Link</label>
                      <input
                        type="url"
                        placeholder="https://your-portfolio.com"
                        value={applyForm.portfolio}
                        onChange={(e) => setApplyForm({ ...applyForm, portfolio: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cover Message *</label>
                      <textarea
                        placeholder="Tell them why you're interested and what makes you a great fit..."
                        value={applyForm.message}
                        onChange={(e) => setApplyForm({ ...applyForm, message: e.target.value })}
                        rows={5}
                        style={{ ...inputStyle, resize: "vertical" as any }}
                      />
                    </div>

                    {/* Resume Upload */}
                    <div>
                      <label style={labelStyle}>Resume / CV</label>
                      <input
                        ref={resumeInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.size <= 5 * 1024 * 1024) {
                            setResumeFile(file);
                          }
                        }}
                      />
                      {resumeFile ? (
                        <div style={{
                          padding: "16px 20px", borderRadius: "10px",
                          border: "2px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <FileText size={20} color="#22c55e" />
                            <div>
                              <div style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>{resumeFile.name}</div>
                              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                                {(resumeFile.size / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setResumeFile(null); if (resumeInputRef.current) resumeInputRef.current.value = ""; }}
                            style={{
                              background: "rgba(239,68,68,0.15)", border: "none", color: "#ef4444",
                              width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => resumeInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(234,179,8,0.5)"; e.currentTarget.style.background = "rgba(234,179,8,0.05)"; }}
                          onDragLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                            const file = e.dataTransfer.files?.[0];
                            if (file && file.size <= 5 * 1024 * 1024 && /\.(pdf|doc|docx)$/i.test(file.name)) {
                              setResumeFile(file);
                            }
                          }}
                          style={{
                            padding: "20px", borderRadius: "10px", textAlign: "center",
                            border: "2px dashed rgba(255,255,255,0.12)", cursor: "pointer",
                            background: "rgba(255,255,255,0.02)", transition: "all 0.2s",
                          }}
                        >
                          <Upload size={20} color="rgba(255,255,255,0.3)" style={{ marginBottom: "8px" }} />
                          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                            Drag & drop your resume or <span style={{ color: "#eab308", fontWeight: 600 }}>browse files</span>
                          </div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
                            PDF, DOC, DOCX (max 5MB)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => {
                        if (applyForm.name && applyForm.email && applyForm.message) {
                          setApplySubmitted(true);
                        }
                      }}
                      style={{
                        flex: 1, padding: "14px 24px", borderRadius: "12px",
                        background: (applyForm.name && applyForm.email && applyForm.message) ? "#eab308" : "rgba(234,179,8,0.3)",
                        color: "#000", fontSize: "15px", fontWeight: 700,
                        border: "none", cursor: (applyForm.name && applyForm.email && applyForm.message) ? "pointer" : "not-allowed",
                        opacity: (applyForm.name && applyForm.email && applyForm.message) ? 1 : 0.6,
                      }}
                    >
                      Submit Application
                    </button>
                    <button
                      onClick={() => setApplyingJob(null)}
                      style={{
                        padding: "14px 20px", borderRadius: "12px",
                        background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: "14px", fontWeight: 600,
                        border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Share Job Modal ── */}
      {sharingJob && (() => {
        const job = sharingJob;
        const shareUrl = `${window.location.origin}/jobs/${job.id}`;
        const shareText = `Check out this opportunity: ${job.title} at ${job.company} — ${job.salary}`;
        return (
          <div
            onClick={() => setSharingJob(null)}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10012, padding: "20px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "440px", width: "100%", borderRadius: "16px",
                background: "rgba(25,25,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{
                padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                  Share This Job
                </h3>
                <button
                  onClick={() => setSharingJob(null)}
                  style={{
                    background: "rgba(255,255,255,0.08)", border: "none", color: "#fff",
                    width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: "24px" }}>
                {/* Job Preview */}
                <div style={{
                  padding: "14px 16px", borderRadius: "10px", marginBottom: "20px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", gap: "12px",
                }}>
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: job.banner_color, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", fontWeight: 900, color: job.banner_text_color, flexShrink: 0,
                  }}>
                    {job.company.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{job.title}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{job.company} · {job.salary}</div>
                  </div>
                </div>

                {/* Copy Link */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                    Copy Link
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{
                      flex: 1, padding: "10px 14px", borderRadius: "8px", fontSize: "13px",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {shareUrl}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      style={{
                        padding: "10px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
                        background: linkCopied ? "#22c55e" : "#eab308",
                        color: linkCopied ? "#fff" : "#000",
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        transition: "all 0.2s",
                      }}
                    >
                      {linkCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Share via */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                    Share Via
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`Job: ${job.title} at ${job.company}`)}&body=${encodeURIComponent(`${shareText}\n\nApply here: ${shareUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "12px", borderRadius: "10px", textDecoration: "none",
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <Mail size={16} /> Email
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "12px", borderRadius: "10px", textDecoration: "none",
                        background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        color: "#25d366", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "12px", borderRadius: "10px", textDecoration: "none",
                        background: "rgba(29,161,242,0.12)", border: "1px solid rgba(29,161,242,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        color: "#1da1f2", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <ExternalLink size={16} /> X / Twitter
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "12px", borderRadius: "10px", textDecoration: "none",
                        background: "rgba(10,102,194,0.12)", border: "1px solid rgba(10,102,194,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        color: "#0a66c2", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <Briefcase size={16} /> LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TabAcademy({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  type AcademySection = "courses" | "paths" | "live" | "assignments" | "peer-review" | "progress" | "certificates" | "ai-tutor" | "discussions";
  const [activeSection, setActiveSection] = useState<AcademySection>("courses");
  const [activeCategory, setActiveCategory] = useState("all");
  const [courseTab, setCourseTab] = useState<"browse" | "my-courses">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("All Levels");

  const navSections = [
    { title: "Learn", items: [
      { id: "courses" as AcademySection, label: "Courses", icon: <BookOpen size={16} />, color: "#FFD600" },
      { id: "paths" as AcademySection, label: "Learning Paths", icon: <Layers size={16} />, color: "#8B5CF6" },
      { id: "live" as AcademySection, label: "Live Sessions", icon: <Camera size={16} />, color: "#10B981", badge: "LIVE" },
    ]},
    { title: "Activities", items: [
      { id: "assignments" as AcademySection, label: "Assignments", icon: <FileText size={16} />, color: "#3B82F6" },
      { id: "peer-review" as AcademySection, label: "Peer Review", icon: <Users size={16} />, color: "#A855F7" },
    ]},
    { title: "Progress", items: [
      { id: "progress" as AcademySection, label: "My Progress", icon: <Star size={16} />, color: "#F59E0B" },
      { id: "certificates" as AcademySection, label: "Certificates", icon: <CheckCircle2 size={16} />, color: "#EF4444" },
    ]},
    { title: "Tools", items: [
      { id: "ai-tutor" as AcademySection, label: "AI Tutor", icon: <Sparkles size={16} />, color: "#EC4899" },
      { id: "discussions" as AcademySection, label: "Discussions", icon: <MessageSquare size={16} />, color: "#6366F1" },
    ]},
  ];

  const courses = [
    {
      id: 1, title: "Street Art Fundamentals", instructor: "Ghost Academy", category: "courses",
      image: "https://picsum.photos/seed/academy-street/600/300", duration: "6 weeks",
      level: "Beginner", enrolled: 234, rating: 4.8, price: "Free",
      description: "Learn the foundations of street art from spray techniques to large-scale mural planning.",
      modules: 12, completed: 0,
      tags: ["Spray Paint", "Stencils", "Muralism"],
    },
    {
      id: 2, title: "Business of Art: From Passion to Profit", instructor: "Creative Careers Institute", category: "courses",
      image: "https://picsum.photos/seed/academy-biz/600/300", duration: "4 weeks",
      level: "Intermediate", enrolled: 189, rating: 4.6, price: "$49",
      description: "Master pricing, contracts, client management, and building a sustainable creative career.",
      modules: 8, completed: 3,
      tags: ["Business", "Pricing", "Contracts"],
    },
    {
      id: 3, title: "Digital Art for Street Artists", instructor: "TechCanvas Lab", category: "courses",
      image: "https://picsum.photos/seed/academy-digital/600/300", duration: "8 weeks",
      level: "Intermediate", enrolled: 156, rating: 4.9, price: "$79",
      description: "Bridge traditional street art skills with digital tools — Procreate, Photoshop, and projection mapping.",
      modules: 16, completed: 0,
      tags: ["Digital", "Procreate", "Projection Mapping"],
    },
    {
      id: 4, title: "Spray Can Techniques Masterclass", instructor: profile.display_name || "This Creative", category: "workshops",
      image: "https://picsum.photos/seed/academy-spray/600/300", duration: "3 hours",
      level: "All Levels", enrolled: 45, rating: 5.0, price: "$25",
      description: "Hands-on workshop covering can control, pressure techniques, fades, and detail work.",
      modules: 1, completed: 0,
      tags: ["Spray Paint", "Hands-On", "Live"],
    },
    {
      id: 5, title: "Community Mural Project Leadership", instructor: "Urban Arts Alliance", category: "workshops",
      image: "https://picsum.photos/seed/academy-community/600/300", duration: "2 days",
      level: "Advanced", enrolled: 32, rating: 4.7, price: "Free",
      description: "Lead community mural projects from concept to completion — stakeholder management, volunteer coordination, and public art permissions.",
      modules: 1, completed: 0,
      tags: ["Leadership", "Community", "Public Art"],
    },
    {
      id: 6, title: "Street Art Safety & Certification", instructor: "SafeArt Canada", category: "certifications",
      image: "https://picsum.photos/seed/academy-cert/600/300", duration: "Self-paced",
      level: "All Levels", enrolled: 512, rating: 4.5, price: "Free",
      description: "Get certified in safe practices for working at heights, with aerosols, and on public infrastructure.",
      modules: 5, completed: 5,
      tags: ["Safety", "Certification", "Professional"],
    },
  ];

  const learningPaths = [
    { slug: "job-ready", title: "Job Ready", description: "Complete path to employment readiness and interview confidence.", courses: 4, hours: 40, color: "#10B981", icon: <Briefcase size={24} /> },
    { slug: "digital-basics", title: "Digital Basics", description: "Essential computer and internet skills for everyday work and life.", courses: 4, hours: 24, color: "#3B82F6", icon: <Grid size={24} /> },
    { slug: "housing-stability", title: "Housing Stability", description: "Practical learning track for housing search, support, and retention.", courses: 4, hours: 32, color: "#8B5CF6", icon: <Home size={24} /> },
  ];

  const liveSessions = [
    { id: 1, title: "Street Art Critique Circle", host: "Maya Chen", date: "Today, 2:00 PM", attendees: 18, status: "live" as const, color: "#10B981" },
    { id: 2, title: "Portfolio Review Workshop", host: "Diego Alvarez", date: "Tomorrow, 11:00 AM", attendees: 24, status: "upcoming" as const, color: "#3B82F6" },
    { id: 3, title: "Grant Writing for Artists", host: "Keisha Williams", date: "Apr 16, 3:00 PM", attendees: 12, status: "upcoming" as const, color: "#8B5CF6" },
  ];

  const assignments = [
    { id: 1, title: "Mural Concept Sketch", course: "Street Art Fundamentals", due: "Apr 18, 2026", status: "pending" as const, grade: null },
    { id: 2, title: "Pricing Strategy Document", course: "Business of Art", due: "Apr 15, 2026", status: "submitted" as const, grade: null },
    { id: 3, title: "Digital Mockup — Projection", course: "Digital Art for Street Artists", due: "Apr 10, 2026", status: "graded" as const, grade: "A" },
  ];

  const certificates = [
    { id: 1, title: "Street Art Safety Certified", issuer: "SafeArt Canada", date: "Mar 2026", icon: <CheckCircle2 size={20} />, color: "#22c55e" },
    { id: 2, title: "Business of Art — Module 3", issuer: "Creative Careers Institute", date: "Feb 2026", icon: <Star size={20} />, color: "#f59e0b" },
  ];

  const progressStats = {
    coursesEnrolled: 3, coursesCompleted: 1, totalHours: 28, streak: 5,
    badges: [
      { name: "First Lesson", icon: "🎓", earned: true },
      { name: "Week Streak", icon: "🔥", earned: true },
      { name: "Peer Helper", icon: "🤝", earned: true },
      { name: "Quiz Master", icon: "🧠", earned: false },
      { name: "Completionist", icon: "🏆", earned: false },
    ],
  };

  const discussions = [
    { id: 1, title: "Best spray paint brands in 2026?", author: "Ravi Patel", replies: 14, lastActivity: "2h ago", category: "General" },
    { id: 2, title: "How to price a 10ft mural?", author: "Suki Park", replies: 22, lastActivity: "5h ago", category: "Business" },
    { id: 3, title: "Procreate vs Photoshop for street art design", author: "Maya Chen", replies: 8, lastActivity: "1d ago", category: "Digital" },
  ];

  const myCourses = courses.filter(c => c.completed > 0 || c.modules === c.completed);

  const filteredCourses = courses.filter(c => {
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterLevel !== "All Levels" && c.level !== filterLevel) return false;
    return true;
  });

  const levelColor = (l: string) => {
    if (l === "Beginner") return { color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    if (l === "Intermediate") return { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    if (l === "Advanced") return { color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    return { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" };
  };

  // Render a course card (reusable)
  const renderCourseCard = (course: typeof courses[0]) => {
    const lc = levelColor(course.level);
    const isCompleted = course.completed === course.modules && course.modules > 0;
    const progress = course.modules > 1 ? Math.round((course.completed / course.modules) * 100) : 0;
    return (
      <div
        key={course.id}
        style={{
          borderRadius: "16px", overflow: "hidden",
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          transition: "all 0.3s", cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.25)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <div style={{ position: "relative", width: "100%", paddingTop: "50%", overflow: "hidden" }}>
          <img src={course.image} alt={course.title} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: "12px", left: "12px", background: lc.bg, color: lc.color, fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px", backdropFilter: "blur(8px)" }}>
            {course.level}
          </div>
          <div style={{ position: "absolute", top: "12px", right: "12px", background: course.price === "Free" ? "rgba(34,197,94,0.9)" : "rgba(234,179,8,0.9)", color: course.price === "Free" ? "#fff" : "#000", fontSize: "12px", fontWeight: 700, padding: "4px 12px", borderRadius: "6px" }}>
            {course.price}
          </div>
          {isCompleted && (
            <div style={{ position: "absolute", bottom: "12px", left: "12px", background: "rgba(34,197,94,0.9)", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={12} /> Completed
            </div>
          )}
        </div>
        <div style={{ padding: "16px" }}>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700, color: colors.text }}>{course.title}</h4>
          <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>by {course.instructor}</div>
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: colors.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
            {course.description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "12px" }}>
            {course.tags.map((tag) => (
              <span key={tag} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "5px", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: colors.textSecondary }}>{tag}</span>
            ))}
          </div>
          {course.completed > 0 && course.modules > 1 && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: colors.textSecondary, marginBottom: "4px" }}>
                <span>{course.completed}/{course.modules} modules</span>
                <span style={{ fontWeight: 700, color: isCompleted ? "#22c55e" : colors.accent }}>{progress}%</span>
              </div>
              <div style={{ height: "4px", borderRadius: "100px", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", borderRadius: "100px", background: isCompleted ? "#22c55e" : `linear-gradient(90deg, ${colors.accent}, #ff8800)` }} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: colors.textSecondary }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {course.duration}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Users size={12} /> {course.enrolled}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Star size={12} color="#eab308" fill="#eab308" /> {course.rating}</span>
          </div>
          <button style={{
            marginTop: "14px", width: "100%", padding: "10px", borderRadius: "10px",
            background: isCompleted ? "rgba(34,197,94,0.15)" : course.completed > 0 ? colors.accent : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
            color: isCompleted ? "#22c55e" : course.completed > 0 ? "#000" : colors.text,
            fontWeight: 700, fontSize: "13px", border: isCompleted || course.completed > 0 ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
            cursor: "pointer",
          }}>
            {isCompleted ? "✓ Completed" : course.completed > 0 ? "Continue Learning" : "Enroll Now"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: "24px" }}>
      {/* ── Left Sidebar Navigation ── */}
      <div style={{
        width: "220px", flexShrink: 0,
        background: isDark ? "rgba(15,15,25,0.6)" : "rgba(255,255,255,0.5)",
        borderRadius: "16px", padding: "16px 12px",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        alignSelf: "flex-start", position: "sticky", top: "80px",
      }}>
        {navSections.map((section) => (
          <div key={section.title} style={{ marginBottom: "16px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase",
              color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
              padding: "0 10px", marginBottom: "6px",
            }}>
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", width: "100%",
                    padding: "8px 10px", borderRadius: "10px", border: "none", cursor: "pointer",
                    background: isActive ? `${item.color}18` : "transparent",
                    borderLeft: isActive ? `2px solid ${item.color}` : "2px solid transparent",
                    transition: "all 0.2s", textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "8px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? `${item.color}20` : "transparent",
                    color: isActive ? item.color : (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"),
                  }}>
                    {item.icon}
                  </div>
                  <span style={{
                    fontSize: "13px", fontWeight: isActive ? 600 : 500, flex: 1,
                    color: isActive ? (isDark ? "#fff" : "#000") : (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)"),
                  }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "100px",
                      background: "rgba(16,185,129,0.2)", color: "#10B981",
                      animation: "pulse 2s infinite",
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── COURSES ── */}
        {activeSection === "courses" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Courses</h2>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: colors.textSecondary }}>Browse courses, workshops, and certifications.</p>

            {/* Browse / My Courses tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {(["browse", "my-courses"] as const).map(t => (
                <button key={t} onClick={() => setCourseTab(t)} style={{
                  padding: "7px 18px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  background: courseTab === t ? colors.accent : "transparent", color: courseTab === t ? "#000" : colors.textSecondary,
                  border: courseTab === t ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                }}>
                  {t === "browse" ? "Browse" : "My Courses"}
                </button>
              ))}
            </div>

            {courseTab === "browse" && (
              <>
                {/* Search + Level filter */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <div style={{
                    flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 14px", borderRadius: "10px",
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  }}>
                    <Search size={14} color={colors.textSecondary} />
                    <input
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search courses..." style={{
                        flex: 1, background: "none", border: "none", outline: "none",
                        color: colors.text, fontSize: "13px",
                      }}
                    />
                  </div>
                  <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={{
                    padding: "8px 14px", borderRadius: "10px", fontSize: "12px",
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                    color: colors.text, outline: "none", cursor: "pointer",
                  }}>
                    {["All Levels", "Beginner", "Intermediate", "Advanced"].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "18px" }}>
                  {filteredCourses.map(renderCourseCard)}
                </div>
                {filteredCourses.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px", color: colors.textSecondary }}>
                    <Search size={32} style={{ opacity: 0.3, marginBottom: "12px" }} />
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>No courses found</div>
                  </div>
                )}
              </>
            )}

            {courseTab === "my-courses" && (
              <div>
                {myCourses.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "18px" }}>
                    {myCourses.map(renderCourseCard)}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: colors.textSecondary }}>
                    <BookOpen size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
                    <div style={{ fontSize: "15px", fontWeight: 600, color: colors.text }}>No courses yet</div>
                    <div style={{ fontSize: "13px", marginTop: "4px" }}>Enroll in a course to start learning.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── LEARNING PATHS ── */}
        {activeSection === "paths" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Learning Paths</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Structured tracks that organize courses into clear outcomes.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
              {learningPaths.map((path) => (
                <div key={path.slug} style={{
                  borderRadius: "16px", padding: "24px",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  cursor: "pointer", transition: "all 0.3s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = path.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"; }}
                >
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "14px",
                    background: `${path.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                    color: path.color, marginBottom: "16px",
                  }}>
                    {path.icon}
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 700, color: colors.text }}>{path.title}</h3>
                  <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: colors.textSecondary, lineHeight: 1.5 }}>{path.description}</p>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: colors.textSecondary }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><BookOpen size={12} /> {path.courses} courses</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {path.hours} hours</span>
                  </div>
                  <button style={{
                    marginTop: "16px", width: "100%", padding: "10px", borderRadius: "10px",
                    background: `${path.color}15`, color: path.color, border: `1px solid ${path.color}40`,
                    fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  }}>
                    Start Path
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LIVE SESSIONS ── */}
        {activeSection === "live" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Live Sessions</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Attendance, engagement, and upcoming live academy sessions.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {liveSessions.map((session) => (
                <div key={session.id} style={{
                  display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                  borderRadius: "14px",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${session.status === "live" ? `${session.color}50` : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")}`,
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
                    background: `${session.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Camera size={20} color={session.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{session.title}</span>
                      {session.status === "live" && (
                        <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: "rgba(16,185,129,0.2)", color: "#10B981" }}>
                          LIVE NOW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      Hosted by {session.host} · {session.date} · {session.attendees} attendees
                    </div>
                  </div>
                  <button style={{
                    padding: "8px 20px", borderRadius: "10px", border: "none", cursor: "pointer",
                    background: session.status === "live" ? "#10B981" : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    color: session.status === "live" ? "#fff" : colors.text,
                    fontWeight: 700, fontSize: "12px",
                  }}>
                    {session.status === "live" ? "Join Now" : "RSVP"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ASSIGNMENTS ── */}
        {activeSection === "assignments" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Assignments</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Track and submit your coursework.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {assignments.map((a) => {
                const statusColors = { pending: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" }, submitted: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" }, graded: { bg: "rgba(34,197,94,0.15)", color: "#22c55e" } };
                const sc = statusColors[a.status];
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                    borderRadius: "14px",
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={20} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{a.title}</div>
                      <div style={{ fontSize: "12px", color: colors.textSecondary }}>{a.course} · Due: {a.due}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {a.grade && <span style={{ fontSize: "16px", fontWeight: 800, color: "#22c55e" }}>{a.grade}</span>}
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "100px", background: sc.bg, color: sc.color, textTransform: "capitalize" }}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PEER REVIEW ── */}
        {activeSection === "peer-review" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Peer Review</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Give and receive feedback from fellow learners.</p>
            <div style={{
              padding: "32px", borderRadius: "16px", textAlign: "center",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            }}>
              <Users size={40} color="#A855F7" style={{ opacity: 0.4, marginBottom: "12px" }} />
              <div style={{ fontSize: "16px", fontWeight: 700, color: colors.text, marginBottom: "6px" }}>No reviews pending</div>
              <div style={{ fontSize: "13px", color: colors.textSecondary }}>When you submit assignments, they'll appear here for peer feedback.</div>
            </div>
          </div>
        )}

        {/* ── MY PROGRESS ── */}
        {activeSection === "progress" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>My Progress</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Track your learning journey.</p>

            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
              {[
                { label: "Enrolled", value: progressStats.coursesEnrolled, color: "#3b82f6" },
                { label: "Completed", value: progressStats.coursesCompleted, color: "#22c55e" },
                { label: "Hours Learned", value: progressStats.totalHours, color: "#f59e0b" },
                { label: "Day Streak", value: `${progressStats.streak}🔥`, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{
                  padding: "18px", borderRadius: "14px", textAlign: "center",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: colors.textSecondary, fontWeight: 600, marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Badges */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: 700, color: colors.text }}>Badges & Achievements</h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {progressStats.badges.map(b => (
                <div key={b.name} style={{
                  width: "90px", padding: "16px 8px", borderRadius: "14px", textAlign: "center",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  opacity: b.earned ? 1 : 0.35,
                }}>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>{b.icon}</div>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: colors.text }}>{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CERTIFICATES ── */}
        {activeSection === "certificates" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Certificates</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Your earned certifications and credentials.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {certificates.map(cert => (
                <div key={cert.id} style={{
                  display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                  borderRadius: "14px",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
                    background: `${cert.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                    color: cert.color,
                  }}>
                    {cert.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{cert.title}</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>{cert.issuer} · {cert.date}</div>
                  </div>
                  <button style={{
                    padding: "7px 16px", borderRadius: "8px", border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                    background: "transparent", color: colors.text, fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <Download size={12} /> View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI TUTOR ── */}
        {activeSection === "ai-tutor" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>AI Tutor</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Get instant help with your coursework from the AI-powered tutor.</p>
            <div style={{
              borderRadius: "16px", overflow: "hidden",
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
            }}>
              {/* Chat area */}
              <div style={{ padding: "24px", minHeight: "300px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(236,72,153,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Sparkles size={18} color="#EC4899" />
                  </div>
                  <div style={{ padding: "14px 18px", borderRadius: "14px", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", maxWidth: "80%" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: colors.text, lineHeight: 1.6 }}>
                      Hi! I'm your AI Tutor. I can help with course material, explain concepts, quiz you, or give feedback on your assignments. What would you like help with today?
                    </p>
                  </div>
                </div>
              </div>
              {/* Input */}
              <div style={{
                padding: "16px 20px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                display: "flex", gap: "10px",
              }}>
                <input placeholder="Ask the AI Tutor anything..." style={{
                  flex: 1, padding: "10px 14px", borderRadius: "10px",
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  color: colors.text, fontSize: "13px", outline: "none",
                }} />
                <button style={{
                  padding: "10px 20px", borderRadius: "10px", border: "none",
                  background: "#EC4899", color: "#fff", fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <Send size={14} /> Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DISCUSSIONS ── */}
        {activeSection === "discussions" && (
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: 800, color: colors.text }}>Discussions</h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: colors.textSecondary }}>Join conversations with fellow learners.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {discussions.map(d => (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                  borderRadius: "14px", cursor: "pointer",
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  transition: "all 0.2s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366F1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"; }}
                >
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MessageSquare size={20} color="#6366F1" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{d.title}</div>
                    <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                      by {d.author} · {d.replies} replies · {d.lastActivity}
                    </div>
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: colors.textSecondary }}>
                    {d.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabNotifications({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [notifications, setNotifications] = useState([
    {
      id: 1, title: "Welcome to Street Voices", body: "Your universal notification center is ready.",
      source: "SYSTEM", icon: <Send size={20} />, iconColor: "#ef4444", iconBg: "rgba(239,68,68,0.15)",
      time: "just now", link: "/", read: false,
    },
    {
      id: 2, title: "New message", body: "You have unread messages waiting for you.",
      source: "MESSAGES", icon: <MessageCircle size={20} />, iconColor: "#22c55e", iconBg: "rgba(34,197,94,0.15)",
      time: "just now", link: "/messages", read: false,
    },
    {
      id: 3, title: "New follower", body: "Maya Chen started following you.",
      source: "SOCIAL", icon: <Users size={20} />, iconColor: "#3b82f6", iconBg: "rgba(59,130,246,0.15)",
      time: "2 hours ago", link: "/profile", read: false,
    },
    {
      id: 4, title: "Job application viewed", body: "Black Voices Media Collective viewed your application for Youth Media Producer.",
      source: "JOBS", icon: <Briefcase size={20} />, iconColor: "#f59e0b", iconBg: "rgba(245,158,11,0.15)",
      time: "5 hours ago", link: "/jobs", read: false,
    },
    {
      id: 5, title: "Commission deadline approaching", body: "Your mural commission for The Urban Kitchen is due in 7 days.",
      source: "TASKS", icon: <Clock size={20} />, iconColor: "#ef4444", iconBg: "rgba(239,68,68,0.15)",
      time: "1 day ago", link: "/tasks", read: true,
    },
    {
      id: 6, title: "Gallery artwork liked", body: "Diego Alvarez loved your piece 'Chromatic Rebellion'.",
      source: "GALLERY", icon: <Heart size={20} />, iconColor: "#ec4899", iconBg: "rgba(236,72,153,0.15)",
      time: "1 day ago", link: "/gallery", read: true,
    },
    {
      id: 7, title: "Event reminder", body: "Street Art Festival — Panel Discussion starts tomorrow at 1:00 PM.",
      source: "CALENDAR", icon: <Calendar size={20} />, iconColor: "#8b5cf6", iconBg: "rgba(139,92,246,0.15)",
      time: "2 days ago", link: "/calendar", read: true,
    },
    {
      id: 8, title: "New comment on portfolio", body: "Suki Park commented on 'Voices of the Underground': Amazing depth in this piece!",
      source: "SOCIAL", icon: <MessageSquare size={20} />, iconColor: "#06b6d4", iconBg: "rgba(6,182,212,0.15)",
      time: "3 days ago", link: "/portfolio", read: true,
    },
  ]);

  const markRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const sources = ["all", ...Array.from(new Set(notifications.map((n) => n.source.toLowerCase())))];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (sourceFilter !== "all" && n.source.toLowerCase() !== sourceFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: colors.text }}>Notifications</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: colors.textSecondary }}>
            {unreadCount === 0 ? "You're all caught up." : `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setNotifications([...notifications])}
            style={{
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              color: colors.text, display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={markAllRead}
            style={{
              padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              background: colors.accent, border: "none", color: "#000",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </div>

      {/* Filters */}
      <GlassCard colors={colors} isDark={isDark}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 20px", borderRadius: "100px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  background: filter === f ? colors.accent : "transparent",
                  color: filter === f ? "#000" : colors.text,
                  border: filter === f ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                  textTransform: "capitalize",
                }}
              >
                {f === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: colors.textSecondary, letterSpacing: "0.5px", textTransform: "uppercase" }}>Source</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: "8px 14px", borderRadius: "10px", fontSize: "13px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                color: colors.text, outline: "none", cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {sources.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All sources" : s}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Notification List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
        {filtered.length === 0 ? (
          <GlassCard colors={colors} isDark={isDark}>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Bell size={40} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: "12px" }} />
              <div style={{ fontSize: "15px", fontWeight: 600, color: colors.text }}>No notifications</div>
              <div style={{ fontSize: "13px", color: colors.textSecondary, marginTop: "4px" }}>
                {filter === "unread" ? "All notifications have been read." : "Nothing to show for this filter."}
              </div>
            </div>
          </GlassCard>
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              style={{
                display: "flex", alignItems: "center", gap: "16px", padding: "18px 20px",
                borderRadius: "14px",
                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.8)",
                border: `1px solid ${notif.read ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)") : `${colors.accent}44`}`,
                transition: "all 0.2s",
              }}
            >
              {/* Icon */}
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0,
                background: notif.iconBg, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(() => { const el = notif.icon; return <span style={{ color: notif.iconColor }}>{el}</span>; })()}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>{notif.title}</span>
                  <span style={{
                    fontSize: "10px", padding: "3px 10px", borderRadius: "6px", fontWeight: 700,
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    color: colors.textSecondary, letterSpacing: "0.5px",
                  }}>
                    {notif.source}
                  </span>
                  {!notif.read && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.accent }} />
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: colors.textSecondary, lineHeight: 1.4 }}>{notif.body}</p>
                <div style={{ fontSize: "12px", color: "rgba(128,128,128,0.6)", marginTop: "6px" }}>
                  {notif.time} · opens {notif.link}
                </div>
              </div>

              {/* Mark Read */}
              {!notif.read && (
                <button
                  onClick={() => markRead(notif.id)}
                  style={{
                    padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: "transparent", border: `1px solid ${colors.accent}`,
                    color: colors.accent, display: "flex", alignItems: "center", gap: "6px",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={14} /> Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TabSettings({ profile, colors, isDark }: { profile: StreetProfile; colors: any; isDark: boolean }) {
  const STORAGE_KEY = "sv_profile_settings";
  const defaults: Record<string, boolean> = {
    // Profile Visibility
    "Public Profile": profile.is_public !== false,
    "Show in Directory": true,
    "Show Activity": true,
    "Show Portfolio on About": true,
    // Notifications
    "New Followers": true,
    "Messages": true,
    "Job Inquiries": true,
    "Community Updates": false,
    "Calendar Reminders": true,
    "Task Deadlines": true,
    "Academy Progress": true,
    "Gallery Interactions": true,
    // Privacy
    "Show Email": false,
    "Allow Direct Messages": true,
    "Show Online Status": false,
    "Allow Profile Embedding": false,
    // Messages & Communication
    "Read Receipts": true,
    "Message Previews": true,
    "Auto-Reply When Busy": false,
    // Calendar
    "Show Calendar Publicly": false,
    "Allow Booking Requests": true,
    "Weekly Digest": true,
    "Sync Google Calendar": false,
    // Street Gallery
    "Gallery Visible": true,
    "Allow Inquiries": true,
    "Show Sold Prices": true,
    "Enable Favorites": true,
    "Watermark Images": false,
    // Jobs
    "Open to Opportunities": true,
    "Show on Job Board": true,
    "Job Expiry Reminders": true,
    "Auto-Save Applications": true,
    // Social Media
    "Cross-Post Updates": false,
    "Show Social Links": true,
    "Auto-Share Gallery": false,
    // Academy
    "Show Certifications": true,
    "Learning Reminders": true,
    "Share Progress": false,
    // Documents & Storage
    "Auto-Organize Files": true,
    "Storage Alerts": true,
    "Document Versioning": true,
    // News & Activity
    "Show News Feed": true,
    "Activity Log": true,
    "Trending Alerts": false,
  };
  const [settings, setSettings] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch {}
    return defaults;
  });
  const [savedToast, setSavedToast] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");

  const toggleSetting = (label: string) => {
    setSettings((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
      return next;
    });
  };

  const sections = [
    {
      title: "Profile Visibility",
      icon: <User size={16} />,
      items: [
        { label: "Public Profile", desc: "Allow anyone to view your profile" },
        { label: "Show in Directory", desc: "Appear in the Street Profile directory" },
        { label: "Show Activity", desc: "Display recent activity on your profile" },
        { label: "Show Portfolio on About", desc: "Show portfolio showcase on your About tab" },
      ],
    },
    {
      title: "Notifications",
      icon: <Bell size={16} />,
      items: [
        { label: "New Followers", desc: "Get notified when someone follows you" },
        { label: "Messages", desc: "Receive notifications for new messages" },
        { label: "Job Inquiries", desc: "Get notified about new job offers" },
        { label: "Community Updates", desc: "Receive Street Voices community news" },
        { label: "Calendar Reminders", desc: "Get reminders for upcoming events and bookings" },
        { label: "Task Deadlines", desc: "Alerts when tasks are approaching their due date" },
        { label: "Academy Progress", desc: "Updates on course progress and new content" },
        { label: "Gallery Interactions", desc: "Likes, inquiries, and comments on your artwork" },
      ],
    },
    {
      title: "Privacy & Security",
      icon: <Eye size={16} />,
      items: [
        { label: "Show Email", desc: "Display contact email on profile" },
        { label: "Allow Direct Messages", desc: "Let anyone send you messages" },
        { label: "Show Online Status", desc: "Display when you are online" },
        { label: "Allow Profile Embedding", desc: "Allow your profile to be embedded on external sites" },
      ],
    },
    {
      title: "Messages & Communication",
      icon: <MessageSquare size={16} />,
      items: [
        { label: "Read Receipts", desc: "Show when you've read messages" },
        { label: "Message Previews", desc: "Show message previews in notifications" },
        { label: "Auto-Reply When Busy", desc: "Automatically reply when your status is busy" },
      ],
    },
    {
      title: "Calendar & Bookings",
      icon: <Calendar size={16} />,
      items: [
        { label: "Show Calendar Publicly", desc: "Let visitors see your availability" },
        { label: "Allow Booking Requests", desc: "Enable others to request bookings with you" },
        { label: "Weekly Digest", desc: "Receive a weekly summary of upcoming events" },
        { label: "Sync Google Calendar", desc: "Sync events with your Google Calendar" },
      ],
    },
    {
      title: "Street Gallery",
      icon: <Image size={16} />,
      items: [
        { label: "Gallery Visible", desc: "Make your gallery visible to visitors" },
        { label: "Allow Inquiries", desc: "Let buyers inquire about your pieces" },
        { label: "Show Sold Prices", desc: "Display prices of sold artwork for credibility" },
        { label: "Enable Favorites", desc: "Allow visitors to favorite your artwork" },
        { label: "Watermark Images", desc: "Add a watermark to gallery images for protection" },
      ],
    },
    {
      title: "Jobs & Opportunities",
      icon: <Briefcase size={16} />,
      items: [
        { label: "Open to Opportunities", desc: "Signal to employers that you're available" },
        { label: "Show on Job Board", desc: "Appear in job board recommendations" },
        { label: "Job Expiry Reminders", desc: "Get reminded before saved jobs expire" },
        { label: "Auto-Save Applications", desc: "Automatically save draft applications" },
      ],
    },
    {
      title: "Social Media",
      icon: <Share2 size={16} />,
      items: [
        { label: "Cross-Post Updates", desc: "Share profile updates to connected platforms" },
        { label: "Show Social Links", desc: "Display social media links on your profile" },
        { label: "Auto-Share Gallery", desc: "Automatically share new gallery pieces to social" },
      ],
    },
    {
      title: "Academy & Learning",
      icon: <BookOpen size={16} />,
      items: [
        { label: "Show Certifications", desc: "Display earned certifications on your profile" },
        { label: "Learning Reminders", desc: "Get reminders to continue your courses" },
        { label: "Share Progress", desc: "Show course progress publicly" },
      ],
    },
    {
      title: "Documents & Storage",
      icon: <FileText size={16} />,
      items: [
        { label: "Auto-Organize Files", desc: "Automatically categorize uploaded documents" },
        { label: "Storage Alerts", desc: "Get notified when storage is running low" },
        { label: "Document Versioning", desc: "Keep version history of uploaded documents" },
      ],
    },
    {
      title: "News & Activity",
      icon: <TrendingUp size={16} />,
      items: [
        { label: "Show News Feed", desc: "Display news and updates on your profile" },
        { label: "Activity Log", desc: "Track and display your platform activity" },
        { label: "Trending Alerts", desc: "Get notified about trending content in your niche" },
      ],
    },
  ];

  const isEnabled = (label: string) => settings[label] ?? false;

  // Filter sections by search
  const filteredSections = settingsSearch.trim()
    ? sections.map((s) => ({
        ...s,
        items: s.items.filter(
          (item) =>
            item.label.toLowerCase().includes(settingsSearch.toLowerCase()) ||
            item.desc.toLowerCase().includes(settingsSearch.toLowerCase())
        ),
      })).filter((s) => s.items.length > 0)
    : sections;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Saved toast */}
      {savedToast && (
        <div style={{
          position: "fixed", bottom: "32px", right: "32px", zIndex: 10010,
          background: "rgba(34,197,94,0.9)", color: "#fff", padding: "12px 24px",
          borderRadius: "10px", fontSize: "14px", fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: "8px",
          animation: "slideInUp 0.3s ease-out",
        }}>
          <CheckCircle2 size={16} /> Settings saved
        </div>
      )}

      {/* Search bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 16px", borderRadius: "12px",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
        border: `1px solid ${colors.border}`,
      }}>
        <Search size={16} color={colors.textSecondary} />
        <input
          type="text"
          placeholder="Search settings..."
          value={settingsSearch}
          onChange={(e) => setSettingsSearch(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: colors.text, fontSize: "14px",
          }}
        />
        {settingsSearch && (
          <button
            onClick={() => setSettingsSearch("")}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textSecondary, padding: "2px" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filteredSections.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textSecondary }}>
          <Search size={32} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <div style={{ fontSize: "14px", fontWeight: 600 }}>No settings match "{settingsSearch}"</div>
        </div>
      )}

      {filteredSections.map((section, si) => (
        <GlassCard key={si} colors={colors} isDark={isDark}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "rgba(234,179,8,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#eab308",
            }}>
              {section.icon}
            </div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: colors.text }}>
              {section.title}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {section.items.map((item, ii) => (
              <div
                key={ii}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: ii < section.items.length - 1 ? `1px solid ${colors.border}` : "none",
                }}
              >
                <div style={{ flex: 1, marginRight: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary, marginTop: "2px" }}>{item.desc}</div>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => toggleSetting(item.label)}
                  style={{
                    width: "44px",
                    height: "24px",
                    borderRadius: "100px",
                    background: isEnabled(item.label)
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
                      left: isEnabled(item.label) ? "22px" : "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: isEnabled(item.label) ? "#000" : isDark ? "#666" : "#fff",
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

      {/* Link to General Settings */}
      <GlassCard colors={colors} isDark={isDark}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "rgba(234,179,8,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#eab308",
          }}>
            <Settings size={16} />
          </div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: colors.text }}>
            General Settings
          </h3>
        </div>
        <div style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "14px" }}>
          Manage your account, chat preferences, speech, data, and more from the general settings panel.
        </div>
        <button
          onClick={() => {
            const event = new CustomEvent("open-librechat-settings");
            window.dispatchEvent(event);
          }}
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 18px", borderRadius: "10px", border: "none",
            background: "#eab308", color: "#fff",
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#facc15"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#eab308"; }}
        >
          <Settings size={14} /> Open General Settings
        </button>
      </GlassCard>
    </div>
  );
}
