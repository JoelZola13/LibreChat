import React, { useEffect } from "react";
import { useGlassStyles } from "../shared/useGlassStyles";
import { AGENT_ICONS, TEAM_COLORS, TEAM_DISPLAY_NAMES } from "../groups/agentIcons";
import type { NanobotAgent } from "./types";

interface AgentDetailModalProps {
  agent: NanobotAgent | null;
  onClose: () => void;
}

export default function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  const { isDark, colors, glassCard } = useGlassStyles();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!agent) return null;

  const teamColor = TEAM_COLORS[agent.team] || "#666";
  const iconUrl = AGENT_ICONS[agent.name] || AGENT_ICONS[agent.name.replace(/_/g, "-")];
  const teamName = TEAM_DISPLAY_NAMES[agent.team] || agent.team;

  const handleStartChat = () => {
    window.location.href = `/?agentModel=${agent.model}`;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...glassCard,
          width: "100%",
          maxWidth: "520px",
          margin: "0 16px",
          overflow: "hidden",
        }}
      >
        {/* Header with team color */}
        <div
          style={{
            background: `linear-gradient(135deg, ${teamColor}CC, ${teamColor}88)`,
            padding: "32px 28px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background: "rgba(0, 0, 0, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "2px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {iconUrl ? (
              <img
                src={iconUrl}
                alt={agent.displayName}
                style={{ width: "40px", height: "40px", filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <span style={{ fontSize: "32px", color: "#fff", fontWeight: 700 }}>
                {agent.displayName.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: 0 }}>
              {agent.displayName}
            </h2>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.2)",
                  color: "#fff",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {agent.role}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {teamName}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px" }}>
          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: colors.textSecondary,
              margin: "0 0 24px 0",
            }}
          >
            {agent.description || "No description available."}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginBottom: "24px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "14px",
                borderRadius: "14px",
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                border: `1px solid ${colors.border}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: teamColor }}>
                {agent.toolCount}
              </div>
              <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "2px" }}>
                Tools
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "14px",
                borderRadius: "14px",
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                border: `1px solid ${colors.border}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: teamColor }}>
                {agent.handoffs.length}
              </div>
              <div style={{ fontSize: "0.75rem", color: colors.textMuted, marginTop: "2px" }}>
                Handoffs
              </div>
            </div>
          </div>

          {/* Handoffs */}
          {agent.handoffs.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: colors.textMuted,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Can delegate to
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {agent.handoffs.map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: "0.8rem",
                      padding: "4px 12px",
                      borderRadius: "10px",
                      background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                    }}
                  >
                    {h.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={handleStartChat}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "14px",
                background: teamColor,
                color: "#fff",
                fontWeight: 700,
                fontSize: "15px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: `0 4px 14px ${teamColor}66`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow = `0 6px 20px ${teamColor}88`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = `0 4px 14px ${teamColor}66`;
              }}
            >
              Start Chat
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "14px 24px",
                borderRadius: "14px",
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                color: colors.textSecondary,
                fontWeight: 600,
                fontSize: "15px",
                border: `1px solid ${colors.border}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)";
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
