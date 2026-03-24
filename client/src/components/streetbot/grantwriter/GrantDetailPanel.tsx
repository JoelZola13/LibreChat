import React, { useState } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { PIPELINE_STAGES } from './grantTypes';
import type { GrantOpportunity, GrantIntelligence } from './grantTypes';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

function stageColor(stage: string): string {
  return PIPELINE_STAGES.find(s => s.id === stage)?.color || '#6b7280';
}

function stageLabel(stage: string): string {
  return PIPELINE_STAGES.find(s => s.id === stage)?.label || stage;
}

// Section header
function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div style={{
      fontSize: '0.62rem', fontWeight: 700, color: C.textMuted,
      textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {icon && <span style={{ fontSize: '0.7rem' }}>{icon}</span>}
      {title}
    </div>
  );
}

// Score bar component
function ScoreBar({ label, score, max = 5 }: { label: string; score?: number; max?: number }) {
  if (score === undefined) return null;
  const pct = (score / max) * 100;
  const color = score >= 4 ? '#22c55e' : score >= 3 ? '#eab308' : '#ef4444';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.68rem', color: C.textMuted }}>{label}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color }}>{score}/{max}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// Document row
function DocRow({ label, exists }: { label: string; exists: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
      fontSize: '0.72rem', color: exists ? C.text : C.textMuted,
    }}>
      <span style={{ fontSize: '0.75rem' }}>{exists ? '✅' : '○'}</span>
      <span style={{ fontWeight: exists ? 500 : 400 }}>{label}</span>
    </div>
  );
}

// Pill / tag
function Pill({ text, color: pillColor }: { text: string; color?: string }) {
  const c = pillColor || PURPLE;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      background: `${c}18`, color: c, fontSize: '0.62rem', fontWeight: 600,
      marginRight: 4, marginBottom: 4,
    }}>
      {text}
    </span>
  );
}

