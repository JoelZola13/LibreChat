import React from "react";
import { Check, X } from "lucide-react";
import type { SuggestionItem } from "./types";

type Props = {
  suggestion: SuggestionItem;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  colors: Record<string, any>;
  isDark: boolean;
};

export default function SuggestionCard({ suggestion, onAccept, onReject, colors, isDark }: Props) {
  const isAccepted = suggestion.status === "accepted";
  const isRejected = suggestion.status === "rejected";

  const typeLabels: Record<string, { label: string; color: string }> = {
    skill: { label: "Skill", color: "#8B5CF6" },
    responsibility: { label: "Responsibility", color: "#3B82F6" },
    description: { label: "Enhancement", color: "#06B6D4" },
    keyword: { label: "Keyword", color: "#F59E0B" },
  };

  const typeInfo = typeLabels[suggestion.type] || { label: "Suggestion", color: "#6B7280" };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "14px",
        border: isAccepted
          ? "1px solid rgba(34,197,94,0.3)"
          : isRejected
            ? `1px solid ${colors.border}`
            : `1px solid ${colors.border}`,
        background: isAccepted
          ? (isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.05)")
          : isRejected
            ? "transparent"
            : (isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.5)"),
        opacity: isRejected ? 0.4 : 1,
        transition: "all 0.2s ease",
      }}
    >
      {/* Type badge */}
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "6px",
          fontSize: "0.6rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          background: `${typeInfo.color}15`,
          color: typeInfo.color,
          flexShrink: 0,
        }}
      >
        {typeInfo.label}
      </span>

      {/* Text */}
      <span
        style={{
          flex: 1,
          fontSize: "0.85rem",
          color: isRejected ? colors.textMuted : colors.text,
          textDecoration: isRejected ? "line-through" : "none",
          lineHeight: 1.4,
        }}
      >
        {suggestion.text}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        <button
          onClick={() => onAccept(suggestion.id)}
          title="Accept suggestion"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isAccepted ? "#22C55E" : (isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)"),
            color: isAccepted ? "#fff" : "#22C55E",
            transition: "all 0.2s",
          }}
        >
          <Check size={16} />
        </button>
        <button
          onClick={() => onReject(suggestion.id)}
          title="Reject suggestion"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isRejected ? "#EF4444" : (isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"),
            color: isRejected ? "#fff" : "#EF4444",
            transition: "all 0.2s",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

type BulkProps = {
  suggestions: SuggestionItem[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  title: string;
  colors: Record<string, any>;
  isDark: boolean;
};

export function SuggestionGroup({ suggestions, onAccept, onReject, onAcceptAll, onRejectAll, title, colors, isDark }: BulkProps) {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: colors.text, margin: 0 }}>{title}</h4>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onAcceptAll}
            style={{
              padding: "4px 12px", borderRadius: "8px", border: "none",
              background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)",
              color: "#22C55E", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            style={{
              padding: "4px 12px", borderRadius: "8px", border: "none",
              background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
              color: "#EF4444", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Dismiss All
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onAccept={onAccept} onReject={onReject} colors={colors} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}
