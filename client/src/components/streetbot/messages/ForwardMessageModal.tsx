"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Forward, MessageSquare, Users, Check } from "lucide-react";

type Conversation = {
  id: number;
  name: string;
  type: "dm" | "group_dm" | "channel";
  avatar?: string;
  participantNames?: string[];
  lastMessageAt?: string;
};

type MessageToForward = {
  id: number;
  content: string;
  senderName: string;
  createdAt: string;
  attachments?: any[];
};

interface ForwardMessageModalProps {
  message: MessageToForward;
  conversations: Conversation[];
  onClose: () => void;
  onForward: (messageId: number, targetConversationIds: number[]) => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
  };
}

export function ForwardMessageModal({
  message,
  conversations,
  onClose,
  onForward,
  colors,
}: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.name.toLowerCase().includes(query) ||
      conv.participantNames?.some((name) => name.toLowerCase().includes(query))
    );
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const toggleConversation = (convId: number) => {
    setSelectedConversations((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0) return;
    setIsForwarding(true);
    await onForward(message.id, selectedConversations);
    setIsForwarding(false);
    onClose();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getConversationIcon = (type: string) => {
    if (type === "group_dm" || type === "channel") {
      return <Users size={16} color={colors.textSecondary} />;
    }
    return <MessageSquare size={16} color={colors.textSecondary} />;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "480px",
          maxHeight: "600px",
          background: colors.surface,
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: `1px solid ${colors.border}`,
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
            <Forward size={20} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
              Forward Message
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

        {/* Message preview */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surfaceHover,
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: colors.textMuted,
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Forwarding message from {message.senderName}
          </div>
          <div
            style={{
              color: colors.text,
              fontSize: "0.875rem",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {message.content}
          </div>
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ fontSize: "0.75rem", color: colors.accent, marginTop: "4px" }}>
              + {message.attachments.length} attachment(s)
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: colors.surfaceHover,
              borderRadius: "8px",
              padding: "10px 12px",
            }}
          >
            <Search size={16} color={colors.textMuted} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: colors.text,
                fontSize: "0.875rem",
              }}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
          {filteredConversations.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: colors.textSecondary,
                padding: "24px",
                fontSize: "0.875rem",
              }}
            >
              {searchQuery ? "No conversations found" : "No conversations available"}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversations.includes(conv.id);
              return (
                <button
                  key={conv.id}
                  onClick={() => toggleConversation(conv.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: isSelected ? `${colors.accent}20` : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = colors.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: conv.avatar || colors.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getConversationIcon(conv.type)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        color: colors.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: colors.textMuted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.type === "dm"
                        ? "Direct message"
                        : conv.type === "group_dm"
                        ? `Group - ${conv.participantNames?.length || 0} members`
                        : "Channel"}
                    </div>
                  </div>

                  {/* Last activity */}
                  <div style={{ fontSize: "0.75rem", color: colors.textMuted, flexShrink: 0 }}>
                    {formatDate(conv.lastMessageAt)}
                  </div>

                  {/* Checkbox */}
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      border: `2px solid ${isSelected ? colors.accent : colors.border}`,
                      background: isSelected ? colors.accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: colors.textMuted }}>
            {selectedConversations.length === 0
              ? "Select where to forward"
              : `${selectedConversations.length} conversation(s) selected`}
          </div>
          <button
            onClick={handleForward}
            disabled={selectedConversations.length === 0 || isForwarding}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background:
                selectedConversations.length > 0 && !isForwarding ? colors.accent : colors.surfaceHover,
              color: selectedConversations.length > 0 && !isForwarding ? "#000" : colors.textMuted,
              cursor: selectedConversations.length > 0 && !isForwarding ? "pointer" : "not-allowed",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Forward size={16} />
            {isForwarding ? "Forwarding..." : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForwardMessageModal;
