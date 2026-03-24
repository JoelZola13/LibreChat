"use client";

import React, { useState } from "react";
import { X, Star } from "lucide-react";
import { PopoverWrapper, PopoverColors, PopoverPosition } from "./PopoverWrapper";
import type { CustomField } from "@/lib/api/tasks-advanced";

interface CustomFieldPopoverProps {
  taskId: string;
  fieldId: string;
  field: CustomField;
  position: PopoverPosition;
  currentValue: any;
  colors: PopoverColors;
  isDark: boolean;
  onClose: () => void;
  onUpdateValue: (taskId: string, fieldId: string, value: any) => Promise<void>;
}

/**
 * Popover for editing custom field values on tasks
 * Supports: text, number, date, select, rating, progress, email, url, currency, percent
 */
export function CustomFieldPopover({
  taskId,
  fieldId,
  field,
  position,
  currentValue,
  colors,
  isDark,
  onClose,
  onUpdateValue,
}: CustomFieldPopoverProps) {
  const [editValue, setEditValue] = useState<string>(String(currentValue ?? ""));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (value: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUpdateValue(taskId, fieldId, value);
      onClose();
    } catch (err) {
      console.error("Failed to update field:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = ["number", "currency", "percent"].includes(field.fieldType)
        ? Number(editValue) || null
        : editValue || null;
      await handleSave(val);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <PopoverWrapper
      position={position}
      onClose={onClose}
      colors={colors}
      isDark={isDark}
      minWidth="240px"
      maxHeight="400px"
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: colors.text }}>
          {field.name}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: colors.textMuted,
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Field Editor based on type */}
      <div style={{ padding: "12px 16px" }}>
        {/* Select field */}
        {field.fieldType === "select" && (
          <SelectFieldEditor
            field={field}
            currentValue={currentValue}
            colors={colors}
            onSelect={handleSave}
          />
        )}

        {/* Rating field */}
        {field.fieldType === "rating" && (
          <RatingFieldEditor
            field={field}
            currentValue={currentValue}
            colors={colors}
            onSelect={handleSave}
          />
        )}

        {/* Progress field */}
        {field.fieldType === "progress" && (
          <ProgressFieldEditor
            editValue={editValue}
            setEditValue={setEditValue}
            colors={colors}
            onSave={handleSave}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Date field */}
        {field.fieldType === "date" && (
          <DateFieldEditor
            editValue={editValue}
            colors={colors}
            onSave={handleSave}
          />
        )}

        {/* Text, Email, URL, Number, Currency, Percent fields */}
        {["text", "email", "url", "number", "currency", "percent"].includes(field.fieldType) && (
          <TextFieldEditor
            field={field}
            editValue={editValue}
            setEditValue={setEditValue}
            colors={colors}
            onSave={handleSave}
            onKeyDown={handleKeyDown}
            onClose={onClose}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </PopoverWrapper>
  );
}

// Select field editor
function SelectFieldEditor({
  field,
  currentValue,
  colors,
  onSelect,
}: {
  field: CustomField;
  currentValue: any;
  colors: PopoverColors;
  onSelect: (value: any) => Promise<void>;
}) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {field.config.options?.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          onMouseEnter={() => setHoveredOption(opt.value)}
          onMouseLeave={() => setHoveredOption(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            background:
              currentValue === opt.value
                ? colors.sidebarActive
                : hoveredOption === opt.value
                ? colors.sidebarHover
                : "transparent",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: opt.color || colors.accent,
            }}
          />
          <span style={{ color: colors.text, fontSize: "0.85rem" }}>{opt.label}</span>
        </button>
      ))}
      <ClearButton colors={colors} onClear={() => onSelect(null)} label="Clear value" />
    </div>
  );
}

