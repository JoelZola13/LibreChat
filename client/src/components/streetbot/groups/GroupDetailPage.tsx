import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, Bot, Hash } from "lucide-react";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId } from "@/lib/userId";

type Group = {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  tags: string[];
  is_public: boolean;
  is_member: boolean;
  channel_slug: string;
  channel_id: string;
  agents: string[];
};

type MessageAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAgent: boolean;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  author: MessageAuthor;
};

const AVATAR_COLORS = ["#FF0055", "#00FFDD", "#FFD700", "#7700FF", "#00FF00", "#FF5500", "#E040FB", "#00BCD4"];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isToday) return timeStr;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;

  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}

export default function GroupDetailPage() {
  const { groupId: id } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { isDark, colors, glassSurface, glassCard, glassInput } = useGlassStyles();
  const { user: authUser } = useAuthContext();
  const userId = getOrCreateUserId(authUser?.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Fetch group metadata
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const resp = await fetch(`${SB_API_BASE}/groups?id=${id}&user_id=${encodeURIComponent(userId)}`);
        if (resp.ok) {
          const data = await resp.json();
          // API may return array or single object
          const g = Array.isArray(data) ? data[0] : data;
          if (g) setGroup(g);
        }
      } catch (err) {
        console.error("Failed to load group:", err);
      }
    })();
  }, [id, userId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const resp = await fetch(`${SB_API_BASE}/groups/${id}/messages`);
      if (resp.ok) {
        const json = await resp.json();
        const data: Message[] = Array.isArray(json) ? json : (json.messages ?? []);
        setMessages(data);
        if (data.length > 0) {
          const lastId = data[data.length - 1].id;
          if (lastId !== lastMessageIdRef.current) {
            lastMessageIdRef.current = lastId;
            // Scroll on new messages
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll on first load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [loading]);

  // Send message
  const sendMessage = useCallback(async () => {
    const content = newMessage.trim();
    if (!content || !id || sending) return;

    setSending(true);
    setNewMessage("");

    try {
      const resp = await fetch(`${SB_API_BASE}/groups/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, user_id: userId }),
      });
      if (resp.ok) {
        await fetchMessages();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setNewMessage(content); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [newMessage, id, sending, userId, fetchMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const accentText = isDark ? "#FFD600" : "#000";

  if (!group || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#999" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GlassBackground />

      {/* Header */}
      <header
        style={{
          ...glassSurface,
          borderRadius: 0,
          borderBottom: `1px solid ${colors.border}`,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          position: "relative",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate("/groups")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            border: `1px solid ${colors.border}`,
            background: colors.cardBg,
            color: colors.text,
            cursor: "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surfaceHover;
            e.currentTarget.style.borderColor = colors.borderHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.cardBg;
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {group ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Hash size={18} color={colors.accent} />
              <h1
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: colors.text,
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {group.name}
              </h1>
              {group.tags.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  {group.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: isDark ? "rgba(255, 214, 0, 0.12)" : "rgba(255, 214, 0, 0.18)",
                        color: accentText,
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: "8px",
                        border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.25)" : "rgba(255, 214, 0, 0.35)"}`,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {group.description && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: colors.textSecondary,
                  margin: "2px 0 0 28px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {group.description}
              </p>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, color: colors.textMuted, fontSize: "0.9rem" }}>Loading...</div>
        )}

        {/* Agent roster toggle */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "12px",
            border: `1px solid ${sidebarOpen ? colors.borderActive : colors.border}`,
            background: sidebarOpen ? colors.surfaceActive : colors.cardBg,
            color: sidebarOpen ? colors.text : colors.textSecondary,
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = sidebarOpen ? colors.surfaceActive : colors.cardBg;
          }}
        >
          <Users size={16} />
          {group?.agents?.length ?? 0}
        </button>
      </header>

      {/* Body: Chat + Sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Messages */}
          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {loading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  color: colors.textMuted,
                  fontSize: "0.9rem",
                }}
              >
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  gap: "12px",
                  color: colors.textMuted,
                }}
              >
                <Hash size={48} strokeWidth={1} />
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: colors.textSecondary, margin: 0 }}>
                  No messages yet
                </p>
                <p style={{ fontSize: "0.85rem", margin: 0 }}>
                  Be the first to say something in #{group?.name ?? "this channel"}.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const isGrouped =
                  prevMsg &&
                  prevMsg.author.id === msg.author.id &&
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: isGrouped ? "2px 12px 2px 60px" : "10px 12px",
                      borderRadius: "8px",
                      transition: "background 0.15s ease",
                      marginTop: isGrouped ? 0 : i > 0 ? "4px" : 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Avatar */}
                    {!isGrouped && (
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: msg.author.avatarUrl
                            ? `url(${msg.author.avatarUrl}) center/cover no-repeat`
                            : getAvatarColor(msg.author.displayName),
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#fff",
                          position: "relative",
                        }}
                      >
                        {!msg.author.avatarUrl && msg.author.displayName.charAt(0).toUpperCase()}
                        {msg.author.isAgent && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "-2px",
                              right: "-2px",
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              background: isDark ? "#1a1a1e" : "#f7f8fc",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `1.5px solid ${colors.border}`,
                            }}
                          >
                            <Bot size={9} color={colors.accent} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!isGrouped && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "2px" }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.9rem",
                              color: msg.author.isAgent ? colors.accent : colors.text,
                            }}
                          >
                            {msg.author.displayName}
                          </span>
                          {msg.author.isAgent && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: isDark ? "rgba(255, 214, 0, 0.12)" : "rgba(255, 214, 0, 0.18)",
                                color: accentText,
                                border: `1px solid ${isDark ? "rgba(255, 214, 0, 0.25)" : "rgba(255, 214, 0, 0.35)"}`,
                              }}
                            >
                              bot
                            </span>
                          )}
                          <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.9rem",
                          lineHeight: 1.5,
                          color: colors.text,
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input */}
          <div
            style={{
              padding: "12px 24px 20px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                ...glassSurface,
                borderRadius: "16px",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "border-color 0.2s ease",
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder={`Message #${group?.name ?? "channel"}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: "0.9rem",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: colors.text,
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  border: "none",
                  background: newMessage.trim() ? colors.accent : "transparent",
                  color: newMessage.trim() ? "#000" : colors.textMuted,
                  cursor: newMessage.trim() ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                  opacity: sending ? 0.5 : 1,
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Agent Roster Sidebar */}
        {sidebarOpen && group && (
          <aside
            style={{
              width: "260px",
              flexShrink: 0,
              borderLeft: `1px solid ${colors.border}`,
              background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              overflowY: "auto",
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <h3
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: colors.textMuted,
                margin: "0 0 12px 4px",
              }}
            >
              Agents &mdash; {group.agents.length}
            </h3>

            {group.agents.map((agentName) => {
              const color = getAvatarColor(agentName);
              // Simulate online status with a deterministic hash
              const isOnline = agentName.charCodeAt(0) % 3 !== 0;

              return (
                <div
                  key={agentName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    transition: "background 0.15s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: color,
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#fff",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {agentName.charAt(0).toUpperCase()}
                    {/* Online indicator */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-1px",
                        right: "-1px",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: isOnline ? "#22c55e" : colors.textMuted,
                        border: `2px solid ${isDark ? "#1a1a1e" : "#f7f8fc"}`,
                      }}
                    />
                  </div>

                  {/* Name + bot badge */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          color: colors.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agentName}
                      </span>
                      <Bot size={12} color={colors.textMuted} />
                    </div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: isOnline ? "#22c55e" : colors.textMuted,
                      }}
                    >
                      {isOnline ? "Online" : "Idle"}
                    </span>
                  </div>
                </div>
              );
            })}
          </aside>
        )}
      </div>
    </div>
  );
}
