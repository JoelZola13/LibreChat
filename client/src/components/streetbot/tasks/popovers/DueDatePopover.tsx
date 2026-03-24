"use client";

import React, { useState, useMemo } from "react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";

interface QuickDateOption {
  label: string;
  date: string | null;
  sublabel: string;
}

interface DueDatePopoverProps {
  taskId: string;
  position: PopoverPosition;
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onSelectDate: (taskId: string, date: string | null) => void;
}

/**
 * Popover for quick date selection
 */
export function DueDatePopover({
  taskId,
  position,
  colors,
  isDark,
  onClose,
  onSelectDate,
}: DueDatePopoverProps) {
  const options = useMemo(() => getQuickDateOptions(), []);

  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="200px"
    >
      <div style={{ padding: "8px 0" }}>
        {options.map((option) => (
          <DateOption
            key={option.label}
            option={option}
            colors={colors}
            onClick={() => {
              onSelectDate(taskId, option.date);
              onClose();
            }}
          />
        ))}
      </div>
    </PopoverWrapper>
  );
}

function DateOption({
  option,
  colors,
  onClick,
}: {
  option: QuickDateOption;
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
        justifyContent: "space-between",
        padding: "10px 14px",
        background: isHovered ? colors.sidebarHover : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          fontSize: "0.85rem",
          color: option.label === "Clear" ? colors.danger : colors.text,
        }}
      >
        {option.label}
      </span>
      <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>
        {option.sublabel}
      </span>
    </button>
  );
}

/**
 * Generate quick date options based on current date
 */
function getQuickDateOptions(): QuickDateOption[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const formatDate = (date: Date): string => {
    return date.toISOString();
  };

  const formatDayName = (date: Date): string => {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatFullDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return [
    {
      label: "Today",
      date: formatDate(today),
      sublabel: formatDayName(today),
    },
    {
      label: "Tomorrow",
      date: formatDate(tomorrow),
      sublabel: formatDayName(tomorrow),
    },
    {
      label: "Next week",
      date: formatDate(nextWeek),
      sublabel: formatFullDate(nextWeek),
    },
    {
      label: "Clear",
      date: null,
      sublabel: "",
    },
  ];
}

export { getQuickDateOptions };