// Collapsible section
function Collapsible({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 16px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: C.textMuted,
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span style={{ fontSize: '0.5rem', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <span style={{ fontSize: '0.7rem' }}>{icon}</span>
        {title}
      </button>
      {open && <div style={{ padding: '0 16px 12px' }}>{children}</div>}
    </div>
  );
}

// Intelligence brief section
function IntelligenceBrief({ intel, grantName }: { intel: GrantIntelligence; grantName: string }) {
  const hasScoring = intel.scoringCriteria && intel.scoringCriteria.length > 0;
  const hasPriorities = intel.funderPriorities && intel.funderPriorities.length > 0;
  const hasEligibility = intel.eligibilityRequirements && intel.eligibilityRequirements.length > 0;
  const hasDates = intel.keyDates && intel.keyDates.length > 0;
  const hasTips = intel.tips && intel.tips.length > 0;
  const hasPastGrantees = intel.pastGrantees && intel.pastGrantees.length > 0;
  const hasResources = intel.additionalResources && intel.additionalResources.length > 0;

  return (
    <>
      {/* Funder priorities */}
      {(intel.funderMission || hasPriorities) && (
        <Collapsible title="Funder Priorities" icon="🎯" defaultOpen>
          {intel.funderMission && (
            <p style={{ fontSize: '0.68rem', color: C.textSecondary, margin: '0 0 8px', lineHeight: 1.5 }}>
              {intel.funderMission}
            </p>
          )}
          {hasPriorities && (
            <div style={{ marginTop: 4 }}>
              {intel.funderPriorities!.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#22c55e', fontSize: '0.6rem', marginTop: 2, flexShrink: 0 }}>●</span>
                  <span style={{ fontSize: '0.68rem', color: C.text, lineHeight: 1.4 }}>{p}</span>
                </div>
              ))}
            </div>
          )}
        </Collapsible>
      )}

      {/* Scoring criteria */}
      {hasScoring && (
        <Collapsible title="Scoring Criteria" icon="📊" defaultOpen>
          {intel.scoringCriteria!.map((sc, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.text }}>{sc.criterion}</span>
                {sc.weight && <Pill text={sc.weight} color="#eab308" />}
              </div>
              {sc.description && (
                <p style={{ fontSize: '0.62rem', color: C.textMuted, margin: '2px 0 0', lineHeight: 1.4 }}>
                  {sc.description}
                </p>
              )}
            </div>
          ))}
          {intel.evaluationProcess && (
            <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.08)' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: PURPLE, textTransform: 'uppercase' }}>Review Process: </span>
              <span style={{ fontSize: '0.62rem', color: C.textSecondary }}>{intel.evaluationProcess}</span>
            </div>
          )}
        </Collapsible>
      )}

      {/* Key stats */}
      {(intel.averageGrantSize || intel.acceptanceRate || intel.totalFunding) && (
        <Collapsible title="Key Stats" icon="📈">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {intel.averageGrantSize && (
              <div style={{ padding: '8px', borderRadius: 6, background: 'rgba(34,197,94,0.08)' }}>
                <div style={{ fontSize: '0.55rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Avg Grant</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e' }}>{intel.averageGrantSize}</div>
              </div>
            )}
            {intel.acceptanceRate && (
              <div style={{ padding: '8px', borderRadius: 6, background: 'rgba(234,179,8,0.08)' }}>
                <div style={{ fontSize: '0.55rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Accept Rate</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#eab308' }}>{intel.acceptanceRate}</div>
              </div>
            )}
            {intel.totalFunding && (
              <div style={{ padding: '8px', borderRadius: 6, background: 'rgba(139,92,246,0.08)', gridColumn: intel.averageGrantSize && intel.acceptanceRate ? '1 / -1' : undefined }}>
                <div style={{ fontSize: '0.55rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Total Annual Funding</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: PURPLE }}>{intel.totalFunding}</div>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Eligibility */}
      {(hasEligibility || intel.ineligible) && (
        <Collapsible title="Eligibility" icon="✅">
          {hasEligibility && intel.eligibilityRequirements!.map((req, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#22c55e', fontSize: '0.55rem', marginTop: 3, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: '0.65rem', color: C.text, lineHeight: 1.4 }}>{req}</span>
            </div>
          ))}
          {intel.ineligible && intel.ineligible.length > 0 && (
            <>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444', margin: '8px 0 4px', textTransform: 'uppercase' }}>Not Eligible</div>
              {intel.ineligible.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#ef4444', fontSize: '0.55rem', marginTop: 3, flexShrink: 0 }}>✗</span>
                  <span style={{ fontSize: '0.62rem', color: C.textMuted, lineHeight: 1.4 }}>{item}</span>
                </div>
              ))}
            </>
          )}
          {intel.geoRestrictions && (
            <div style={{ marginTop: 6, fontSize: '0.62rem', color: C.textMuted }}>
              📍 {intel.geoRestrictions}
            </div>
          )}
        </Collapsible>
      )}

      {/* Key dates */}
      {hasDates && (
        <Collapsible title="Key Dates" icon="📅">
          {intel.keyDates!.map((kd, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.65rem', color: C.text }}>{kd.label}</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#f97316' }}>{kd.date}</span>
            </div>
          ))}
          {intel.reportingRequirements && (
            <div style={{ marginTop: 4, fontSize: '0.62rem', color: C.textMuted }}>
              📋 {intel.reportingRequirements}
            </div>
          )}
        </Collapsible>
      )}

      {/* What makes a strong app */}
      {(intel.whatMakesStrong || hasTips) && (
        <Collapsible title="Tips & Insights" icon="💡" defaultOpen>
          {intel.whatMakesStrong && (
            <div style={{
              padding: '8px 10px', borderRadius: 6, marginBottom: 8,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 4 }}>What Makes a Strong App</div>
              <p style={{ fontSize: '0.65rem', color: C.text, margin: 0, lineHeight: 1.5 }}>{intel.whatMakesStrong}</p>
            </div>
          )}
          {hasTips && intel.tips!.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#eab308', fontSize: '0.55rem', marginTop: 2, flexShrink: 0 }}>💡</span>
              <span style={{ fontSize: '0.65rem', color: C.text, lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
          {intel.commonMistakes && intel.commonMistakes.length > 0 && (
            <>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#ef4444', margin: '8px 0 4px', textTransform: 'uppercase' }}>Common Mistakes</div>
              {intel.commonMistakes.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#ef4444', fontSize: '0.55rem', marginTop: 2, flexShrink: 0 }}>⚠</span>
                  <span style={{ fontSize: '0.62rem', color: C.textMuted, lineHeight: 1.4 }}>{m}</span>
                </div>
              ))}
            </>
          )}
        </Collapsible>
      )}

      {/* Past grantees */}
      {hasPastGrantees && (
        <Collapsible title="Past Grantees" icon="🏆">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {intel.pastGrantees!.map((g, i) => <Pill key={i} text={g} color="#22c55e" />)}
          </div>
        </Collapsible>
      )}

      {/* Resources & links */}
      {(hasResources || intel.guidelinesPdfUrl || intel.faqUrl) && (
        <Collapsible title="Resources" icon="📎">
          {intel.guidelinesPdfUrl && (
            <a href={intel.guidelinesPdfUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '0.65rem', color: PURPLE, marginBottom: 6, textDecoration: 'underline' }}>
              📄 Grant Guidelines PDF
            </a>
          )}
          {intel.faqUrl && (
            <a href={intel.faqUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '0.65rem', color: PURPLE, marginBottom: 6, textDecoration: 'underline' }}>
              ❓ FAQ Page
            </a>
          )}
          {intel.webinarUrl && (
            <a href={intel.webinarUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '0.65rem', color: PURPLE, marginBottom: 6, textDecoration: 'underline' }}>
              🎥 Info Webinar
            </a>
          )}
          {hasResources && intel.additionalResources!.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: '0.65rem', color: PURPLE, marginBottom: 6, textDecoration: 'underline' }}>
              🔗 {r.label}
            </a>
          ))}
        </Collapsible>
      )}

      {/* Notes */}
      {intel.notes && (
        <Collapsible title="Notes" icon="📝">
          <p style={{ fontSize: '0.65rem', color: C.textSecondary, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {intel.notes}
          </p>
        </Collapsible>
      )}

      {intel.lastUpdated && (
        <div style={{ padding: '8px 16px', fontSize: '0.55rem', color: C.textMuted, textAlign: 'center' }}>
          Last updated: {intel.lastUpdated}
        </div>
      )}
    </>
  );
}

