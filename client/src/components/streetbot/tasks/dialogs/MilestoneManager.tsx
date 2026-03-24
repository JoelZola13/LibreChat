"use client";

import React, { useState } from "react";
import { Flag, X, Plus, Trash2, Calendar } from "lucide-react";
import type { Milestone, MilestoneCreateData } from "@/lib/api/tasks-advanced";
import type { PopoverColors } from "../popovers";

// Color palette for milestones
const MILESTONE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#FFD600",
];

interface MilestoneManagerProps {
  isOpen: boolean;
  onClose: () => void;
  milestones: Milestone[];
  colors: PopoverColors;
  onCreateMilestone: (data: MilestoneCreateData) => Promise<void>;
  onDeleteMilestone: (milestoneId: string) => Promise<void>;
}

/**
 * Modal dialog for managing project milestones
 */
export function MilestoneManager({
  isOpen,
  onClose,
  milestones,
  colors,
  onCreateMilestone,
  onDeleteMilestone,
}: MilestoneManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(MILESTONE_COLORS[0]);
  const [newDueDate, setNewDueDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateMilestone({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        color: newColor,
        dueDate: newDueDate || undefined,
      });
      setNewName("");
      setNewDescription("");
      setNewColor(MILESTONE_COLORS[0]);
      setNewDueDate("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create milestone:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (milestone: Milestone) => {
    if (confirm(`Delete milestone "${milestone.name}"?`)) {
      await onDeleteMilestone(milestone.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(30,30,40,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px",
          width: "550px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Flag size={20} color={colors.accent} />
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
              Manage Milestones
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                background: `${colors.accent}20`,
                border: `1px solid ${colors.accent}40`,
                borderRadius: "6px",
                color: colors.accent,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              Add
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                padding: "4px",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {milestones.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <Flag
                size={40}
                style={{ opacity: 0.3, color: colors.accent, marginBottom: "16px" }}
              />
              <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
                No milestones yet
              </p>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                Create milestones to track project progress.
              </p>
            </div>
          ) : (
            milestones.map((milestone) => (
              <MilestoneItem
                key={milestone.id}
                milestone={milestone}
                colors={colors}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Create Milestone Modal */}
      {showCreate && (
        <CreateMilestoneModal
          colors={colors}
          newName={newName}
          setNewName={setNewName}
          newDescription={newDescription}
          setNewDescription={setNewDescription}
          newColor={newColor}
          setNewColor={setNewColor}
          newDueDate={newDueDate}
          setNewDueDate={setNewDueDate}
          isCreating={isCreating}
          onCreate={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function MilestoneItem({
  milestone,
  colors,
  onDelete,
}: {
  milestone: Milestone;
  colors: PopoverColors;
  onDelete: (milestone: Milestone) => void;
}) {
  const statusColor =
    milestone.status === "completed"
      ? "#22c55e"
      : milestone.status === "in_progress"
      ? "#eab308"
      : "#6366f1";

  const statusBg =
    milestone.status === "completed"
      ? "rgba(34,197,94,0.2)"
      : milestone.status === "in_progress"
      ? "rgba(234,179,8,0.2)"
      : "rgba(99,102,241,0.2)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "8px",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "3px",
          background: milestone.color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 500 }}>
          {milestone.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "6px",
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              flex: 1,
              maxWidth: "200px",
              height: "6px",
              background: `${milestone.color}30`,
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${milestone.progress}%`,
                height: "100%",
                background: milestone.color,
                borderRadius: "3px",
              }}
            />
          </div>
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
            {milestone.progress}%
          </span>
          {milestone.dueDate && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Calendar size={12} />
              {new Date(milestone.dueDate).toLocaleDateString()}
            </span>
          )}
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.7rem",
              background: statusBg,
              color: statusColor,
            }}
          >
            {milestone.status.replace("_", " ")}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(milestone)}
        style={{
          padding: "6px 10px",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "6px",
          color: "#ef4444",
          cursor: "pointer",
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CreateMilestoneModal({
  colors,
  newName,
  setNewName,
  newDescription,
  setNewDescription,
  newColor,
  setNewColor,
  newDueDate,
  setNewDueDate,
  isCreating,
  onCreate,
  onClose,
}: {
  colors: PopoverColors;
  newName: string;
  setNewName: (val: string) => void;
  newDescription: string;
  setNewDescription: (val: string) => void;
  newColor: string;
  setNewColor: (val: string) => void;
  newDueDate: string;
  setNewDueDate: (val: string) => void;
  isCreating: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(30,30,40,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px",
          width: "450px",
          maxWidth: "90vw",
          padding: "24px",
        }}
      >
        <h4 style={{ margin: "0 0 20px 0", fontSize: "1rem", fontWeight: 600, color: "#fff" }}>
          Create Milestone
        </h4>

        {/* Name */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "6px",
            }}
          >
            Name *
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Milestone name"
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "6px",
            }}
          >
            Description
          </label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>

        {/* Due Date */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "6px",
            }}
          >
            Due Date
          </label>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {/* Color */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.6)",
              marginBottom: "6px",
            }}
          >
            Color
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {MILESTONE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: color,
                  border: newColor === color ? "2px solid #fff" : "none",
                  cursor: "pointer",
                  boxShadow: newColor === color ? `0 0 0 2px ${color}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!newName.trim() || isCreating}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              background: newName.trim() ? colors.accent : "rgba(255,255,255,0.1)",
              border: "none",
              color: newName.trim() ? "#000" : "rgba(255,255,255,0.4)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: newName.trim() && !isCreating ? "pointer" : "not-allowed",
              opacity: isCreating ? 0.7 : 1,
            }}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
