import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
  Search,
  Plus,
  MessageSquare,
  Eye,
  Heart,
  Pin,
  Star,
  Filter,
  TrendingUp,
  Clock,
  HelpCircle,
  Lightbulb,
  Trophy,
  Shield,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import { SB_API_BASE } from '~/components/streetbot/shared/apiConfig';
import { useGlassStyles } from '../shared/useGlassStyles';
import { GlassBackground } from '../shared/GlassBackground';
import { useResponsive } from '../hooks/useResponsive';
import { useAuthContext } from '~/hooks/AuthContext';
import { getOrCreateUserId } from "@/lib/userId";

// Author profile type for enrichment
type AuthorProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_featured: boolean;
  primary_roles: string[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  display_order: number;
  is_restricted: boolean;
  post_count: number;
};

type Post = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  content_preview: string;
  author_id: string | null;
  author_name: string | null;
  is_anonymous: boolean;
  anonymous_name: string | null;
  post_type: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  is_featured: boolean;
  view_count: number;
  reply_count: number;
  like_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  last_activity_at: string;
  created_at: string;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  lightbulb: <Lightbulb size={18} />,
  star: <Star size={18} />,
  trophy: <Trophy size={18} />,
  "question-circle": <HelpCircle size={18} />,
  heart: <Heart size={18} />,
  shield: <Shield size={18} />,
  megaphone: <Megaphone size={18} />,
  chat: <MessageCircle size={18} />,
};

const POST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  discussion: { label: "Discussion", color: "#6366F1" },
  question: { label: "Question", color: "#3B82F6" },
  story: { label: "Story", color: "#10B981" },
  resource: { label: "Resource", color: "#F59E0B" },
  announcement: { label: "Announcement", color: "#EF4444" },
};

