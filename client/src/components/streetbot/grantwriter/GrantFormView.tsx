import React, { useState, useCallback, useRef } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { sbFetch } from '../shared/sbFetch';
import type { GrantSection, GrantQuestion } from './grantSections';
import { countFilled, sectionsToPrompt, orgProfileToContext } from './grantSections';
import BudgetBuilder, { DEFAULT_ROWS as DEFAULT_BUDGET_ROWS } from './BudgetBuilder';
import type { BudgetRow } from './BudgetBuilder';
import ProjectPlanBuilder, { DEFAULT_PLAN_ROWS } from './ProjectPlanBuilder';
import type { ProjectPlanRow } from './ProjectPlanBuilder';
import type { GrantIntelligence } from './grantTypes';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

// ── Question Field Component ──

function wordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function QuestionField({ question, onChange }: {
  question: GrantQuestion;
  onChange: (value: string) => void;
}) {
  const wc = wordCount(question.answer);
  const overLimit = question.wordLimit && wc > question.wordLimit;
  const nearLimit = question.wordLimit && wc > question.wordLimit * 0.9;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: question.answer ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${overLimit ? 'rgba(239,68,68,0.5)' : question.answer ? 'rgba(139,92,246,0.2)' : C.border}`,
    color: C.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.text }}>
          {question.label}
          {question.required && <span style={{ color: PURPLE, marginLeft: 3 }}>*</span>}
        </label>
        {/* Word count badge */}
        {question.type === 'long' && question.answer.trim() && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 600, fontFamily: 'monospace',
            padding: '1px 6px', borderRadius: 8,
            color: overLimit ? '#ef4444' : nearLimit ? '#eab308' : C.textMuted,
            background: overLimit ? 'rgba(239,68,68,0.12)' : nearLimit ? 'rgba(234,179,8,0.1)' : 'transparent',
          }}>
            {wc}{question.wordLimit ? ` / ${question.wordLimit}` : ''} words
          </span>
        )}
      </div>
      {question.hint && (
        <div style={{ fontSize: '0.65rem', color: C.textMuted, marginBottom: 5 }}>
          {question.hint}
          {question.wordLimit && !question.hint.includes('word') && (
            <span style={{ color: C.textMuted }}> · Max {question.wordLimit} words</span>
          )}
        </div>
      )}
      {!question.hint && question.wordLimit && (
        <div style={{ fontSize: '0.65rem', color: C.textMuted, marginBottom: 5 }}>Max {question.wordLimit} words</div>
      )}

      {question.type === 'select' && question.options ? (
        <select
          value={question.answer}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="" style={{ background: '#1a1a24', color: C.textMuted }}>Select...</option>
          {question.options.map(opt => (
            <option key={opt} value={opt} style={{ background: '#1a1a24', color: C.text }}>{opt}</option>
          ))}
        </select>
      ) : question.type === 'long' ? (
        <textarea
          value={question.answer}
          onChange={e => onChange(e.target.value)}
          rows={4}
          placeholder="..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type="text"
          value={question.answer}
          onChange={e => onChange(e.target.value)}
          placeholder="..."
          style={inputStyle}
        />
      )}
    </div>
  );
}

// ── Main Form View ──

interface Props {
  sections: GrantSection[];
  onUpdateAnswer: (sectionId: string, questionId: string, value: string) => void;
  onUpdateSections: (sections: GrantSection[]) => void;
  grantName: string;
  budgetRows: BudgetRow[];
  onBudgetChange: (rows: BudgetRow[]) => void;
  projectPlanRows: ProjectPlanRow[];
  onProjectPlanChange: (rows: ProjectPlanRow[]) => void;
  intelligence?: GrantIntelligence;
}

// Extra "virtual" tabs for budget and project plan
const EXTRA_TABS = [
  { id: '_intelligence', title: 'Grant Intel', icon: '🧠', part: 'grant' as const },
  { id: '_budget', title: 'Budget', icon: '📊', part: 'grant' as const },
  { id: '_project_plan', title: 'Project Plan', icon: '📅', part: 'grant' as const },
];

// ── Intelligence Page Component ──
function IntelligencePage({ intel, grantName }: { intel: GrantIntelligence; grantName: string }) {
  const PURPLE = '#8b5cf6';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
        🧠 Grant Intelligence Brief
      </h2>
      <p style={{ fontSize: '0.75rem', color: C.textMuted, margin: '0 0 24px' }}>
        Everything you need to know to write a winning {grantName} application.
      </p>

      {/* Funder Mission & Priorities */}
      {(intel.funderMission || intel.funderPriorities) && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22c55e', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            🎯 Funder Priorities
          </h3>
          {intel.funderMission && (
            <p style={{ fontSize: '0.8rem', color: C.textSecondary, margin: '0 0 12px', lineHeight: 1.6, padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', borderLeft: '3px solid #22c55e' }}>
              {intel.funderMission}
            </p>
          )}
          {intel.funderPriorities && (
            <div style={{ display: 'grid', gap: 8 }}>
              {intel.funderPriorities.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ color: '#22c55e', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>●</span>
                  <span style={{ fontSize: '0.78rem', color: C.text, lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scoring Criteria */}
      {intel.scoringCriteria && intel.scoringCriteria.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eab308', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 Scoring Criteria
          </h3>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 2fr', padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${C.border}`, fontSize: '0.62rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>
              <span>Criterion</span>
              <span>Weight</span>
              <span>Description</span>
            </div>
            {intel.scoringCriteria.map((sc, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 2fr', padding: '10px 14px', borderBottom: i < intel.scoringCriteria!.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: C.text }}>{sc.criterion}</span>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.6rem', fontWeight: 700,
                  background: sc.weight === 'High' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                  color: sc.weight === 'High' ? '#ef4444' : '#eab308',
                  width: 'fit-content',
                }}>
                  {sc.weight}
                </span>
                <span style={{ fontSize: '0.72rem', color: C.textMuted, lineHeight: 1.4 }}>{sc.description}</span>
              </div>
            ))}
          </div>
          {intel.evaluationProcess && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid ' + PURPLE }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: PURPLE, textTransform: 'uppercase' }}>Review Process: </span>
              <span style={{ fontSize: '0.72rem', color: C.textSecondary, lineHeight: 1.5 }}>{intel.evaluationProcess}</span>
            </div>
          )}
        </div>
      )}

      {/* Two-column layout for stats and dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Key Stats */}
        {(intel.averageGrantSize || intel.acceptanceRate || intel.totalFunding) && (
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: PURPLE, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📈 Key Stats
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {intel.averageGrantSize && (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Average Grant Size</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#22c55e' }}>{intel.averageGrantSize}</div>
                </div>
              )}
              {intel.acceptanceRate && (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
                  <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Acceptance Rate</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#eab308' }}>{intel.acceptanceRate}</div>
                </div>
              )}
              {intel.totalFunding && (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <div style={{ fontSize: '0.6rem', color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Total Annual Funding</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: PURPLE }}>{intel.totalFunding}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Dates */}
        {intel.keyDates && intel.keyDates.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f97316', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              📅 Key Dates
            </h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {intel.keyDates.map((kd, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: C.text, fontWeight: 500 }}>{kd.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f97316' }}>{kd.date}</span>
                </div>
              ))}
            </div>
            {intel.reportingRequirements && (
              <div style={{ marginTop: 8, fontSize: '0.68rem', color: C.textMuted, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                📋 {intel.reportingRequirements}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Eligibility — two columns */}
      {(intel.eligibilityRequirements || intel.ineligible) && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✅ Eligibility
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {intel.eligibilityRequirements && (
              <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 10 }}>Requirements</div>
                {intel.eligibilityRequirements.map((req, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: '#22c55e', fontSize: '0.65rem', marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '0.72rem', color: C.text, lineHeight: 1.5 }}>{req}</span>
                  </div>
                ))}
                {intel.geoRestrictions && (
                  <div style={{ marginTop: 8, fontSize: '0.68rem', color: C.textMuted }}>📍 {intel.geoRestrictions}</div>
                )}
              </div>
            )}
            {intel.ineligible && (
              <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: 10 }}>Not Eligible</div>
                {intel.ineligible.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2, flexShrink: 0 }}>✗</span>
                    <span style={{ fontSize: '0.72rem', color: C.textMuted, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips & What Makes Strong */}
      {(intel.whatMakesStrong || intel.tips || intel.commonMistakes) && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eab308', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            💡 Tips & Insights
          </h3>
          {intel.whatMakesStrong && (
            <div style={{ padding: '14px 16px', borderRadius: 10, marginBottom: 14, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 6 }}>What Makes a Strong Application</div>
              <p style={{ fontSize: '0.78rem', color: C.text, margin: 0, lineHeight: 1.6 }}>{intel.whatMakesStrong}</p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: intel.commonMistakes ? '1fr 1fr' : '1fr', gap: 16 }}>
            {intel.tips && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#eab308', textTransform: 'uppercase', marginBottom: 8 }}>Pro Tips</div>
                {intel.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(234,179,8,0.04)' }}>
                    <span style={{ color: '#eab308', fontSize: '0.65rem', marginTop: 2, flexShrink: 0 }}>💡</span>
                    <span style={{ fontSize: '0.72rem', color: C.text, lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            )}
            {intel.commonMistakes && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: 8 }}>Common Mistakes</div>
                {intel.commonMistakes.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.04)' }}>
                    <span style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 2, flexShrink: 0 }}>⚠</span>
                    <span style={{ fontSize: '0.72rem', color: C.textMuted, lineHeight: 1.5 }}>{m}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resources */}
      {(intel.guidelinesPdfUrl || intel.faqUrl || intel.webinarUrl || intel.additionalResources) && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: PURPLE, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            📎 Resources & Links
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {intel.guidelinesPdfUrl && (
              <a href={intel.guidelinesPdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: PURPLE, fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(139,92,246,0.15)' }}>
                📄 Grant Guidelines
              </a>
            )}
            {intel.faqUrl && (
              <a href={intel.faqUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: PURPLE, fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(139,92,246,0.15)' }}>
                ❓ FAQ
              </a>
            )}
            {intel.webinarUrl && (
              <a href={intel.webinarUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: PURPLE, fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(139,92,246,0.15)' }}>
                🎥 Info Webinar
              </a>
            )}
            {intel.additionalResources?.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.08)', color: PURPLE, fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(139,92,246,0.15)' }}>
                🔗 {r.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {intel.lastUpdated && (
        <div style={{ fontSize: '0.62rem', color: C.textMuted, marginTop: 20 }}>
          Last updated: {intel.lastUpdated}
        </div>
      )}
    </div>
  );
}

export default function GrantFormView({ sections, onUpdateAnswer, onUpdateSections, grantName, budgetRows, onBudgetChange, projectPlanRows, onProjectPlanChange, intelligence }: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const section = sections[currentPage];
  const { filled, total } = countFilled(sections);
  const progressPct = total > 0 ? Math.round((filled / total) * 100) : 0;

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    setActiveTab(null);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  const goToTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  // Generate answers for the current section using the Grant Manager
  const generateSectionAnswers = useCallback(async (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    setIsGenerating(true);
    setGeneratingSection(sectionId);
    const controller = new AbortController();
    controllerRef.current = controller;

    // Build the prompt
    const unanswered = sec.questions.filter(q => !q.answer.trim());
    if (unanswered.length === 0) {
      setIsGenerating(false);
      setGeneratingSection(null);
      return;
    }

    const orgContext = orgProfileToContext();
    const existingContext = sectionsToPrompt(sections);
    const questionsText = unanswered.map(q => {
      const hint = q.hint ? ` (Hint: ${q.hint})` : '';
      const opts = q.options ? ` Options: ${q.options.join(', ')}` : '';
      const limit = q.wordLimit ? ` [WORD LIMIT: ${q.wordLimit} words max]` : '';
      return `- ${q.label}${hint}${opts}${limit}`;
    }).join('\n');

    const prompt = `I'm filling out the "${sec.title}" section of the ${grantName} grant application.

${orgContext}

Here's what we've filled in so far for this grant:
${existingContext}

Please provide answers for these unanswered questions in the "${sec.title}" section:
${questionsText}

Use our organization profile above to inform your answers. Make sure answers are specific to our org and aligned with what this grant is looking for.

CRITICAL RULES:
- For questions with a WORD LIMIT, you MUST stay within that word count. Count your words carefully.
- For "select" type questions, use one of the provided options exactly as written.
- For "long" answers without a word limit, write 2-4 detailed sentences.
- For "short" answers, keep it brief (a few words or one sentence).

Respond with ONLY a JSON object where keys are the question labels (exactly as shown) and values are the answers.

Example format:
{"Project Name": "Street Voices Youth Media Lab", "Scaling Approach": "Expand Reach — extend program to serve additional youth"}`;

    try {
      const resp = await sbFetch('/sbapi/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'agent/grant_manager',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      if (!resp.body) throw new Error('No stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const line = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') break;
            try {
              const chunk = JSON.parse(jsonStr);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
            } catch { /* skip */ }
          }
          boundary = buffer.indexOf('\n');
        }
      }
      reader.releaseLock();

      // Parse the JSON response — find the JSON object in the response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const answers = JSON.parse(jsonMatch[0]);
          // Match answers to questions by label
          const updatedSections = sections.map(s => {
            if (s.id !== sectionId) return s;
            return {
              ...s,
              questions: s.questions.map(q => {
                if (q.answer.trim()) return q; // Don't overwrite existing answers
                const answerKey = Object.keys(answers).find(k =>
                  k.toLowerCase().includes(q.label.toLowerCase().slice(0, 20)) ||
                  q.label.toLowerCase().includes(k.toLowerCase().slice(0, 20))
                );
                if (answerKey && answers[answerKey]) {
                  return { ...q, answer: String(answers[answerKey]) };
                }
                return q;
              }),
            };
          });
          onUpdateSections(updatedSections);
        } catch (e) {
          console.error('Failed to parse AI answers:', e);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('Generation failed:', err);
      }
    } finally {
      setIsGenerating(false);
      setGeneratingSection(null);
      controllerRef.current = null;
    }
  }, [sections, grantName, onUpdateSections]);

  // Generate ALL sections
  const generateAll = useCallback(async () => {
    for (let i = 0; i < sections.length; i++) {
      setCurrentPage(i);
      await generateSectionAnswers(sections[i].id);
    }
  }, [sections, generateSectionAnswers]);

  if (!section) return null;

  const sectionFilled = section.questions.filter(q => q.answer.trim()).length;
  const sectionTotal = section.questions.length;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 300, overflow: 'hidden',
    }}>
      {/* Header with progress */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.8))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem',
        }}>
          {section.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>
            {grantName}
          </div>
          <div style={{ fontSize: '0.62rem', color: C.textMuted }}>
            {filled}/{total} questions answered · {progressPct}% complete
          </div>
        </div>
        <button
          onClick={generateAll}
          disabled={isGenerating}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: isGenerating ? 'rgba(139,92,246,0.2)' : PURPLE,
            color: '#fff', fontSize: '0.72rem', fontWeight: 700,
            cursor: isGenerating ? 'default' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {isGenerating ? (
            <>
              <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
              Generating...
            </>
          ) : (
            <>✨ Auto-Fill All</>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', background: `linear-gradient(90deg, ${PURPLE}, #22c55e)`,
          width: `${progressPct}%`, transition: 'width 0.3s',
        }} />
      </div>

      {/* Page navigation tabs — with Part 1 / Part 2 labels */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
        overflowX: 'auto', flexShrink: 0, alignItems: 'stretch',
      }}>
        {sections.map((s, idx) => {
          const isCurrent = idx === currentPage;
          const sFilled = s.questions.filter(q => q.answer.trim()).length;
          const sTotal = s.questions.length;
          const isComplete = sFilled === sTotal;

          return (
            <React.Fragment key={s.id}>
              <button
                onClick={() => goToPage(idx)}
                style={{
                  padding: '8px 10px', border: 'none', cursor: 'pointer',
                  background: isCurrent ? 'rgba(139,92,246,0.08)' : 'transparent',
                  borderBottom: isCurrent ? `2px solid ${PURPLE}` : '2px solid transparent',
                  color: isCurrent ? C.text : C.textMuted,
                  fontSize: '0.62rem', fontWeight: isCurrent ? 700 : 500,
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: '0.7rem' }}>{s.icon}</span>
                <span>{s.title.length > 14 ? s.title.slice(0, 12) + '…' : s.title}</span>
                {isComplete && <span style={{ color: '#22c55e', fontSize: '0.65rem' }}>✓</span>}
                {!isComplete && sFilled > 0 && (
                  <span style={{ fontSize: '0.5rem', color: C.textMuted }}>{sFilled}/{sTotal}</span>
                )}
              </button>
            </React.Fragment>
          );
        })}

        {/* Divider */}
        <div style={{ width: 1, background: C.border, margin: '6px 0', flexShrink: 0 }} />

        {/* Budget & Project Plan tabs */}
        {EXTRA_TABS.map(tab => {
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => goToTab(tab.id)}
              style={{
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: isCurrent ? 'rgba(34,197,94,0.08)' : 'transparent',
                borderBottom: isCurrent ? '2px solid #22c55e' : '2px solid transparent',
                color: isCurrent ? C.text : C.textMuted,
                fontSize: '0.62rem', fontWeight: isCurrent ? 700 : 500,
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: '0.7rem' }}>{tab.icon}</span>
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* Content area — section form, budget builder, project plan, or intelligence */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>

      {/* Intelligence brief */}
      {activeTab === '_intelligence' && intelligence && (
        <IntelligencePage intel={intelligence} grantName={grantName} />
      )}
      {activeTab === '_intelligence' && !intelligence && (
        <div style={{ padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🧠</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, marginBottom: 6 }}>No Intelligence Data Yet</div>
          <div style={{ fontSize: '0.72rem', color: C.textMuted }}>
            Click "Build Intelligence" in the Quick Actions panel to have the Grant Manager research this grant.
          </div>
        </div>
      )}

      {/* Budget spreadsheet */}
      {activeTab === '_budget' && (
        <BudgetBuilder rows={budgetRows} onChange={onBudgetChange} />
      )}

      {/* Project plan table */}
      {activeTab === '_project_plan' && (
        <ProjectPlanBuilder rows={projectPlanRows} onChange={onProjectPlanChange} />
      )}

      {/* Section form content */}
      {!activeTab && (
      <div style={{ padding: '20px 24px' }}>
        {/* Section header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '1.2rem' }}>{section.icon}</span>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.text }}>
              {section.title}
            </h2>
            <span style={{ fontSize: '0.65rem', color: C.textMuted, marginLeft: 'auto' }}>
              {sectionFilled}/{sectionTotal} answered
            </span>
          </div>
          {section.description && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: C.textMuted }}>{section.description}</p>
          )}

          {/* Generate this section button */}
          <button
            onClick={() => generateSectionAnswers(section.id)}
            disabled={isGenerating}
            style={{
              marginTop: 10, padding: '6px 14px', borderRadius: 8,
              background: 'rgba(139,92,246,0.1)', border: `1px dashed rgba(139,92,246,0.3)`,
              color: PURPLE, fontSize: '0.72rem', fontWeight: 600,
              cursor: isGenerating ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {generatingSection === section.id ? (
              <>
                <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
                AI is writing answers...
              </>
            ) : (
              <>✨ Auto-Fill This Section</>
            )}
          </button>
        </div>

        {/* Questions */}
        {section.questions.map(q => (
          <QuestionField
            key={q.id}
            question={q}
            onChange={value => onUpdateAnswer(section.id, q.id, value)}
          />
        ))}
      </div>
      )}
      </div>

      {/* Bottom pagination — works across section pages AND extra tabs */}
      {(() => {
        const allSteps = [
          ...sections.map((_s, i) => ({ type: 'section' as const, idx: i, id: _s.id })),
          ...EXTRA_TABS.map(t => ({ type: 'tab' as const, idx: -1, id: t.id })),
        ];
        const curIdx = activeTab
          ? allSteps.findIndex(s => s.type === 'tab' && s.id === activeTab)
          : allSteps.findIndex(s => s.type === 'section' && s.idx === currentPage);
        const isFirst = curIdx <= 0;
        const isLast = curIdx >= allSteps.length - 1;
        const goNext = () => { if (isLast) return; const n = allSteps[curIdx + 1]; n.type === 'section' ? goToPage(n.idx) : goToTab(n.id); };
        const goPrev = () => { if (isFirst) return; const p = allSteps[curIdx - 1]; p.type === 'section' ? goToPage(p.idx) : goToTab(p.id); };

        return (
          <div style={{
            padding: '10px 20px', borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <button
              onClick={goPrev}
              disabled={isFirst}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: isFirst ? 'transparent' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isFirst ? 'transparent' : C.border}`,
                color: isFirst ? C.textMuted : C.text,
                fontSize: '0.78rem', fontWeight: 600, cursor: isFirst ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.72rem', color: C.textMuted }}>
              Page {curIdx + 1} of {allSteps.length}
            </span>
            <button
              onClick={goNext}
              disabled={isLast}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: isLast ? 'transparent' : PURPLE,
                border: 'none',
                color: isLast ? C.textMuted : '#fff',
                fontSize: '0.78rem', fontWeight: 600,
                cursor: isLast ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Next →
            </button>
          </div>
        );
      })()}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