interface Props {
  grant: GrantOpportunity;
  onQuickAction: (message: string) => void;
}

export default function GrantDetailPanel({ grant, onQuickAction }: Props) {
  const color = stageColor(grant.stage);
  const a = grant.assessment;
  const d = grant.documents;
  const intel = grant.intelligence;

  const quickActions = [
    {
      label: 'Build Intelligence',
      message: grant.url
        ? `Research everything about the ${grant.name} from ${grant.funder}. Find: scoring criteria, funder priorities, evaluation process, eligibility details, key stats (average grant size, acceptance rate, total funding), past grantees, important dates, tips for strong applications, common mistakes, and any supporting documents (guidelines PDF, FAQ, webinars). Be thorough — check the funder's website, annual reports, and any public resources. URL: ${grant.url}`
        : `Research everything about the ${grant.name} from ${grant.funder}. Find scoring criteria, funder priorities, eligibility, key stats, past grantees, tips, and resources.`,
      icon: '🧠',
    },
    {
      label: 'Analyze Grant',
      message: grant.url
        ? `Pull all the details from this grant and give me a full breakdown: ${grant.url}`
        : `Tell me everything you know about the ${grant.name} from ${grant.funder}.`,
      icon: '🔍',
    },
    {
      label: 'Draft EOI',
      message: `Draft an Expression of Interest for the ${grant.name}. Include our organization overview, the problem we're addressing, our proposed approach, and why this funder is the right partner.`,
      icon: '✍️',
    },
    {
      label: 'Build Budget',
      message: `Create a detailed budget for the ${grant.name} application.`,
      icon: '💰',
    },
    {
      label: 'Project Plan',
      message: `Build a project plan for the ${grant.name}. Include a logic model, milestone timeline, and evaluation plan.`,
      icon: '📅',
    },
    {
      label: 'Review Checklist',
      message: `Run the pre-submission checklist for the ${grant.name}. Verify all criteria are met, budget matches narrative, timeline is consistent, all attachments ready.`,
      icon: '☑️',
    },
  ];

  return (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: `1px solid ${C.border}`, background: '#16161e',
      overflowY: 'auto',
    }}>
      {/* Grant header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 12,
          background: `${color}22`, fontSize: '0.62rem', fontWeight: 700,
          color: color, textTransform: 'uppercase', letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          {stageLabel(grant.stage)}
        </div>
        <h3 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
          {grant.name}
        </h3>
        <div style={{ fontSize: '0.72rem', color: C.textMuted }}>{grant.funder}</div>
      </div>

      {/* Key details */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
        {grant.amount && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Amount</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#22c55e' }}>{grant.amount}</div>
          </div>
        )}
        {grant.deadline && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>Deadline</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f97316' }}>{grant.deadline}</div>
          </div>
        )}
        {grant.url && (
          <a href={grant.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.68rem', color: PURPLE, textDecoration: 'underline' }}>
            View grant page →
          </a>
        )}
      </div>

      {/* Intelligence Brief */}
      {intel && <IntelligenceBrief intel={intel} grantName={grant.name} />}

      {/* Assessment */}
      {a && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <SectionHeader title="Assessment" icon="📋" />
          <ScoreBar label="Mission Alignment" score={a.missionAlignment} />
          <ScoreBar label="Competitiveness" score={a.competitiveness} />
          <ScoreBar label="Effort-to-Reward" score={a.effortToReward} />
          <ScoreBar label="Strategic Value" score={a.strategicValue} />
          <ScoreBar label="Capacity" score={a.capacity} />
          {a.recommendation && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: a.recommendation === 'pursue' ? 'rgba(34,197,94,0.12)' :
                a.recommendation === 'maybe' ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)',
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
              color: a.recommendation === 'pursue' ? '#22c55e' :
                a.recommendation === 'maybe' ? '#eab308' : '#ef4444',
              textAlign: 'center', letterSpacing: '0.05em',
            }}>
              {a.recommendation}
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {d && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <SectionHeader title="Documents" icon="📄" />
          <DocRow label="Opportunity Brief" exists={d.opportunity} />
          <DocRow label="Narrative Draft" exists={d.narrative} />
          <DocRow label="Budget" exists={d.budget} />
          <DocRow label="Project Plan" exists={d.projectPlan} />
        </div>
      )}

      {/* Quick actions */}
      <div style={{ padding: '12px 16px' }}>
        <SectionHeader title="Quick Actions" icon="⚡" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => onQuickAction(action.message)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', width: '100%', textAlign: 'left',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                background: 'transparent', color: C.textSecondary,
                fontSize: '0.72rem', fontFamily: 'inherit',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textSecondary; }}
            >
              <span style={{ fontSize: '0.85rem' }}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
