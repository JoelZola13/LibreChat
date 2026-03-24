"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

type ReactionDetail = {
  emoji: string;
  count: number;
  users: { id: string; name: string; avatar?: string }[];
};

interface ReactionsDetailModalProps {
  messageId: number;
  reactions: ReactionDetail[];
  onClose: () => void;
  onRemoveReaction?: (emoji: string) => void;
  currentUserId: string;
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

export function ReactionsDetailModal({
  messageId,
  reactions,
  onClose,
  onRemoveReaction,
  currentUserId,
  colors,
}: ReactionsDetailModalProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(
    reactions.length > 0 ? reactions[0].emoji : null
  );
  const modalRef = useRef<HTMLDivElement>(null);

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

  const selectedReaction = reactions.find((r) => r.emoji === selectedEmoji);
  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

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
          width: "380px",
          maxHeight: "500px",
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
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: colors.text }}>
            Reactions ({totalCount})
          </h3>
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

        {/* Emoji tabs */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "12px",
            borderBottom: `1px solid ${colors.border}`,
            overflowX: "auto",
          }}
        >
          {/* All tab */}
          <button
            onClick={() => setSelectedEmoji(null)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${selectedEmoji === null ? colors.accent : colors.border}`,
              background: selectedEmoji === null ? `${colors.accent}20` : "transparent",
              color: selectedEmoji === null ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            All {totalCount}
          </button>

          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => setSelectedEmoji(reaction.emoji)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                border: `1px solid ${selectedEmoji === reaction.emoji ? colors.accent : colors.border}`,
                background: selectedEmoji === reaction.emoji ? `${colors.accent}20` : "transparent",
                color: selectedEmoji === reaction.emoji ? colors.accent : colors.textSecondary,
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          {selectedEmoji === null ? (
            // Show all users grouped by emoji
            reactions.map((reaction) => (
              <div key={reaction.emoji} style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    fontSize: "0.75rem",
                    color: colors.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </div>
                {reaction.users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    emoji={reaction.emoji}
                    isCurrentUser={user.id === currentUserId}
                    onRemove={onRemoveReaction}
                    colors={colors}
                  />
                ))}
              </div>
            ))
          ) : (
            // Show users for selected emoji
            selectedReaction?.users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                emoji={selectedEmoji}
                isCurrentUser={user.id === currentUserId}
                onRemove={onRemoveReaction}
                colors={colors}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  emoji,
  isCurrentUser,
  onRemove,
  colors,
}: {
  user: { id: string; name: string; avatar?: string };
  emoji: string;
  isCurrentUser: boolean;
  onRemove?: (emoji: string) => void;
  colors: ReactionsDetailModalProps["colors"];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: "8px",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Avatar */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: user.avatar || colors.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#000",
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 500, color: colors.text }}>
            {user.name}
            {isCurrentUser && (
              <span style={{ marginLeft: "8px", fontSize: "0.75rem", color: colors.textMuted }}>
                (you)
              </span>
            )}
          </div>
        </div>
      </div>

      {isCurrentUser && onRemove && (
        <button
          onClick={() => onRemove(emoji)}
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.textSecondary,
            cursor: "pointer",
            fontSize: "0.75rem",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export default ReactionsDetailModal;
