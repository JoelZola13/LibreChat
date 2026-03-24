import React, { useState, useEffect, useCallback } from "react";
import { isDirectory } from '~/config/appVariant';
import { useNavigate } from "react-router-dom";
import { Search, Grid as GridIcon, List, Users, Plus, MessageCircle, Bot } from "lucide-react";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId } from "@/lib/userId";
import { GROUP_ICONS, GROUP_COLORS } from "./agentIcons";

const GROUPS_API_URL = `${SB_API_BASE}/groups`;

type LastMessage = {
  content: string;
  timestamp: string;
  author: string;
  is_agent: boolean;
};

type Group = {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  tags: string[];
  is_public: boolean;
  is_member: boolean;
  last_message?: LastMessage | null;
  message_count?: number;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const { isDark, colors, glassCard, glassSurface, cardHoverHandlers, buttonHoverHandlers } = useGlassStyles();
  const { user: authUser } = useAuthContext();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const userId = getOrCreateUserId(authUser?.id);

  // Page-specific accent text color (not in shared hook)
  const accentText = isDark ? "#FFD600" : "#000";

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ user_id: userId });
      if (searchQuery) params.append("search", searchQuery);

      const resp = await fetch(`${GROUPS_API_URL}?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Join/leave group
  const toggleMembership = async (groupId: number, isMember: boolean) => {
    try {
      const endpoint = isMember
        ? `${GROUPS_API_URL}/${groupId}/leave?user_id=${encodeURIComponent(userId)}`
        : `${GROUPS_API_URL}/${groupId}/join?user_id=${encodeURIComponent(userId)}`;

      const resp = await fetch(endpoint, {
        method: isMember ? "DELETE" : "POST",
      });

      if (resp.ok || resp.status === 204) {
        // Update local state
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  is_member: !isMember,
                  member_count: isMember ? g.member_count - 1 : g.member_count + 1,
                }
              : g
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle membership:", error);
    }
  };

  const getAvatarColor = (name: string) => {
    const avatarColors = ["#FF0055", "#00FFDD", "#FFD700", "#7700FF", "#00FF00", "#FF5500"];
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(query) ||
      (group.description?.toLowerCase().includes(query)) ||
      group.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <GlassBackground />

      {/* Hero Section - Enhanced with glass effect */}
      <section
        style={{
          background: "transparent",
          padding: "60px 24px 48px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  fontWeight: 700,
                  color: colors.text,
                  marginBottom: "12px",
                }}
              >
                Community Groups
              </h1>
              <p
                style={{
                  fontSize: "1.125rem",
                  color: colors.textSecondary,
                  maxWidth: "600px",
                  margin: 0,
                }}
              >
                Discover and join communities that match your interests
              </p>
            </div>
            <button
              onClick={() => navigate("/groups/create")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 28px",
                borderRadius: "999px",
                background: colors.accent,
                color: "#000",
                fontWeight: 600,
                fontSize: "15px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
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
              <Plus size={20} /> Create Group
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div style={{ padding: "32px 24px", minHeight: "100vh", color: colors.text, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          {/* Search & Controls */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginBottom: "30px",
              flexWrap: "wrap",
            }}
          >
            {isDirectory ? (
              <>
                <style>{`.sv-search-input::placeholder { color: #000; opacity: 1; }`}</style>
                <div style={{ flex: 1, minWidth: "250px", display: "flex", alignItems: "center", borderRadius: 30, background: "#d3d3d3", overflow: "hidden", height: 46 }}>
                  <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", padding: "0 20px", background: "#fff" }}>
                    <input
                      type="text"
                      className="sv-search-input"
                      placeholder="Search groups by name, tags, or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: "100%", height: "100%", border: "none", background: "transparent", color: "#000", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    />
                  </div>
                  <button type="button" style={{ height: 46, padding: "1px 50px", borderRadius: 25, border: "none", background: "#FFD600", color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Search
                  </button>
                </div>
              </>
            ) : (
            <div
              style={{
                flex: 1,
                minWidth: "250px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                ...glassSurface,
                padding: "14px 20px",
                borderRadius: "30px",
                transition: "all 0.2s ease",
              }}
            >
              <Search size={20} color={colors.textSecondary} />
              <input
                type="text"
                placeholder="Search groups by name, tags, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "1rem",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: colors.text,
                }}
              />
            </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "4px",
                ...glassSurface,
                padding: "5px",
              }}
            >
              {[
                { mode: "grid" as const, Icon: GridIcon },
                { mode: "list" as const, Icon: List },
              ].map(({ mode, Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: viewMode === mode ? "#000" : colors.textSecondary,
                    transition: "all 0.2s ease",
                    background: viewMode === mode ? colors.accent : "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (viewMode !== mode) {
                      e.currentTarget.style.background = colors.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== mode) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: "24px",
              }}
            >
              Loading groups...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: "24px",
              }}
            >
              <Users size={48} color={colors.textMuted} style={{ marginBottom: "16px" }} />
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: colors.text, marginBottom: "8px" }}>
                No groups found
              </h3>
              <p>Be the first to create one!</p>
            </div>
          ) : (
            /* Groups Grid/List */
            <div
              style={{
                display: viewMode === "grid" ? "grid" : "flex",
                gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(350px, 1fr))" : undefined,
                flexDirection: viewMode === "list" ? "column" : undefined,
                gap: "24px",
              }}
            >
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    ...glassCard,
                    padding: "24px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    display: viewMode === "list" ? "flex" : "block",
                    alignItems: viewMode === "list" ? "center" : undefined,
                    gap: viewMode === "list" ? "20px" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.borderHover;
                    e.currentTarget.style.transform = viewMode === "list" ? "translateX(8px)" : "translateY(-8px)";
                    e.currentTarget.style.background = colors.surfaceHover;
                    e.currentTarget.style.boxShadow = isDark
                      ? "0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(139, 92, 246, 0.15)"
                      : "0 20px 40px rgba(31, 38, 135, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.transform = "translateY(0) translateX(0)";
                    e.currentTarget.style.background = colors.cardBg;
                    e.currentTarget.style.boxShadow = colors.glassShadow;
                  }}
                >
                  <div
                    onClick={() => navigate(`/groups/${group.id}`)}
                    style={{
                      display: "flex",
                      gap: "15px",
                      marginBottom: viewMode === "list" ? "0" : "15px",
                      flex: viewMode === "list" ? 1 : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "16px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: GROUP_COLORS[group.id] || "#666",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                        border: `2px solid ${colors.border}`,
                      }}
                    >
                      {GROUP_ICONS[group.id] ? (
                        <img
                          src={GROUP_ICONS[group.id]}
                          alt={group.name}
                          style={{ width: "32px", height: "32px", filter: "brightness(0) invert(1)" }}
                        />
                      ) : (
                        <Users size={32} color="#fff" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: "1.2rem",
                          marginBottom: "8px",
                          color: colors.text,
                          margin: "0 0 8px 0",
                        }}
                      >
                        {group.name}
                      </h3>
                      <p
                        style={{
                          fontSize: "0.9rem",
                          color: colors.textSecondary,
                          lineHeight: 1.4,
                          marginBottom: "12px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          margin: "0 0 12px 0",
                        }}
                      >
                        {group.description || "No description"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginBottom: "10px",
                        }}
                      >
                        {group.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.2)",
                              color: accentText,
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              padding: "4px 10px",
                              borderRadius: "12px",
                              border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.3)" : "rgba(255, 214, 0, 0.4)"}`,
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      width: viewMode === "list" ? "auto" : "100%",
                      flexDirection: viewMode === "list" ? "row" : "row",
                    }}
                  >
                    {/* Chat Button - Only show for members */}
                    {group.is_member && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/groups/${group.id}?tab=chat`);
                        }}
                        style={{
                          flex: viewMode === "list" ? "none" : 1,
                          width: viewMode === "list" ? "48px" : undefined,
                          padding: "12px 16px",
                          borderRadius: "14px",
                          fontWeight: 600,
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          background: isDark ? "rgba(255, 214, 0, 0.15)" : "rgba(255, 214, 0, 0.2)",
                          color: colors.accent,
                          transition: "all 0.2s ease",
                          border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.3)" : "rgba(255, 214, 0, 0.4)"}`,
                          cursor: "pointer",
                        }}
                      >
                        <MessageCircle size={18} />
                        {viewMode !== "list" && "Chat"}
                      </button>
                    )}

                    {/* Join/Joined Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMembership(group.id, group.is_member);
                      }}
                      style={{
                        flex: viewMode === "list" ? "none" : 1,
                        width: viewMode === "list" ? "120px" : undefined,
                        padding: "12px 16px",
                        borderRadius: "14px",
                        fontWeight: 600,
                        fontSize: "14px",
                        background: group.is_member
                          ? isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
                          : colors.accent,
                        color: group.is_member ? colors.textSecondary : "#000",
                        transition: "all 0.2s ease",
                        border: group.is_member ? `1px solid ${colors.border}` : "none",
                        cursor: "pointer",
                        boxShadow: group.is_member ? "none" : "0 4px 14px rgba(255, 214, 0, 0.3)",
                      }}
                      onMouseEnter={(e) => {
                        if (!group.is_member) {
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 6px 20px rgba(255, 214, 0, 0.5)";
                        } else {
                          e.currentTarget.style.borderColor = "#ef4444";
                          e.currentTarget.style.color = "#ef4444";
                          e.currentTarget.style.background = isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        if (group.is_member) {
                          e.currentTarget.style.borderColor = colors.border;
                          e.currentTarget.style.color = colors.textSecondary;
                          e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
                          e.currentTarget.style.boxShadow = "none";
                        } else {
                          e.currentTarget.style.boxShadow = "0 4px 14px rgba(255, 214, 0, 0.3)";
                        }
                      }}
                    >
                      {group.is_member ? "Joined" : "Join Group"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
