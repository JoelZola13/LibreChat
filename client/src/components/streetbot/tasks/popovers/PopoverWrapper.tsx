"use client";

import React from "react";

export interface PopoverColors {
  sidebar: string;
  sidebarHover: string;
  sidebarActive: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  danger: string;
}

export interface PopoverPosition {
  top: number;
  left: number;
}

interface PopoverWrapperProps {
  position: PopoverPosition;
  onClose: () => void;
  colors: PopoverColors;
  isDark: boolean;
  minWidth?: string;
  maxHeight?: string;
  width?: number | string;
  children: React.ReactNode;
}

/**
 * Reusable popover wrapper with backdrop and glass styling
 */
export function PopoverWrapper({
  position,
  onClose,
  colors,
  isDark,
  minWidth = "200px",
  maxHeight,
  width,
  children,
}: PopoverWrapperProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          minWidth,
          maxHeight,
          width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
          background: colors.sidebar,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          boxShadow: isDark
            ? "0 8px 32px rgba(0, 0, 0, 0.4)"
            : "0 8px 32px rgba(31, 38, 135, 0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Popover section header
 */
export function PopoverHeader({
  title,
  colors,
  noBorder = false,
}: {
  title: string;
  colors: PopoverColors;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: "6px 12px",
        fontSize: "0.7rem",
        fontWeight: 600,
        color: colors.textMuted,
        textTransform: "uppercase",
        borderBottom: noBorder ? "none" : `1px solid ${colors.border}`,
      }}
    >
      {title}
    </div>
  );
}

/**
 * Popover option button
 */
export function PopoverOption({
  children,
  onClick,
  isSelected = false,
  colors,
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isSelected?: boolean;
  colors: PopoverColors;
  style?: React.CSSProperties;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

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
        ...style,
      }}
    >
      {children}
    </button>
  );
}
