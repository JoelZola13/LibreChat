"use client";

import React, { useState } from "react";
import {
  X,
  Trash2,
  FolderInput,
  Flag,
  Calendar,
  User,
  Tag,
  CheckCheck,
  Copy,
  Archive,
} from "lucide-react";

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
  onAssigneeChange: (assigneeId: string) => void;
  onArchive: () => void;
  onMove?: (projectId: string) => void;
  onDuplicate?: () => void;
  projects?: { id: string; name: string }[];
  statuses: { id: string; name: string; color: string }[];
  users: Record<string, { name: string; avatar: string; initials: string }>;
}

type DropdownType = "status" | "priority" | "assignee" | "move" | null;

const PRIORITIES = [
  { id: "urgent", label: "Urgent", color: "#ef4444" },
  { id: "high", label: "High", color: "#f97316" },
  { id: "medium", label: "Medium", color: "#eab308" },
  { id: "low", label: "Low", color: "#22c55e" },
  { id: "none", label: "None", color: "#6b7280" },
];

export function BulkActions({
  selectedCount,
  onClearSelection,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onArchive,
  onMove,
  onDuplicate,
  projects = [],
  statuses,
  users,
}: BulkActionsProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);

  // Default colors for the component
  const colors = {
    text: "#e5e5e5",
    textSecondary: "#a3a3a3",
    textMuted: "#737373",
    surface: "rgba(38, 38, 38, 0.8)",
    surfaceHover: "rgba(64, 64, 64, 0.8)",
    border: "rgba(82, 82, 82, 0.5)",
    accent: "#FFD700",
    danger: "#ef4444",
  };

  if (selectedCount === 0) return null;

  const toggleDropdown = (type: DropdownType) => {
    setActiveDropdown(activeDropdown === type ? null : type);
  };

  // Render an action button (uses render function pattern to avoid component creation during render)
  const renderActionButton = (
    Icon: React.ElementType,
    label: string,
    options?: {
      onClick?: () => void;
      danger?: boolean;
      hasDropdown?: boolean;
      dropdownType?: DropdownType;
    }
  ) => {
    const { onClick, danger = false, hasDropdown = false, dropdownType } = options || {};
    return (
      <div key={label} style={{ position: "relative" }}>
        <button
          onClick={hasDropdown ? () => toggleDropdown(dropdownType!) : onClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            color: danger ? colors.danger : colors.text,
            fontSize: "0.85rem",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = danger
              ? "rgba(239, 68, 68, 0.1)"
              : colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon size={14} />
          {label}
        </button>
      </div>
    );
  };

  const renderDropdown = () => {
    if (!activeDropdown) return null;

    const getDropdownContent = () => {
      switch (activeDropdown) {
        case "status":
          return (
            <div style={{ padding: "4px 0" }}>
              {statuses.map((status) => (
                <button
                  key={status.id}
                  onClick={() => {
                    onStatusChange(status.id);
                    setActiveDropdown(null);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.text,
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: status.color,
                    }}
                  />
                  {status.name}
                </button>
              ))}
            </div>
          );

        case "priority":
          return (
            <div style={{ padding: "4px 0" }}>
              {PRIORITIES.map((priority) => (
                <button
                  key={priority.id}
                  onClick={() => {
                    onPriorityChange(priority.id);
                    setActiveDropdown(null);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.text,
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Flag size={12} fill={priority.color} color={priority.color} />
                  {priority.label}
                </button>
              ))}
            </div>
          );

        case "assignee":
          return (
            <div style={{ padding: "4px 0" }}>
              {Object.entries(users).map(([id, user]) => (
                <button
                  key={id}
                  onClick={() => {
                    onAssigneeChange(id);
                    setActiveDropdown(null);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.text,
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: user.avatar,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                    }}
                  >
                    {user.initials}
                  </div>
                  {user.name}
                </button>
              ))}
            </div>
          );

        case "move":
          return (
            <div style={{ padding: "4px 0" }}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onMove?.(project.id);
                    setActiveDropdown(null);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: colors.text,
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <FolderInput size={14} />
                  {project.name}
                </button>
              ))}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <>
        {/* Backdrop */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
          }}
          onClick={() => setActiveDropdown(null)}
        />
        {/* Dropdown */}
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            minWidth: "180px",
            background: colors.surface,
            backdropFilter: "blur(24px)",
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          {getDropdownContent()}
        </div>
      </>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        background: colors.surface,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        zIndex: 100,
      }}
    >
      {/* Selection Count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: colors.surfaceHover,
          borderRadius: "8px",
        }}
      >
        <CheckCheck size={14} color={colors.accent} />
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text }}>
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textMuted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
        >
          <X size={12} />
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "24px", background: colors.border }} />

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {renderActionButton(CheckCheck, "Status", { hasDropdown: true, dropdownType: "status" })}
        {renderActionButton(Flag, "Priority", { hasDropdown: true, dropdownType: "priority" })}
        {renderActionButton(User, "Assign", { hasDropdown: true, dropdownType: "assignee" })}
        {renderActionButton(FolderInput, "Move", { hasDropdown: true, dropdownType: "move" })}
        {onDuplicate && renderActionButton(Copy, "Duplicate", { onClick: onDuplicate })}
        {renderActionButton(Archive, "Archive", { onClick: onArchive })}

        {/* Render active dropdown */}
        {activeDropdown && renderDropdown()}
      </div>

      {/* Divider */}
      <div style={{ width: "1px", height: "24px", background: colors.border }} />

      {/* Delete */}
      {renderActionButton(Trash2, "Delete", { onClick: onDelete, danger: true })}
    </div>
  );
}
