"use client";

import React, { useState } from "react";
import { Zap, X, Plus, Loader2, Filter, Play, Edit3, Trash2 } from "lucide-react";
import type { AutomationRule, AutomationRuleCreateData } from "@/lib/api/tasks-advanced";
import type { PopoverColors } from "../popovers";

// Trigger types for automation rules
export const TRIGGER_TYPES = [
  { value: "task_created", label: "Task Created", description: "When a new task is created" },
  { value: "status_changed", label: "Status Changed", description: "When task status changes" },
  { value: "priority_changed", label: "Priority Changed", description: "When task priority changes" },
  { value: "assignee_changed", label: "Assignee Changed", description: "When assignees are modified" },
  { value: "due_date_reached", label: "Due Date Reached", description: "When due date is reached" },
  { value: "task_completed", label: "Task Completed", description: "When task is marked complete" },
];

// Action types for automation rules
export const ACTION_TYPES = [
  { value: "set_status", label: "Set Status", description: "Change task status" },
  { value: "set_priority", label: "Set Priority", description: "Change task priority" },
  { value: "add_assignee", label: "Add Assignee", description: "Assign user to task" },
  { value: "remove_assignee", label: "Remove Assignee", description: "Remove user from task" },
  { value: "add_label", label: "Add Label", description: "Add label to task" },
  { value: "send_notification", label: "Send Notification", description: "Notify users" },
  { value: "move_to_list", label: "Move to List", description: "Move task to different list" },
];

interface AutomationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  rules: AutomationRule[];
  loading: boolean;
  colors: PopoverColors;
  onToggleEnabled: (ruleId: string) => Promise<void>;
  onCreateRule: (data: AutomationRuleCreateData) => Promise<void>;
  onUpdateRule: (ruleId: string, data: Partial<AutomationRuleCreateData>) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
}

/**
 * Modal dialog for managing automation rules
 */
export function AutomationManager({
  isOpen,
  onClose,
  rules,
  loading,
  colors,
  onToggleEnabled,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
}: AutomationManagerProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const handleCreateNew = () => {
    setEditingRule(null);
    setShowEditor(true);
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm("Delete this automation rule?")) {
      await onDeleteRule(ruleId);
    }
  };

  const handleSaveRule = async (data: AutomationRuleCreateData) => {
    if (editingRule) {
      await onUpdateRule(editingRule.id, data);
    } else {
      await onCreateRule(data);
    }
    setShowEditor(false);
    setEditingRule(null);
  };

  if (!isOpen) return null;

  return (
    <>
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
            width: "700px",
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
              <Zap size={20} color={colors.accent} />
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
                Automation Rules
              </h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={handleCreateNew}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: colors.accent,
                  border: "none",
                  color: "#000",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={16} />
                New Rule
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
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2
                  size={24}
                  style={{ color: colors.accent, animation: "spin 1s linear infinite" }}
                />
              </div>
            ) : rules.length === 0 ? (
              <EmptyState colors={colors} onCreate={handleCreateNew} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {rules.map((rule) => (
                  <RuleItem
                    key={rule.id}
                    rule={rule}
                    colors={colors}
                    onToggleEnabled={onToggleEnabled}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rule Editor Modal */}
      {showEditor && (
        <RuleEditor
          rule={editingRule}
          colors={colors}
          onSave={handleSaveRule}
          onClose={() => {
            setShowEditor(false);
            setEditingRule(null);
          }}
        />
      )}
    </>
  );
}

function EmptyState({
  colors,
  onCreate,
}: {
  colors: PopoverColors;
  onCreate: () => void;
}) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <Zap size={48} style={{ opacity: 0.3, color: colors.accent, marginBottom: "16px" }} />
      <p style={{ fontSize: "1rem", color: "#fff", margin: "0 0 8px 0" }}>
        No automation rules yet
      </p>
      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", margin: "0 0 20px 0" }}>
        Create rules to automate repetitive tasks.
      </p>
      <button
        onClick={onCreate}
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          background: colors.accent,
          border: "none",
          color: "#000",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Create First Rule
      </button>
    </div>
  );
}

