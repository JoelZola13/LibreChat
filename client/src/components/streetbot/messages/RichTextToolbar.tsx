"use client";

import React, { useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link2,
  List,
  ListOrdered,
  Quote,
  AtSign,
  Smile,
  Paperclip,
  Image,
  Mic,
  Video,
} from "lucide-react";

interface RichTextToolbarProps {
  onFormat: (format: string, value?: string) => void;
  onInsertEmoji: () => void;
  onInsertMention: () => void;
  onAttachFile: () => void;
  onAttachImage: () => void;
  onRecordVoice?: () => void;
  onRecordVideo?: () => void;
  isRecordingVoice?: boolean;
  isRecordingVideo?: boolean;
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
  compact?: boolean;
}

type ToolbarButton = {
  id: string;
  icon: React.ElementType;
  label: string;
  format?: string;
  action?: () => void;
  active?: boolean;
  danger?: boolean;
  group?: string;
};

export function RichTextToolbar({
  onFormat,
  onInsertEmoji,
  onInsertMention,
  onAttachFile,
  onAttachImage,
  onRecordVoice,
  onRecordVideo,
  isRecordingVoice,
  isRecordingVideo,
  colors,
  compact = false,
}: RichTextToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const handleLinkInsert = () => {
    if (linkUrl.trim()) {
      onFormat("link", linkUrl.trim());
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  const formatButtons: ToolbarButton[] = [
    { id: "bold", icon: Bold, label: "Bold (Ctrl+B)", format: "bold", group: "format" },
    { id: "italic", icon: Italic, label: "Italic (Ctrl+I)", format: "italic", group: "format" },
    { id: "strike", icon: Strikethrough, label: "Strikethrough", format: "strike", group: "format" },
    { id: "code", icon: Code, label: "Code", format: "code", group: "format" },
  ];

  const structureButtons: ToolbarButton[] = [
    { id: "link", icon: Link2, label: "Insert link", action: () => setShowLinkInput(!showLinkInput), group: "structure" },
    { id: "quote", icon: Quote, label: "Quote", format: "quote", group: "structure" },
    { id: "list", icon: List, label: "Bullet list", format: "bullet", group: "structure" },
    { id: "ordered", icon: ListOrdered, label: "Numbered list", format: "numbered", group: "structure" },
  ];

  const insertButtons: ToolbarButton[] = [
    { id: "mention", icon: AtSign, label: "Mention someone", action: onInsertMention, group: "insert" },
    { id: "emoji", icon: Smile, label: "Add emoji", action: onInsertEmoji, group: "insert" },
  ];

  const attachButtons: ToolbarButton[] = [
    { id: "image", icon: Image, label: "Attach image", action: onAttachImage, group: "attach" },
    { id: "file", icon: Paperclip, label: "Attach file", action: onAttachFile, group: "attach" },
  ];

  const mediaButtons: ToolbarButton[] = [];
  if (onRecordVoice) {
    mediaButtons.push({
      id: "voice",
      icon: Mic,
      label: isRecordingVoice ? "Stop recording" : "Record voice message",
      action: onRecordVoice,
      active: isRecordingVoice,
      danger: isRecordingVoice,
      group: "media",
    });
  }
  if (onRecordVideo) {
    mediaButtons.push({
      id: "video",
      icon: Video,
      label: isRecordingVideo ? "Stop recording" : "Record video message",
      action: onRecordVideo,
      active: isRecordingVideo,
      danger: isRecordingVideo,
      group: "media",
    });
  }

  const allButtons = compact
    ? [...insertButtons, ...attachButtons, ...mediaButtons]
    : [...formatButtons, ...structureButtons, ...insertButtons, ...attachButtons, ...mediaButtons];

  const renderButton = (button: ToolbarButton) => {
    const Icon = button.icon;
    const isActive = button.active;
    const isDanger = button.danger;

    return (
      <button
        key={button.id}
        onClick={() => {
          if (button.action) {
            button.action();
          } else if (button.format) {
            onFormat(button.format);
          }
        }}
        title={button.label}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "6px",
          border: "none",
          background: isActive
            ? isDanger
              ? colors.danger
              : colors.accent
            : "transparent",
          color: isActive
            ? isDanger
              ? "#fff"
              : "#000"
            : colors.textSecondary,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = colors.surfaceHover;
            e.currentTarget.style.color = colors.text;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = colors.textSecondary;
          }
        }}
      >
        <Icon size={16} />
      </button>
    );
  };

  const renderSeparator = () => (
    <div
      style={{
        width: "1px",
        height: "20px",
        background: colors.border,
        margin: "0 4px",
      }}
    />
  );

  // Group buttons by their group property
  const groups: { [key: string]: ToolbarButton[] } = {};
  allButtons.forEach((btn) => {
    const group = btn.group || "default";
    if (!groups[group]) groups[group] = [];
    groups[group].push(btn);
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          flexWrap: "wrap",
        }}
      >
        {Object.entries(groups).map(([groupName, buttons], index) => (
          <React.Fragment key={groupName}>
            {index > 0 && renderSeparator()}
            {buttons.map(renderButton)}
          </React.Fragment>
        ))}
      </div>

      {/* Link input popup */}
      {showLinkInput && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
            background: colors.surfaceHover,
            borderRadius: "8px",
          }}
        >
          <Link2 size={16} color={colors.textMuted} />
          <input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLinkInsert();
              }
              if (e.key === "Escape") {
                setShowLinkInput(false);
                setLinkUrl("");
              }
            }}
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.875rem",
            }}
          />
          <button
            onClick={handleLinkInsert}
            disabled={!linkUrl.trim()}
            style={{
              padding: "4px 12px",
              borderRadius: "6px",
              border: "none",
              background: linkUrl.trim() ? colors.accent : colors.border,
              color: linkUrl.trim() ? "#000" : colors.textMuted,
              cursor: linkUrl.trim() ? "pointer" : "not-allowed",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Insert
          </button>
          <button
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default RichTextToolbar;
