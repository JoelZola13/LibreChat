"use client";

import React, { useEffect, useRef } from "react";
import {
  Reply,
  Edit3,
  Trash2,
  Pin,
  Bookmark,
  Copy,
  Forward,
  Flag,
  MoreHorizontal,
} from "lucide-react";

export type MessageAction =
  | "reply"
  | "edit"
  | "delete"
  | "pin"
  | "unpin"
  | "save"
  | "unsave"
  | "copy"
  | "forward"
  | "report";

interface MessageContextMenuProps {
  x: number;
  y: number;
  messageId: number;
  isOwnMessage: boolean;
  isPinned: boolean;
  isSaved: boolean;
  onAction: (action: MessageAction, messageId: number) => void;
  onClose: () => void;
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    accent: string;
    danger: string;
  };
}

export function MessageContextMenu({
  x,
  y,
  messageId,
  isOwnMessage,
  isPinned,
  isSaved,
  onAction,
  onClose,
  colors,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const handleAction = (action: MessageAction) => {
    onAction(action, messageId);
    onClose();
  };

  const menuItems: {
    action: MessageAction;
    icon: React.ElementType;
    label: string;
    show: boolean;
    danger?: boolean;
  }[] = [
    { action: "reply", icon: Reply, label: "Reply in thread", show: true },
    { action: "edit", icon: Edit3, label: "Edit message", show: isOwnMessage },
    { action: "copy", icon: Copy, label: "Copy text", show: true },
    { action: "forward", icon: Forward, label: "Forward message", show: true },
    { action: isPinned ? "unpin" : "pin", icon: Pin, label: isPinned ? "Unpin" : "Pin to conversation", show: true },
    { action: isSaved ? "unsave" : "save", icon: Bookmark, label: isSaved ? "Remove from saved" : "Save for later", show: true },
    { action: "report", icon: Flag, label: "Report message", show: !isOwnMessage },
    { action: "delete", icon: Trash2, label: "Delete message", show: isOwnMessage, danger: true },
  ];

  const visibleItems = menuItems.filter((item) => item.show);

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        minWidth: "200px",
        background: colors.surface,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        padding: "6px",
        zIndex: 1000,
      }}
    >
      {visibleItems.map((item, index) => {
        const Icon = item.icon;
        const isDanger = item.danger;

        // Add separator before delete
        const showSeparator = item.action === "delete" && index > 0;

        return (
          <React.Fragment key={item.action}>
            {showSeparator && (
              <div
                style={{
                  height: "1px",
                  background: colors.border,
                  margin: "6px 8px",
                }}
              />
            )}
            <button
              onClick={() => handleAction(item.action)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: isDanger ? colors.danger : colors.text,
                cursor: "pointer",
                fontSize: "0.875rem",
                textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDanger
                  ? `${colors.danger}20`
                  : colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default MessageContextMenu;
