"use client";

import React, { useState } from "react";
import { Search, CheckCheck } from "lucide-react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import { UserInfo } from "../constants";

interface AssigneePopoverProps {
  taskId: string;
  position: PopoverPosition;
  currentAssignees: string[];
  users: Record<string, UserInfo>;
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onToggleAssignee: (taskId: string, userId: string) => void;
}

/**
 * Popover for managing task assignees
 */
export function AssigneePopover({
  taskId,
  position,
  currentAssignees,
  users,
  colors,
  isDark,
  onClose,
  onToggleAssignee,
}: AssigneePopoverProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = Object.entries(users).filter(([, user]) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="220px"
    >
      {/* Search */}
      <div style={{ padding: "8px", borderBottom: `1px solid ${colors.border}` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            background: colors.surface,
            borderRadius: "6px",
            border: `1px solid ${colors.border}`,
          }}
        >
          <Search size={14} color={colors.textMuted} />
          <input
            type="text"
            placeholder="Search or enter email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: colors.text,
              fontSize: "0.85rem",
            }}
          />
        </div>
      </div>

      {/* People section */}
      <div style={{ padding: "8px 0" }}>
        <div
          style={{
            padding: "4px 12px",
            fontSize: "0.7rem",
            fontWeight: 600,
            color: colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          People
        </div>
        {filteredUsers.map(([id, user]) => {
          const isAssigned = currentAssignees.includes(id);
          return (
            <AssigneeOption
              key={id}
              user={user}
              isAssigned={isAssigned}
              colors={colors}
              onClick={() => onToggleAssignee(taskId, id)}
            />
          );
        })}
        {filteredUsers.length === 0 && (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: colors.textMuted,
              fontSize: "0.85rem",
            }}
          >
            No users found
          </div>
        )}
      </div>
    </PopoverWrapper>
  );
}

function AssigneeOption({
  user,
  isAssigned,
  colors,
  onClick,
}: {
  user: UserInfo;
  isAssigned: boolean;
  colors: PopoverColors;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        background: isAssigned
          ? colors.sidebarActive
          : isHovered
          ? colors.sidebarHover
          : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
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
          fontSize: "0.65rem",
          fontWeight: 700,
        }}
      >
        {user.initials}
      </div>
      <span style={{ fontSize: "0.85rem", color: colors.text }}>{user.name}</span>
      {isAssigned && (
        <CheckCheck size={14} color={colors.accent} style={{ marginLeft: "auto" }} />
      )}
    </button>
  );
}
