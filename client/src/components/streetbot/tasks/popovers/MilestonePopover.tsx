"use client";

import React, { useState } from "react";
import { Target, Check, Settings } from "lucide-react";
import { PopoverWrapper, PopoverHeader, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import type { Milestone } from "@/lib/api/tasks-advanced";

interface MilestonePopoverProps {
  taskId: string;
  position: PopoverPosition;
  currentMilestoneId: string | null;
  milestones: Milestone[];
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onSelectMilestone: (taskId: string, milestoneId: string | null) => void;
  onManageMilestones?: () => void;
}

/**
 * Popover for assigning tasks to milestones
 */
export function MilestonePopover({
  taskId,
  position,
  currentMilestoneId,
  milestones,
  colors,
  isDark,
  onClose,
  onSelectMilestone,
  onManageMilestones,
}: MilestonePopoverProps) {
  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="220px"
      maxHeight="300px"
    >
      <PopoverHeader title="Milestone" colors={colors} />

      {/* Milestones list */}
      <div style={{ maxHeight: "200px", overflowY: "auto", padding: "4px 0" }}>
        {/* None option */}
        <MilestoneOption
          milestone={{ id: "", name: "No milestone", color: colors.textMuted }}
          isSelected={!currentMilestoneId}
          colors={colors}
          onClick={() => {
            onSelectMilestone(taskId, null);
            onClose();
          }}
        />

        {milestones.length > 0 ? (
          milestones.map((milestone) => (
            <MilestoneOption
              key={milestone.id}
              milestone={milestone}
              isSelected={currentMilestoneId === milestone.id}
              colors={colors}
              onClick={() => {
                onSelectMilestone(taskId, milestone.id);
                onClose();
              }}
            />
          ))
        ) : (
          <div
            style={{
              padding: "12px 16px",
              textAlign: "center",
              color: colors.textMuted,
              fontSize: "0.85rem",
            }}
          >
            No milestones yet
          </div>
        )}
      </div>

      {/* Manage milestones */}
      {onManageMilestones && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "4px 0" }}>
          <ManageButton colors={colors} onClick={onManageMilestones} />
        </div>
      )}
    </PopoverWrapper>
  );
}

function MilestoneOption({
  milestone,
  isSelected,
  colors,
  onClick,
}: {
  milestone: { id: string; name: string; color: string };
  isSelected: boolean;
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
        background: isSelected
          ? colors.sidebarActive
          : isHovered
          ? colors.sidebarHover
          : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Target size={14} color={milestone.color} />
      <span style={{ fontSize: "0.85rem", color: colors.text, flex: 1 }}>
        {milestone.name}
      </span>
      {isSelected && <Check size={14} color={colors.accent} />}
    </button>
  );
}

function ManageButton({
  colors,
  onClick,
}: {
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
        gap: "8px",
        padding: "8px 12px",
        background: isHovered ? colors.sidebarHover : "transparent",
        border: "none",
        cursor: "pointer",
        color: colors.textMuted,
        fontSize: "0.85rem",
      }}
    >
      <Settings size={14} />
      Manage milestones
    </button>
  );
}
