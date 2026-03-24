"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Smile, Paperclip } from "lucide-react";
import { sbFetch } from "../shared/sbFetch";

const API_BASE = "/api/messaging";

type ThreadReply = {
  id: number;
  parent_message_id: number;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  reactions: { emoji: string; count: number; hasReacted: boolean }[];
};

type ParentMessage = {
  id: number | string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
};

interface ThreadPanelProps {
  parentMessage: ParentMessage;
  conversationId: number | string;
  userId: string;
  onClose: () => void;
  colors: Record<string, string>;
  isDark: boolean;
}

export default function ThreadPanel({
  parentMessage,
  conversationId,
  userId,
  onClose,
  colors,
  isDark,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load thread replies
  useEffect(() => {
    loadReplies();
  }, [parentMessage.id]);

  const loadReplies = async () => {
    try {
      setLoading(true);
      // Try Mattermost thread endpoint first (string IDs from Mattermost)
      const mmResp = await sbFetch(
        `${API_BASE}/conversations/${conversationId}/thread/${parentMessage.id}?user_id=${encodeURIComponent(userId)}`
      );
      if (mmResp.ok) {
        const data = await mmResp.json();
        // Mattermost returns { messages: [...] } — skip the first (parent) post
        const threadMessages = (data.messages || []).slice(1);
        setReplies(threadMessages.map((m: any) => ({
          id: m.id,
          parent_message_id: parentMessage.id,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          sender_avatar: m.sender_avatar,
          content: m.content,
          created_at: m.created_at,
          reactions: m.reactions || [],
        })));
        return;
      }
      // Fallback to in-memory thread endpoint
      const resp = await sbFetch(`${API_BASE}/threads/${parentMessage.id}`);
      if (resp.ok) {
        const data = await resp.json();
        setReplies(data.replies || []);
      }
    } catch (error) {
      console.error("Failed to load thread replies:", error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom when replies change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const sendReply = async () => {
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      // Use the unified /send endpoint with root_id for thread replies
      const resp = await sbFetch(`${API_BASE}/send?user_id=${encodeURIComponent(userId)}`, {
        method: "POST",
        body: JSON.stringify({
          conversation_id: String(conversationId),
          content: replyText.trim(),
          root_id: String(parentMessage.id),
        }),
      });

      if (resp.ok) {
        const sentMsg = await resp.json();
        const newReply: ThreadReply = {
          id: sentMsg.id || Date.now(),
          parent_message_id: typeof parentMessage.id === 'number' ? parentMessage.id : parseInt(String(parentMessage.id)) || 0,
          sender_id: userId,
          sender_name: "You",
          content: replyText.trim(),
          created_at: sentMsg.created_at || new Date().toISOString(),
          reactions: [],
        };
        setReplies((prev) => [...prev, newReply]);
        setReplyText("");
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <aside
      style={{
        width: "350px",
        background: colors.sidebar,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderLeft: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, color: colors.text, fontSize: "1rem", fontWeight: 600 }}>
          Thread
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: colors.textSecondary,
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Parent Message */}
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.messageBg,
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: parentMessage.senderAvatar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              flexShrink: 0,
            }}
          >
            {parentMessage.senderName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontWeight: 700, color: colors.text, fontSize: "0.9rem" }}>
                {parentMessage.senderName}
              </span>
              <span style={{ fontSize: "0.7rem", color: colors.textMuted }}>
                {formatTime(parentMessage.createdAt)}
              </span>
            </div>
            <p style={{ margin: 0, color: colors.text, fontSize: "0.9rem", lineHeight: 1.5 }}>
              {parentMessage.content}
            </p>
          </div>
        </div>
        <div
          style={{
            marginTop: "12px",
            paddingTop: "8px",
            borderTop: `1px solid ${colors.border}`,
            fontSize: "0.75rem",
            color: colors.textSecondary,
          }}
        >
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </div>
      </div>

      {/* Thread Replies */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: colors.textSecondary, padding: "20px" }}>
            Loading replies...
          </div>
        ) : replies.length === 0 ? (
          <div style={{ textAlign: "center", color: colors.textSecondary, padding: "20px" }}>
            No replies yet. Start the conversation!
          </div>
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "16px",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: reply.sender_avatar || "#666",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  flexShrink: 0,
                }}
              >
                {reply.sender_name?.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "2px" }}>
                  <span style={{ fontWeight: 600, color: colors.text, fontSize: "0.85rem" }}>
                    {reply.sender_name}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: colors.textMuted }}>
                    {formatTime(reply.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, color: colors.text, fontSize: "0.85rem", lineHeight: 1.4 }}>
                  {reply.content}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Composer */}
      <div
        style={{
          padding: "12px",
          borderTop: `1px solid ${colors.border}`,
          background: colors.surface,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: colors.surfaceHover,
            borderRadius: "12px",
            border: `1px solid ${colors.border}`,
            padding: "8px 12px",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendReply();
              }
            }}
            disabled={sending}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.9rem",
            }}
          />
          {replyText.trim() && (
            <button
              onClick={sendReply}
              disabled={sending}
              style={{
                background: colors.accent,
                border: "none",
                borderRadius: "8px",
                color: "#000",
                cursor: sending ? "wait" : "pointer",
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                fontSize: "0.8rem",
                opacity: sending ? 0.7 : 1,
              }}
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
