"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import type { Comment } from "@/lib/api/tasks";

interface UserInfo {
  name: string;
  avatar: string;
  initials: string;
}

interface CommentsPopoverProps {
  taskId: string;
  position: PopoverPosition;
  comments: Comment[];
  users: Record<string, UserInfo>;
  colors: PopoverColors;
  isDark: boolean;
  loading: boolean;
  currentUserId: string;
  onClose: () => void;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  onLoadComments: (taskId: string) => Promise<void>;
}

/**
 * Popover for viewing and adding task comments
 */
export function CommentsPopover({
  taskId,
  position,
  comments,
  users,
  colors,
  isDark,
  loading,
  currentUserId,
  onClose,
  onAddComment,
  onLoadComments,
}: CommentsPopoverProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load comments on mount
  useEffect(() => {
    onLoadComments(taskId);
  }, [taskId, onLoadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(taskId, newComment.trim());
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="320px"
      maxHeight="400px"
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <MessageCircle size={16} color={colors.textMuted} />
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Comments
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            color: colors.textMuted,
            marginLeft: "auto",
          }}
        >
          {comments.length}
        </span>
      </div>

      {/* Comments list */}
      <div
        style={{
          maxHeight: "240px",
          overflowY: "auto",
          padding: "8px 0",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
            }}
          >
            <Loader2 size={20} color={colors.textMuted} className="animate-spin" />
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              user={users[comment.userId] || { name: "Unknown", avatar: "#6b7280", initials: "?" }}
              colors={colors}
              isCurrentUser={comment.userId === currentUserId}
            />
          ))
        ) : (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: colors.textMuted,
              fontSize: "0.85rem",
            }}
          >
            No comments yet
          </div>
        )}
      </div>

      {/* Add comment */}
      <div
        style={{
          padding: "12px",
          borderTop: `1px solid ${colors.border}`,
          display: "flex",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: users[currentUserId]?.avatar || colors.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "0.6rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {users[currentUserId]?.initials || "?"}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            background: colors.surface,
            borderRadius: "8px",
            border: `1px solid ${colors.border}`,
            padding: "8px 12px",
          }}
        >
          <textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.85rem",
              resize: "none",
              minHeight: "20px",
              maxHeight: "80px",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            style={{
              background: newComment.trim() ? colors.accent : "transparent",
              border: "none",
              borderRadius: "4px",
              padding: "4px",
              cursor: newComment.trim() && !isSubmitting ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: newComment.trim() ? 1 : 0.5,
            }}
          >
            {isSubmitting ? (
              <Loader2 size={14} color={colors.textMuted} className="animate-spin" />
            ) : (
              <Send size={14} color={newComment.trim() ? "#000" : colors.textMuted} />
            )}
          </button>
        </div>
      </div>
    </PopoverWrapper>
  );
}

function CommentItem({
  comment,
  user,
  colors,
  isCurrentUser,
}: {
  comment: Comment;
  user: UserInfo;
  colors: PopoverColors;
  isCurrentUser: boolean;
}) {
  const formattedDate = new Date(comment.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        padding: "8px 16px",
        display: "flex",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: user.avatar,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "0.6rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {user.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: colors.text,
            }}
          >
            {user.name}
            {isCurrentUser && (
              <span style={{ fontWeight: 400, color: colors.textMuted }}> (you)</span>
            )}
          </span>
          <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>{formattedDate}</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            color: colors.textSecondary,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {comment.body}
        </p>
      </div>
    </div>
  );
}