function RuleItem({
  rule,
  colors,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule;
  colors: PopoverColors;
  onToggleEnabled: (ruleId: string) => Promise<void>;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (ruleId: string) => void;
}) {
  const triggerInfo = TRIGGER_TYPES.find((t) => t.value === rule.triggerType);

  return (
    <div
      style={{
        padding: "16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "10px",
        border: `1px solid ${
          rule.isEnabled ? "rgba(34, 197, 94, 0.3)" : "rgba(255,255,255,0.05)"
        }`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Toggle */}
        <button
          onClick={() => onToggleEnabled(rule.id)}
          style={{
            width: "40px",
            height: "22px",
            borderRadius: "11px",
            background: rule.isEnabled ? "#22c55e" : "rgba(255,255,255,0.1)",
            border: "none",
            cursor: "pointer",
            position: "relative",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: "2px",
              left: rule.isEnabled ? "20px" : "2px",
              transition: "left 0.2s",
            }}
          />
        </button>

        {/* Rule Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "#fff" }}>
              {rule.name}
            </span>
            {rule.triggerCount > 0 && (
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "#818cf8",
                }}
              >
                {rule.triggerCount} runs
              </span>
            )}
          </div>
          {rule.description && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
                margin: "0 0 8px 0",
              }}
            >
              {rule.description}
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Zap size={12} color={colors.accent} />
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                {triggerInfo?.label || rule.triggerType}
              </span>
            </div>
            {rule.conditions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={12} color="#818cf8" />
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                  {rule.conditions.length} condition
                  {rule.conditions.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Play size={12} color="#22c55e" />
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={() => onEdit(rule)}
            title="Edit rule"
            style={{
              padding: "6px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.05)",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
            }}
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            title="Delete rule"
            style={{
              padding: "6px",
              borderRadius: "6px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  colors,
  onSave,
  onClose,
}: {
  rule: AutomationRule | null;
  colors: PopoverColors;
  onSave: (data: AutomationRuleCreateData) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [triggerType, setTriggerType] = useState(rule?.triggerType || TRIGGER_TYPES[0].value);
  const [actions, setActions] = useState<{ type: string; value: any }[]>(
    rule?.actions || [{ type: ACTION_TYPES[0].value, value: "" }]
  );
  const [isEnabled, setIsEnabled] = useState(rule?.isEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType,
        actions,
        isEnabled,
      });
    } catch (err) {
      console.error("Failed to save rule:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
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
          width: "550px",
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
            {rule ? "Edit Rule" : "Create Rule"}
          </h3>
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

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Name */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "6px",
              }}
            >
              Rule Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-assign high priority tasks"
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
          <div style={{ marginBottom: "20px" }}>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          {/* Trigger */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "6px",
              }}
            >
              Trigger (When)
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
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
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.6)",
                marginBottom: "6px",
              }}
            >
              Actions (Then)
            </label>
            {actions.map((action, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <select
                  value={action.type}
                  onChange={(e) => {
                    const updated = [...actions];
                    updated[idx] = { ...action, type: e.target.value };
                    setActions(updated);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {actions.length > 1 && (
                  <button
                    onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "none",
                      cursor: "pointer",
                      color: "#ef4444",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setActions([...actions, { type: ACTION_TYPES[0].value, value: "" }])}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.05)",
                border: "1px dashed rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              Add Action
            </button>
          </div>

          {/* Enabled Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              style={{
                width: "40px",
                height: "22px",
                borderRadius: "11px",
                background: isEnabled ? "#22c55e" : "rgba(255,255,255,0.1)",
                border: "none",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "2px",
                  left: isEnabled ? "20px" : "2px",
                  transition: "left 0.2s",
                }}
              />
            </button>
            <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>
              Enable rule immediately
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
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
            onClick={handleSave}
            disabled={!name.trim() || saving}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              background: name.trim() ? colors.accent : "rgba(255,255,255,0.1)",
              border: "none",
              color: name.trim() ? "#000" : "rgba(255,255,255,0.4)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: name.trim() && !saving ? "pointer" : "not-allowed",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
