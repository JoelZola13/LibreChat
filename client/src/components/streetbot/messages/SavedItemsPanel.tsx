"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Bookmark, MessageSquare, Trash2 } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

type SavedItem = {
  id: string;
  message_id: number | string;
  conversation_id: number | string;
  conversation_type: string;
  note?: string;
  saved_at: string;
  message?: {
    sender_id: string;
    sender_name: string;
    content: string;
    created_at: string;
  };
};

type SavedItemsPanelProps = {
  userId: string;
  onClose: () => void;
  onNavigateToMessage: (conversationId: number | string, messageId: number | string) => void;
  colors: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    surfaceHover: string;
    accent: string;
    danger: string;
  };
  apiUrl?: string;
};

export function SavedItemsPanel({
  userId,
  onClose,
  onNavigateToMessage,
  colors,
  apiUrl = "/api/messaging",
}: SavedItemsPanelProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSavedItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sbFetch(`${apiUrl}/saved?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to load saved items:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, apiUrl]);

  useEffect(() => {
    loadSavedItems();
  }, [loadSavedItems]);

  const handleRemove = async (messageId: number | string) => {
    try {
      await sbFetch(`${apiUrl}/saved/${messageId}?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((item) => item.message_id !== messageId));
    } catch (error) {
      console.error("Failed to remove saved item:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      style={{
        width: "350px",
        height: "100%",
        background: colors.surface,
        backdropFilter: "blur(20px)",
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
          <Bookmark size={18} color={colors.accent} />
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
            Saved Items
          </h3>
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
        ) : items.length === 0 ? (
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
            <Bookmark size={48} color={colors.textMuted} style={{ marginBottom: "16px" }} />
            <div style={{ color: colors.text, fontWeight: 500, marginBottom: "8px" }}>
              No saved items yet
            </div>
            <div style={{ color: colors.textSecondary, fontSize: "0.875rem" }}>
              Save messages for later by clicking the bookmark icon in the message menu.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: colors.surfaceHover,
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: `1px solid transparent`,
                }}
                onClick={() => onNavigateToMessage(item.conversation_id, item.message_id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageSquare size={14} color={colors.accent} />
                    <span style={{ fontSize: "0.75rem", color: colors.textSecondary }}>
                      {item.message?.sender_name || "Unknown"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
                      {formatDate(item.saved_at)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.message_id);
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.danger;
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = colors.textMuted;
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    color: colors.text,
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    lineHeight: 1.4,
                  }}
                >
                  {item.message?.content || "Message content unavailable"}
                </div>
                {item.note && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px",
                      background: "rgba(255,214,0,0.1)",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      color: colors.accent,
                    }}
                  >
                    Note: {item.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SavedItemsPanel;
