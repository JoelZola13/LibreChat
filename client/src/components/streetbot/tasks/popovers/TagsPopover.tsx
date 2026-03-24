"use client";

import React, { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import type { Label } from "@/lib/api/tasks";

// Color palette for labels
const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#FFD600",
];

interface TagsPopoverProps {
  taskId: string;
  position: PopoverPosition;
  currentLabels: string[];
  allLabels: Label[];
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onToggleLabel: (taskId: string, labelName: string) => void;
  onCreateLabel: (name: string, color: string) => Promise<void>;
}

/**
 * Popover for managing task labels/tags
 */
export function TagsPopover({
  taskId,
  position,
  currentLabels,
  allLabels,
  colors,
  isDark,
  onClose,
  onToggleLabel,
  onCreateLabel,
}: TagsPopoverProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const filteredLabels = allLabels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateLabel(newLabelName.trim(), newLabelColor);
      setNewLabelName("");
      setShowCreateNew(false);
    } catch (err) {
      console.error("Failed to create label:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="260px"
      maxHeight="400px"
    >
      {/* Search */}
      <div style={{ padding: "8px", borderBottom: `1px solid ${colors.border}` }}>
        <input
          type="text"
          placeholder="Search labels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "8px 12px",
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            color: colors.text,
            fontSize: "0.85rem",
            outline: "none",
          }}
        />
      </div>

      {/* Labels list */}
      <div style={{ maxHeight: "200px", overflowY: "auto", padding: "4px 0" }}>
        {filteredLabels.length > 0 ? (
          filteredLabels.map((label) => {
            const isSelected = currentLabels.includes(label.name);
            return (
              <LabelOption
                key={label.id}
                label={label}
                isSelected={isSelected}
                colors={colors}
                onClick={() => onToggleLabel(taskId, label.name)}
              />
            );
          })
        ) : (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: colors.textMuted,
              fontSize: "0.85rem",
            }}
          >
            {searchQuery ? "No labels found" : "No labels yet"}
          </div>
        )}
      </div>

      {/* Create new label section */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "8px" }}>
        {showCreateNew ? (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Label name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateLabel();
                  if (e.key === "Escape") setShowCreateNew(false);
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "4px",
                  color: colors.text,
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCreateLabel}
                disabled={!newLabelName.trim() || isCreating}
                style={{
                  padding: "6px",
                  background: newLabelName.trim() ? colors.accent : colors.surface,
                  border: "none",
                  borderRadius: "4px",
                  cursor: newLabelName.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={16} color={newLabelName.trim() ? "#000" : colors.textMuted} />
              </button>
              <button
                onClick={() => setShowCreateNew(false)}
                style={{
                  padding: "6px",
                  background: colors.surface,
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color={colors.textMuted} />
              </button>
            </div>
            {/* Color picker */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewLabelColor(color)}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    background: color,
                    border: newLabelColor === color ? "2px solid #fff" : "none",
                    cursor: "pointer",
                    boxShadow:
                      newLabelColor === color
                        ? `0 0 0 2px ${color}`
                        : "none",
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateNew(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: colors.text,
              fontSize: "0.85rem",
            }}
          >
            <Plus size={14} />
            Create new label
          </button>
        )}
      </div>
    </PopoverWrapper>
  );
}

function LabelOption({
  label,
  isSelected,
  colors,
  onClick,
}: {
  label: Label;
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
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "4px",
          background: label.color,
        }}
      />
      <span style={{ fontSize: "0.85rem", color: colors.text }}>{label.name}</span>
      {isSelected && (
        <Check size={14} color={colors.accent} style={{ marginLeft: "auto" }} />
      )}
    </button>
  );
}