// Rating field editor
function RatingFieldEditor({
  field,
  currentValue,
  colors,
  onSelect,
}: {
  field: CustomField;
  currentValue: any;
  colors: PopoverColors;
  onSelect: (value: any) => Promise<void>;
}) {
  const currentRating = Number(currentValue) || 0;
  const maxRating = field.config.maxRating || 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        {Array.from({ length: maxRating }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i + 1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <Star
              size={24}
              fill={i < currentRating ? colors.accent : "transparent"}
              color={i < currentRating ? colors.accent : colors.textMuted}
            />
          </button>
        ))}
      </div>
      <button
        onClick={() => onSelect(0)}
        style={{
          padding: "6px 12px",
          background: "transparent",
          border: `1px solid ${colors.border}`,
          borderRadius: "6px",
          cursor: "pointer",
          color: colors.textMuted,
          fontSize: "0.8rem",
        }}
      >
        Clear rating
      </button>
    </div>
  );
}

// Progress field editor
function ProgressFieldEditor({
  editValue,
  setEditValue,
  colors,
  onSave,
  isSubmitting,
}: {
  editValue: string;
  setEditValue: (val: string) => void;
  colors: PopoverColors;
  onSave: (value: any) => Promise<void>;
  isSubmitting: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input
        type="range"
        min="0"
        max="100"
        value={Number(editValue) || 0}
        onChange={(e) => setEditValue(e.target.value)}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="number"
          min="0"
          max="100"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "6px",
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            fontSize: "0.9rem",
          }}
        />
        <span style={{ color: colors.textMuted }}>%</span>
      </div>
      <button
        onClick={() => {
          const val = Math.min(100, Math.max(0, Number(editValue) || 0));
          onSave(val);
        }}
        disabled={isSubmitting}
        style={{
          padding: "8px 16px",
          background: colors.accent,
          border: "none",
          borderRadius: "6px",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          color: "#000",
          fontWeight: 600,
          fontSize: "0.85rem",
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        Save
      </button>
    </div>
  );
}

// Date field editor
function DateFieldEditor({
  editValue,
  colors,
  onSave,
}: {
  editValue: string;
  colors: PopoverColors;
  onSave: (value: any) => Promise<void>;
}) {
  const [dateValue, setDateValue] = useState(() => {
    if (!editValue) return "";
    try {
      return new Date(editValue).toISOString().split("T")[0];
    } catch {
      return "";
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input
        type="date"
        value={dateValue}
        onChange={(e) => {
          setDateValue(e.target.value);
          if (e.target.value) {
            onSave(new Date(e.target.value).toISOString());
          }
        }}
        style={{
          padding: "10px 12px",
          borderRadius: "6px",
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.text,
          fontSize: "0.9rem",
        }}
      />
      <ClearButton colors={colors} onClear={() => onSave(null)} label="Clear date" />
    </div>
  );
}

// Text/Number/Email/URL/Currency/Percent field editor
function TextFieldEditor({
  field,
  editValue,
  setEditValue,
  colors,
  onSave,
  onKeyDown,
  onClose,
  isSubmitting,
}: {
  field: CustomField;
  editValue: string;
  setEditValue: (val: string) => void;
  colors: PopoverColors;
  onSave: (value: any) => Promise<void>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const inputType = ["number", "currency", "percent"].includes(field.fieldType)
    ? "number"
    : "text";

  const handleSave = () => {
    const val =
      ["number", "currency", "percent"].includes(field.fieldType)
        ? Number(editValue) || null
        : editValue || null;
    onSave(val);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <input
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        placeholder={`Enter ${field.name}...`}
        autoFocus
        onKeyDown={onKeyDown}
        style={{
          padding: "10px 12px",
          borderRadius: "6px",
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.text,
          fontSize: "0.9rem",
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: "8px 16px",
            background: colors.accent,
            border: "none",
            borderRadius: "6px",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            color: "#000",
            fontWeight: 600,
            fontSize: "0.85rem",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          Save
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            cursor: "pointer",
            color: colors.text,
            fontSize: "0.85rem",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Clear button helper
function ClearButton({
  colors,
  onClear,
  label,
}: {
  colors: PopoverColors;
  onClear: () => void;
  label: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClear}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "8px 12px",
        background: isHovered ? colors.sidebarHover : "transparent",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        textAlign: "left",
        color: colors.textMuted,
        fontSize: "0.85rem",
      }}
    >
      {label}
    </button>
  );
}