export default function ForumPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark, colors, glassCard, glassSurface, glassTag, cardHoverHandlers } = useGlassStyles();
  const { isMobile } = useResponsive();
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);
  const [showMobileCategories, setShowMobileCategories] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 250);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get("category")
  );
  const [sortBy, setSortBy] = useState<"last_activity_at" | "created_at" | "like_count">(
    "last_activity_at"
  );

  // Author profiles for enrichment (keyed by user_id)
  const [authorProfiles, setAuthorProfiles] = useState<Record<string, AuthorProfile>>({});

  const loadCategories = useCallback(async () => {
    try {
      const resp = await fetch(`${SB_API_BASE}/forum/categories?user_id=${userId}`);
      if (resp.ok) {
        const data = await resp.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ user_id: userId, sort_by: sortBy });
      if (selectedCategory) params.append("category_slug", selectedCategory);
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);

      const resp = await fetch(`${SB_API_BASE}/forum/posts?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedCategory, debouncedSearchQuery, sortBy]);

  // Batch load author profiles for posts
  const loadAuthorProfiles = useCallback(async (postList: Post[]) => {
    const authorIds = [...new Set(
      postList
        .filter((p) => !p.is_anonymous)
        .map((p) => p.author_id)
        .filter((id): id is string => id !== null && id !== "")
    )];

    if (authorIds.length === 0) return;

    try {
      const resp = await fetch(`${SB_API_BASE}/street-profiles/batch-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: authorIds }),
      });
      if (!resp.ok) return;
      const profiles = await resp.json();
      setAuthorProfiles(profiles);
    } catch {
      // Profiles are optional, don't error
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Fetch author profiles when posts change
  useEffect(() => {
    if (posts.length > 0) {
      loadAuthorProfiles(posts);
    }
  }, [posts, loadAuthorProfiles]);

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const method = isLiked ? "DELETE" : "POST";
      await fetch(`${SB_API_BASE}/forum/posts/${postId}/like?user_id=${userId}`, { method });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !isLiked, like_count: isLiked ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Helper: show a readable name, not a UUID
  const displayAuthorName = (name: string | null) => {
    if (!name) return "Unknown";
    // If the name looks like a UUID, show "Community Member" instead
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
      return "Community Member";
    }
    return name;
  };

  return (
    <div>
      {/* GLASSMORPHISM Background - Vivid colors that show through glass */}
      <GlassBackground />

      <div style={{ padding: "20px 0", minHeight: "100vh", color: colors.text, position: "relative", zIndex: 1, overflowX: "hidden" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: isMobile ? "0 12px" : "0 24px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "30px",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(2rem, 4vw, 2.5rem)",
                  margin: 0,
                  color: colors.accent,
                  textShadow: isDark ? "0 0 20px rgba(255, 214, 0, 0.3)" : "none",
                }}
              >
                Word on the Street
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: "1.1rem", margin: "5px 0 0 0" }}>
                Community discussions, peer support, and lived experience sharing
              </p>
            </div>
            <button
              onClick={() => navigate("/forum/new")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                borderRadius: "999px",
                background: colors.accent,
                color: "#000",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)";
              }}
            >
              <Plus size={20} /> New Post
            </button>
          </div>

          {/* Mobile category toggle */}
          {isMobile && (
            <button
              onClick={() => setShowMobileCategories(!showMobileCategories)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "12px",
                background: colors.surface,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: "16px",
                width: "100%",
              }}
            >
              <Filter size={16} />
              {selectedCategory
                ? categories.find((c) => c.slug === selectedCategory)?.name ?? "All Categories"
                : "All Categories"}
              <span style={{ marginLeft: "auto", fontSize: "12px" }}>
                {showMobileCategories ? "▲" : "▼"}
              </span>
            </button>
          )}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "280px 1fr", gap: isMobile ? "16px" : "30px" }}>
            {/* Sidebar - Categories with Glassmorphism */}
            <aside style={{ display: isMobile && !showMobileCategories ? "none" : "block" }}>
              <div
                style={{
                  ...glassCard,
                  padding: "20px",
                  position: "sticky",
                  top: "20px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 16px 0",
                  }}
                >
                  Categories
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: !selectedCategory ? `rgba(255, 214, 0, 0.15)` : "transparent",
                      backdropFilter: !selectedCategory ? "blur(10px)" : "none",
                      WebkitBackdropFilter: !selectedCategory ? "blur(10px)" : "none",
                      border: `1px solid ${!selectedCategory ? colors.accent : "transparent"}`,
                      cursor: "pointer",
                      color: !selectedCategory ? colors.accent : colors.text,
                      fontWeight: !selectedCategory ? 600 : 400,
                      textAlign: "left",
                      width: "100%",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCategory) {
                        e.currentTarget.style.background = colors.surfaceHover;
                        e.currentTarget.style.borderColor = colors.border;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCategory) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }
                    }}
                  >
                    <MessageSquare size={18} />
                    <span style={{ flex: 1 }}>All Posts</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.slug)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background:
                          selectedCategory === cat.slug ? `${cat.color}20` : "transparent",
                        backdropFilter: selectedCategory === cat.slug ? "blur(10px)" : "none",
                        WebkitBackdropFilter: selectedCategory === cat.slug ? "blur(10px)" : "none",
                        border: `1px solid ${selectedCategory === cat.slug ? cat.color : "transparent"}`,
                        cursor: "pointer",
                        color: selectedCategory === cat.slug ? cat.color : colors.text,
                        fontWeight: selectedCategory === cat.slug ? 600 : 400,
                        textAlign: "left",
                        width: "100%",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCategory !== cat.slug) {
                          e.currentTarget.style.background = colors.surfaceHover;
                          e.currentTarget.style.borderColor = colors.border;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCategory !== cat.slug) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = "transparent";
                        }
                      }}
                    >
                      <span style={{ color: cat.color }}>
                        {CATEGORY_ICONS[cat.icon || "chat"] || <MessageCircle size={18} />}
                      </span>
                      <span style={{ flex: 1 }}>{cat.name}</span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: colors.textMuted,
                          background: colors.cardBg,
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          padding: "2px 8px",
                          borderRadius: "8px",
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {cat.post_count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main>
              {/* Search & Filters with Glassmorphism */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    ...glassSurface,
                    flex: 1,
                    minWidth: "200px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <Search size={18} color={colors.textSecondary} />
                  <input
                    type="text"
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: colors.text,
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
                <div
                  style={{
                    ...glassSurface,
                    display: "flex",
                    gap: "4px",
                    padding: "6px",
                  }}
                >
                  {[
                    { key: "last_activity_at", icon: <TrendingUp size={16} />, label: "Active" },
                    { key: "created_at", icon: <Clock size={16} />, label: "New" },
                    { key: "like_count", icon: <Heart size={16} />, label: "Popular" },
                  ].map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key as typeof sortBy)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: sortBy === key ? colors.accent : "transparent",
                        color: sortBy === key ? "#000" : colors.textSecondary,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: sortBy === key ? 600 : 400,
                        fontSize: "0.85rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Posts List with Glassmorphism */}
              {loading ? (
                <div
                  style={{
                    ...glassCard,
                    textAlign: "center",
                    padding: "60px",
                    color: colors.textSecondary,
                  }}
                >
                  Loading posts...
                </div>
              ) : posts.length === 0 ? (
                <div
                  style={{
                    ...glassCard,
                    textAlign: "center",
                    padding: "60px",
                  }}
                >
                  <MessageSquare size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
                  <p style={{ color: colors.textSecondary, margin: 0 }}>
                    No posts yet. Be the first to start a conversation!
                  </p>
                  <button
                    onClick={() => navigate("/forum/new")}
                    style={{
                      marginTop: "16px",
                      padding: "12px 24px",
                      borderRadius: "999px",
                      background: colors.accent,
                      color: "#000",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(255, 214, 0, 0.4)",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.4)";
                    }}
                  >
                    Create First Post
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/forum/post/${post.id}`)}
                      style={{
                        background: colors.cardBg,
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        border: `1px solid ${colors.border}`,
                        borderRadius: isMobile ? "16px" : "20px",
                        padding: isMobile ? "14px" : "20px",
                        cursor: "pointer",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        borderLeft: post.is_pinned ? `3px solid ${colors.accent}` : undefined,
                        boxShadow: colors.glassShadow,
                      }}
                      {...cardHoverHandlers}
                    >
                      <div style={{ display: "flex", gap: "14px" }}>
                        {/* Author Avatar - inline profile badge for non-anonymous posts */}
                        {post.is_anonymous ? (
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.8))",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              fontSize: "1.1rem",
                              fontWeight: 600,
                              color: "#fff",
                              border: `1px solid ${colors.border}`,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                            }}
                          >
                            {post.anonymous_name?.charAt(0) || "?"}
                          </div>
                        ) : post.author_id && authorProfiles[post.author_id] ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/creatives/${authorProfiles[post.author_id!].username}`);
                            }}
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              cursor: "pointer",
                            }}
                          >
                            {authorProfiles[post.author_id].avatar_url ? (
                              <img
                                src={authorProfiles[post.author_id].avatar_url!}
                                alt={authorProfiles[post.author_id].display_name}
                                style={{
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: `1px solid ${colors.border}`,
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "44px",
                                  height: "44px",
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, rgba(55, 65, 81, 0.8), rgba(75, 85, 99, 0.8))",
                                  backdropFilter: "blur(8px)",
                                  WebkitBackdropFilter: "blur(8px)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.1rem",
                                  fontWeight: 600,
                                  color: "#fff",
                                  border: `1px solid ${colors.border}`,
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                }}
                              >
                                {authorProfiles[post.author_id].display_name?.charAt(0) || "?"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, rgba(55, 65, 81, 0.8), rgba(75, 85, 99, 0.8))",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              fontSize: "1.1rem",
                              fontWeight: 600,
                              color: "#fff",
                              border: `1px solid ${colors.border}`,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                            }}
                          >
                            {post.author_name?.charAt(0) || "?"}
                          </div>
                        )}

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Meta row */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            {post.is_pinned && (
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: colors.accent,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: "rgba(255, 214, 0, 0.15)",
                                  padding: "4px 10px",
                                  borderRadius: "8px",
                                  backdropFilter: "blur(8px)",
                                  WebkitBackdropFilter: "blur(8px)",
                                }}
                              >
                                <Pin size={12} /> Pinned
                              </span>
                            )}
                            {post.is_featured && (
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: "#10B981",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: "rgba(16, 185, 129, 0.15)",
                                  padding: "4px 10px",
                                  borderRadius: "8px",
                                  backdropFilter: "blur(8px)",
                                  WebkitBackdropFilter: "blur(8px)",
                                }}
                              >
                                <Star size={12} /> Featured
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: `${POST_TYPE_LABELS[post.post_type]?.color || "#6366F1"}20`,
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                color: POST_TYPE_LABELS[post.post_type]?.color || "#6366F1",
                                fontWeight: 500,
                              }}
                            >
                              {POST_TYPE_LABELS[post.post_type]?.label || post.post_type}
                            </span>
                            {post.category_name && (
                              <span style={{ fontSize: "0.8rem", color: colors.textSecondary }}>
                                in {post.category_name}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3
                            style={{
                              fontSize: "1.15rem",
                              fontWeight: 600,
                              margin: "0 0 8px 0",
                              color: colors.text,
                            }}
                          >
                            {post.title}
                          </h3>

                          {/* Preview */}
                          <p
                            style={{
                              fontSize: "0.9rem",
                              color: colors.textSecondary,
                              margin: "0 0 12px 0",
                              lineHeight: 1.6,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {post.content_preview}
                          </p>

                          {/* Tags with glass effect */}
                          {post.tags.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                marginBottom: "12px",
                              }}
                            >
                              {post.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  style={glassTag}
                                >
                                  #{tag}
                                </span>
                              ))}
                              {post.tags.length > 3 && (
                                <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                                  +{post.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Footer */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              fontSize: "0.85rem",
                              color: colors.textSecondary,
                              paddingTop: "12px",
                              borderTop: `1px solid ${colors.border}`,
                            }}
                          >
                            {post.is_anonymous ? (
                              <span style={{ fontWeight: 500, fontStyle: "italic" }}>
                                {post.anonymous_name || "Anonymous"}
                              </span>
                            ) : post.author_id && authorProfiles[post.author_id] ? (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/creatives/${authorProfiles[post.author_id!].username}`);
                                }}
                                style={{
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  color: colors.accent,
                                  transition: "opacity 0.2s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                              >
                                {authorProfiles[post.author_id!].display_name}
                              </span>
                            ) : (
                              <span style={{ fontWeight: 500 }}>
                                {displayAuthorName(post.author_name)}
                              </span>
                            )}
                            <span style={{ color: colors.textMuted }}>|</span>
                            <span>{formatTime(post.last_activity_at)}</span>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLike(post.id, post.is_liked);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                background: post.is_liked ? "rgba(233, 30, 99, 0.15)" : "transparent",
                                backdropFilter: post.is_liked ? "blur(8px)" : "none",
                                WebkitBackdropFilter: post.is_liked ? "blur(8px)" : "none",
                                border: "none",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                cursor: "pointer",
                                color: post.is_liked ? "#E91E63" : colors.textSecondary,
                                transition: "all 0.2s ease",
                              }}
                            >
                              <Heart size={16} fill={post.is_liked ? "#E91E63" : "none"} />
                              {post.like_count}
                            </button>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 10px",
                              }}
                            >
                              <MessageSquare size={16} />
                              {post.reply_count}
                            </span>
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 10px",
                              }}
                            >
                              <Eye size={16} />
                              {post.view_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
