import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Search, Bot, Wrench } from "lucide-react";
import { SB_API_BASE } from "~/components/streetbot/shared/apiConfig";
import { useGlassStyles } from "../shared/useGlassStyles";
import { GlassBackground } from "../shared/GlassBackground";
import { AGENT_ICONS, TEAM_COLORS, TEAM_DISPLAY_NAMES } from "../groups/agentIcons";
import AgentDetailModal from "./AgentDetailModal";
import type { NanobotAgent, AgentsResponse } from "./types";

const AGENTS_API_URL = `${SB_API_BASE}/v1/agents/list`;

export default function AgentMarketplacePage() {
  const { team: teamParam } = useParams<{ team?: string }>();
  const { isDark, colors, glassCard, glassSurface, cardHoverHandlers } = useGlassStyles();

  const [agents, setAgents] = useState<NanobotAgent[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTeam, setActiveTeam] = useState<string>(teamParam || "all");
  const [selectedAgent, setSelectedAgent] = useState<NanobotAgent | null>(null);

  // Sync URL param to active team
  useEffect(() => {
    setActiveTeam(teamParam || "all");
  }, [teamParam]);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await fetch(AGENTS_API_URL);
      if (resp.ok) {
        const data: AgentsResponse = await resp.json();
        // Filter out memory agents — they're infrastructure, not user-facing
        const visible = data.agents.filter((a) => a.role !== "memory");
        setAgents(visible);
        setTeams(data.teams);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Client-side filtering
  const filtered = agents.filter((agent) => {
    // Team filter
    if (activeTeam !== "all" && agent.team !== activeTeam) return false;
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        agent.displayName.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.team.toLowerCase().includes(q) ||
        agent.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      <GlassBackground />

      {/* Hero */}
      <section
        style={{
          background: "transparent",
          padding: "60px 24px 48px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 700,
              color: colors.text,
              marginBottom: "12px",
            }}
          >
            Agent Marketplace
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: colors.textSecondary,
              maxWidth: "600px",
              margin: 0,
            }}
          >
            Browse and chat with specialized AI agents across {teams.length} teams
          </p>
        </div>
      </section>

      {/* Main */}
      <div
        style={{
          padding: "0 24px 60px",
          color: colors.text,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Search */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                ...glassSurface,
                padding: "14px 20px",
                borderRadius: "30px",
                maxWidth: "500px",
              }}
            >
              <Search size={20} color={colors.textSecondary} />
              <input
                type="text"
                placeholder="Search agents by name, team, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "1rem",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: colors.text,
                }}
              />
            </div>
          </div>

          {/* Team tabs */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "32px",
              flexWrap: "wrap",
            }}
          >
            <TeamTab
              label="All"
              value="all"
              active={activeTeam === "all"}
              color={colors.accent}
              isDark={isDark}
              colors={colors}
              count={agents.length}
              onClick={() => setActiveTeam("all")}
            />
            {teams.filter((t) => t !== "unknown").map((team) => (
              <TeamTab
                key={team}
                label={TEAM_DISPLAY_NAMES[team] || team.replace(/_/g, " ")}
                value={team}
                active={activeTeam === team}
                color={TEAM_COLORS[team] || "#666"}
                isDark={isDark}
                colors={colors}
                count={agents.filter((a) => a.team === team && a.role !== "memory").length}
                onClick={() => setActiveTeam(team)}
              />
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: "24px",
              }}
            >
              Loading agents...
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: colors.textSecondary,
                ...glassSurface,
                borderRadius: "24px",
              }}
            >
              <Bot
                size={48}
                color={colors.textMuted}
                style={{ marginBottom: "16px" }}
              />
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: colors.text,
                  marginBottom: "8px",
                }}
              >
                No agents found
              </h3>
              <p>Try a different search or team filter.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "24px",
              }}
            >
              {filtered.map((agent) => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  isDark={isDark}
                  colors={colors}
                  glassCard={glassCard}
                  cardHoverHandlers={cardHoverHandlers}
                  onClick={() => setSelectedAgent(agent)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

/* ─── Team Tab ─── */
function TeamTab({
  label,
  value,
  active,
  color,
  isDark,
  colors,
  count,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  color: string;
  isDark: boolean;
  colors: ReturnType<typeof useGlassStyles>["colors"];
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px",
        borderRadius: "20px",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        border: active ? "none" : `1px solid ${colors.border}`,
        background: active ? color : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.03)",
        color: active ? (color === "#FFD600" || color === "#F59E0B" || color === "#F97316" ? "#000" : "#fff") : colors.textSecondary,
        boxShadow: active ? `0 2px 12px ${color}44` : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.06)";
          e.currentTarget.style.borderColor = color;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.03)";
          e.currentTarget.style.borderColor = colors.border;
        }
      }}
    >
      {label}
      <span
        style={{
          marginLeft: "6px",
          fontSize: "0.75rem",
          opacity: 0.7,
        }}
      >
        {count}
      </span>
    </button>
  );
}

/* ─── Agent Card ─── */
function AgentCard({
  agent,
  isDark,
  colors,
  glassCard,
  cardHoverHandlers,
  onClick,
}: {
  agent: NanobotAgent;
  isDark: boolean;
  colors: ReturnType<typeof useGlassStyles>["colors"];
  glassCard: React.CSSProperties;
  cardHoverHandlers: ReturnType<typeof useGlassStyles>["cardHoverHandlers"];
  onClick: () => void;
}) {
  const teamColor = TEAM_COLORS[agent.team] || "#666";
  const iconUrl = AGENT_ICONS[agent.name] || AGENT_ICONS[agent.name.replace(/_/g, "-")];

  return (
    <div
      onClick={onClick}
      style={{
        ...glassCard,
        padding: "24px",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      {...cardHoverHandlers}
    >
      <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
        {/* Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: teamColor,
            boxShadow: `0 4px 16px ${teamColor}44`,
            border: `2px solid ${colors.border}`,
          }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={agent.displayName}
              style={{ width: "28px", height: "28px", filter: "brightness(0) invert(1)" }}
            />
          ) : (
            <Bot size={28} color="#fff" />
          )}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: colors.text,
              margin: "0 0 6px 0",
            }}
          >
            {agent.displayName}
          </h3>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {agent.role === "lead" && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: `${teamColor}33`,
                  color: teamColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Lead
              </span>
            )}
            <span
              style={{
                fontSize: "0.75rem",
                color: colors.textMuted,
              }}
            >
              {TEAM_DISPLAY_NAMES[agent.team] || agent.team}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "0.875rem",
          color: colors.textSecondary,
          lineHeight: 1.5,
          margin: "0 0 16px 0",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {agent.description || "No description"}
      </p>

      {/* Footer stats */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.75rem",
            color: colors.textMuted,
          }}
        >
          <Wrench size={13} />
          {agent.toolCount} tools
        </span>
        {agent.handoffs.length > 0 && (
          <span
            style={{
              fontSize: "0.75rem",
              color: colors.textMuted,
            }}
          >
            {agent.handoffs.length} handoff{agent.handoffs.length !== 1 ? "s" : ""}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.7rem",
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: "8px",
            background: isDark ? `${teamColor}22` : `${teamColor}18`,
            color: teamColor,
            border: `1px solid ${teamColor}33`,
          }}
        >
          {TEAM_DISPLAY_NAMES[agent.team] || agent.team}
        </span>
      </div>
    </div>
  );
}
