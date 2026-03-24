import React, { useState } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { PIPELINE_STAGES } from './grantTypes';
import type { GrantOpportunity, PipelineStage } from './grantTypes';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

function stageColor(stage: PipelineStage): string {
  return PIPELINE_STAGES.find(s => s.id === stage)?.color || '#6b7280';
}

function stageLabel(stage: PipelineStage): string {
  return PIPELINE_STAGES.find(s => s.id === stage)?.label || stage;
}

interface Props {
  grants: GrantOpportunity[];
  archivedGrants: GrantOpportunity[];
  activeGrantId: string;
  showOrgProfile: boolean;
  onSelectGrant: (id: string) => void;
  onToggleOrgProfile: () => void;
  onNewGrant?: () => void;
  onArchiveGrant?: (id: string) => void;
  onRestoreGrant?: (id: string) => void;
}

export default function GrantPipelineSidebar({ grants, archivedGrants, activeGrantId, showOrgProfile, onSelectGrant, onToggleOrgProfile, onNewGrant, onArchiveGrant, onRestoreGrant }: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const activeGrant = grants.find(g => g.id === activeGrantId);
  const activeStageIdx = activeGrant
    ? PIPELINE_STAGES.findIndex(s => s.id === activeGrant.stage)
    : -1;

  return (
    <div style={{
      width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#16161e', borderRight: `1px solid ${C.border}`,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.8))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem',
        }}>
          📋
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>Grants</div>
          <div style={{ fontSize: '0.6rem', color: C.textMuted }}>{grants.length} in pipeline</div>
        </div>
      </div>

      {/* Org Profile button */}
      <div style={{ padding: '8px 8px 0' }}>
        <button
          onClick={onToggleOrgProfile}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 10px', width: '100%', textAlign: 'left',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            background: showOrgProfile ? 'rgba(59,130,246,0.15)' : 'transparent',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!showOrgProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={e => { if (!showOrgProfile) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: showOrgProfile ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem',
          }}>🏢</div>
          <div>
            <div style={{
              fontSize: '0.75rem', fontWeight: showOrgProfile ? 700 : 500,
              color: showOrgProfile ? C.text : C.textSecondary,
            }}>
              Org Profile
            </div>
            <div style={{ fontSize: '0.58rem', color: C.textMuted }}>Street Voices</div>
          </div>
        </button>
      </div>

      <div style={{ height: 1, background: C.border, margin: '6px 12px' }} />

      {/* Grant list */}
      <div style={{ padding: '8px 8px 4px' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.textMuted, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pipeline
        </div>
        {grants.map(grant => {
          const isActive = grant.id === activeGrantId;
          const color = stageColor(grant.stage);
          return (
            <button
              key={grant.id}
              onClick={() => onSelectGrant(grant.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 10px', width: '100%', textAlign: 'left',
                border: 'none', cursor: 'pointer', borderRadius: 6,
                background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color, flexShrink: 0, marginTop: 5,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.78rem', fontWeight: isActive ? 600 : 500,
                  color: isActive ? C.text : C.textSecondary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {grant.name}
                </div>
                <div style={{
                  fontSize: '0.62rem', color: C.textMuted, marginTop: 2,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{grant.funderAbbrev || grant.funder}</span>
                  <span style={{
                    padding: '1px 6px', borderRadius: 8,
                    background: `${color}22`, color: color,
                    fontWeight: 600, fontSize: '0.55rem', textTransform: 'uppercase',
                  }}>
                    {stageLabel(grant.stage)}
                  </span>
                </div>
              </div>
              {/* Archive button */}
              {onArchiveGrant && (
                <button
                  onClick={e => { e.stopPropagation(); onArchiveGrant(grant.id); }}
                  title="Archive grant"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.textMuted, fontSize: '0.65rem', padding: '2px 4px',
                    borderRadius: 4, opacity: 0, transition: 'opacity 0.12s',
                    flexShrink: 0,
                  }}
                  className="grant-archive-btn"
                >×</button>
              )}
            </button>
          );
        })}
      </div>

      {/* Pipeline progress for active grant */}
      {activeGrant && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, marginTop: 'auto' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Progress
          </div>
          {PIPELINE_STAGES.filter(s => !['declined', 'closed'].includes(s.id)).map((stage, idx) => {
            const isComplete = idx < activeStageIdx;
            const isCurrent = idx === activeStageIdx;
            const isFuture = idx > activeStageIdx;
            return (
              <div key={stage.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${isComplete ? '#22c55e' : isCurrent ? stage.color : C.border}`,
                  background: isComplete ? '#22c55e' : 'transparent',
                  fontSize: '0.5rem', color: '#fff',
                }}>
                  {isComplete && '✓'}
                </div>
                <span style={{
                  fontSize: '0.68rem',
                  color: isCurrent ? C.text : isFuture ? C.textMuted : C.textSecondary,
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived grants */}
      {archivedGrants.length > 0 && (
        <div style={{ padding: '4px 8px' }}>
          <button
            onClick={() => setShowArchived(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              padding: '6px 8px', border: 'none', cursor: 'pointer',
              background: 'transparent', color: C.textMuted,
              fontSize: '0.6rem', fontWeight: 700, fontFamily: 'inherit',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            <span style={{ fontSize: '0.65rem' }}>{showArchived ? '▾' : '▸'}</span>
            Archived ({archivedGrants.length})
          </button>
          {showArchived && archivedGrants.map(grant => (
            <div key={grant.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 6, marginBottom: 2,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.7rem', color: C.textMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textDecoration: 'line-through', opacity: 0.7,
                }}>
                  {grant.name}
                </div>
              </div>
              {onRestoreGrant && (
                <button
                  onClick={() => onRestoreGrant(grant.id)}
                  title="Restore grant"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: PURPLE, fontSize: '0.6rem', fontWeight: 600,
                    fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4,
                  }}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Grant button */}
      <div style={{ padding: '8px 12px 12px' }}>
        <button
          onClick={onNewGrant}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(139,92,246,0.1)', border: `1px dashed rgba(139,92,246,0.3)`,
            color: PURPLE, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; }}
        >
          + New Grant
        </button>
      </div>

      {/* CSS for hover archive button */}
      <style>{`
        button:hover .grant-archive-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
