"use client";

import React, { useState } from "react";
import { Flag } from "lucide-react";
import { PopoverWrapper, PopoverHeader, PopoverColors, PopoverPosition } from "./PopoverWrapper";

// Priority config
export interface PriorityConfig {
  label: string;
  color: string;
  flagColor: string;
}

export const PRIORITIES: Record<string, PriorityConfig> = {
  urgent: { label: "Urgent", color: "#ef4444", flagColor: "#ef4444" },
  high: { label: "High", color: "#f97316", flagColor: "#f97316" },
  medium: { label: "Medium", color: "#eab308", flagColor: "#eab308" },
  low: { label: "Low", color: "#22c55e", flagColor: "#22c55e" },
  none: { label: "None", color: "#6b7280", flagColor: "#6b7280" },
};

interface PriorityPopoverProps {
  taskId: string;
  currentPriority: string;
  position: PopoverPosition;
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onSelectPriority: (taskId: string, priority: string) => void;
}

/**
 * Popover for selecting task priority
 */
export function PriorityPopover({
  taskId,
  currentPriority,
  position,
  colors,
  isDark,
  onClose,
  onSelectPriority,
}: PriorityPopoverProps) {
  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="160px"
    >
      <PopoverHeader title="Task Priority" colors={colors} />
      <div style={{ padding: "4px 0" }}>
        {Object.entries(PRIORITIES).map(([key, value]) => (
          <PriorityOption
            key={key}
            priorityKey={key}
            config={value}
            isSelected={currentPriority === key}
            colors={colors}
            onClick={() => {
              onSelectPriority(taskId, key);
              onClose();
            }}
          />
        ))}
      </div>
    </PopoverWrapper>
  );
}

function PriorityOption({
  priorityKey,
  config,
  isSelected,
  colors,
  onClick,
}: {
  priorityKey: string;
  config: PriorityConfig;
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
      <Flag size={14} fill={config.flagColor} color={config.flagColor} />
      <span style={{ fontSize: "0.85rem", color: colors.text }}>{config.label}</span>
    </button>
  );
}
