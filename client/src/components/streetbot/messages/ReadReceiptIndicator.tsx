"use client";

import React from "react";
import { Check, CheckCheck, Clock } from "lucide-react";

type MessageStatus = "sending" | "sent" | "delivered" | "read";

interface ReadReceiptIndicatorProps {
  status: MessageStatus;
  readBy?: { id: string; name: string; readAt: string }[];
  showTooltip?: boolean;
  colors: {
    textMuted: string;
    accent: string;
    success: string;
  };
  size?: number;
}

export function ReadReceiptIndicator({
  status,
  readBy = [],
  showTooltip = true,
  colors,
  size = 14,
}: ReadReceiptIndicatorProps) {
  const getIcon = () => {
    switch (status) {
      case "sending":
        return <Clock size={size} color={colors.textMuted} />;
      case "sent":
        return <Check size={size} color={colors.textMuted} />;
      case "delivered":
        return <CheckCheck size={size} color={colors.textMuted} />;
      case "read":
        return <CheckCheck size={size} color={colors.accent} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (status) {
      case "sending":
        return "Sending...";
      case "sent":
        return "Sent";
      case "delivered":
        return "Delivered";
      case "read":
        if (readBy.length === 0) return "Read";
        if (readBy.length === 1) return `Read by ${readBy[0].name}`;
        return `Read by ${readBy.length} people`;
      default:
        return "";
    }
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        position: "relative",
      }}
      title={showTooltip ? getLabel() : undefined}
    >
      {getIcon()}
    </div>
  );
}

// Detailed read receipts list for tooltips/modals
interface ReadReceiptsListProps {
  readBy: { id: string; name: string; avatar?: string; readAt: string }[];
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

export function ReadReceiptsList({ readBy, colors }: ReadReceiptsListProps) {
  if (readBy.length === 0) {
    return (
      <div style={{ padding: "12px", color: colors.textMuted, fontSize: "0.875rem" }}>
        No one has read this message yet
      </div>
    );
  }

  const formatReadTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${colors.border}`,
          fontSize: "0.75rem",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Read by {readBy.length}
      </div>
      {readBy.map((reader) => (
        <div
          key={reader.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: reader.avatar || colors.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#000",
              flexShrink: 0,
            }}
          >
            {reader.name.charAt(0).toUpperCase()}
          </div>

          {/* Name and time */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                color: colors.text,
                fontSize: "0.875rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {reader.name}
            </div>
          </div>

          {/* Read time */}
          <div style={{ fontSize: "0.75rem", color: colors.textMuted, flexShrink: 0 }}>
            {formatReadTime(reader.readAt)}
          </div>

          {/* Read icon */}
          <CheckCheck size={14} color={colors.accent} style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export default ReadReceiptIndicator;
