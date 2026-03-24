"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Pin, MessageSquare, ExternalLink } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type PinnedMessage = {
  id: number | string;
  message_id: number | string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  pinned_by: string;
  pinned_at: string;
};

interface PinnedMessagesPanelProps {
  conversationId: number | string;
  userId: string;
  onClose: () => void;
  onNavigateToMessage: (messageId: number | string) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    danger: string;
  };
  apiUrl?: string;
}

export function PinnedMessagesPanel({
  conversationId,
  userId,
  onClose,
  onNavigateToMessage,
  colors,
  apiUrl = "/api/messaging",
}: PinnedMessagesPanelProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPinnedMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sbFetch(
        `${apiUrl}/pins/${conversationId}/content?user_id=${encodeURIComponent(userId)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPinnedMessages(data.pinned_messages || []);
      }
    } catch (error) {
      console.error("Failed to load pinned messages:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId, apiUrl]);

  useEffect(() => {
    loadPinnedMessages();
  }, [loadPinnedMessages]);

  const handleUnpin = async (messageId: number | string) => {
    try {
      await sbFetch(
        `${apiUrl}/pins?message_id=${messageId}&conversation_id=${conversationId}&user_id=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      setPinnedMessages((prev) => prev.filter((m) => m.message_id !== messageId));
    } catch (error) {
      console.error("Failed to unpin message:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div
      style={{
        width: "350px",
        height: "100%",
        background: colors.surface,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Pin size={18} color={colors.accent} />
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
            Pinned Messages
          </h3>
          {pinnedMessages.length > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                color: colors.textMuted,
                background: colors.surfaceHover,
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              {pinnedMessages.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textSecondary,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100px",
              color: colors.textSecondary,
            }}
          >
            Loading...
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              textAlign: "center",
              padding: "24px",
            }}
          >
            <Pin size={48} color={colors.textMuted} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <div style={{ color: colors.text, fontWeight: 500, marginBottom: "8px" }}>
              No pinned messages
            </div>
            <div style={{ color: colors.textSecondary, fontSize: "0.875rem" }}>
              Pin important messages to find them later. Click the pin icon on any message to pin it.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pinnedMessages.map((message) => (
              <div
                key={message.message_id}
                style={{
                  background: colors.surfaceHover,
                  borderRadius: "12px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: `1px solid transparent`,
                }}
                onClick={() => onNavigateToMessage(message.message_id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        background: message.sender_avatar || colors.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#000",
                      }}
                    >
                      {message.sender_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <span style={{ fontWeight: 500, color: colors.text, fontSize: "0.875rem" }}>
                      {message.sender_name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToMessage(message.message_id);
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textMuted,
                      }}
                      title="Jump to message"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpin(message.message_id);
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.textMuted,
                        transition: "all 0.15s",
                      }}
                      title="Unpin"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.danger;
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = colors.textMuted;
                      }}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div
                  style={{
                    color: colors.text,
                    fontSize: "0.875rem",
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {message.content}
                </div>

                {/* Pinned by */}
                <div
                  style={{
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.7rem",
                    color: colors.textMuted,
                  }}
                >
                  <Pin size={10} />
                  Pinned {formatDate(message.pinned_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PinnedMessagesPanel;
