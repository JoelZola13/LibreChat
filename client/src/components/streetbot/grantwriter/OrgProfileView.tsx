import React, { useState, useCallback, useRef } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { sbFetch } from '../shared/sbFetch';
import type { GrantSection, GrantQuestion } from './grantSections';
import { countFilled, sectionsToPrompt } from './grantSections';

const C = DEFAULT_COLORS;
const BLUE = '#3b82f6';

function QuestionField({ question, onChange }: {
  question: GrantQuestion;
  onChange: (value: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: question.answer ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${question.answer ? 'rgba(59,130,246,0.2)' : C.border}`,
    color: C.text, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: C.text, marginBottom: 5 }}>
        {question.label}
        {question.required && <span style={{ color: BLUE, marginLeft: 3 }}>*</span>}
      </label>
      {question.hint && (
        <div style={{ fontSize: '0.65rem', color: C.textMuted, marginBottom: 5 }}>{question.hint}</div>
      )}
      {question.type === 'select' && question.options ? (
        <select value={question.answer} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="" style={{ background: '#1a1a24', color: C.textMuted }}>Select...</option>
          {question.options.map(opt => (
            <option key={opt} value={opt} style={{ background: '#1a1a24', color: C.text }}>{opt}</option>
          ))}
        </select>
      ) : question.type === 'long' ? (
        <textarea value={question.answer} onChange={e => onChange(e.target.value)} rows={4} placeholder="..." style={{ ...inputStyle, resize: 'vertical' }} />
      ) : (
        <input type="text" value={question.answer} onChange={e => onChange(e.target.value)} placeholder="..." style={inputStyle} />
      )}
    </div>
  );
}

interface Props {
  sections: GrantSection[];
  onUpdateAnswer: (sectionId: string, questionId: string, value: string) => void;
  onUpdateSections: (sections: GrantSection[]) => void;
}

export default function OrgProfileView({ sections, onUpdateAnswer, onUpdateSections }: Props) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const section = sections[currentPage];
  const { filled, total } = countFilled(sections);
  const progressPct = total > 0 ? Math.round((filled / total) * 100) : 0;

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  const generateSectionAnswers = useCallback(async (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    const unanswered = sec.questions.filter(q => !q.answer.trim());
    if (unanswered.length === 0) return;

    setIsGenerating(true);
    setGeneratingSection(sectionId);
    const controller = new AbortController();
    controllerRef.current = controller;

    const existingContext = sectionsToPrompt(sections);
    const questionsText = unanswered.map(q => {
      const hint = q.hint ? ` (Hint: ${q.hint})` : '';
      const opts = q.options ? ` Options: ${q.options.join(', ')}` : '';
      return `- ${q.label}${hint}${opts}`;
    }).join('\n');

    const prompt = `I'm building the organization profile for Street Voices, a community-focused creative/media organization based in Toronto, Ontario that works with youth.

Here's what we've filled in so far:
${existingContext}

Please provide answers for these unanswered questions in the "${sec.title}" section:
${questionsText}

Use what you know about Street Voices from our files and previous conversations. Write as if you are Street Voices describing yourself to a grant funder. Be specific, authentic, and compelling.

IMPORTANT: Respond with ONLY a JSON object where keys are the question labels (exactly as shown) and values are the answers. For "select" type questions, use one of the provided options exactly. For "long" answers, write 2-4 detailed sentences. For "short" answers, keep it brief.`;

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

      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const answers = JSON.parse(jsonMatch[0]);
          const updatedSections = sections.map(s => {
            if (s.id !== sectionId) return s;
            return {
              ...s,
              questions: s.questions.map(q => {
                if (q.answer.trim()) return q;
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
  }, [sections, onUpdateSections]);

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
      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${BLUE}, #2563eb)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem',
        }}>🏢</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>
            Organization Profile
          </div>
          <div style={{ fontSize: '0.62rem', color: C.textMuted }}>
            {filled}/{total} fields completed · {progressPct}% — this info is used across all grants
          </div>
        </div>
        <button
          onClick={generateAll}
          disabled={isGenerating}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: isGenerating ? 'rgba(59,130,246,0.2)' : BLUE,
            color: '#fff', fontSize: '0.72rem', fontWeight: 700,
            cursor: isGenerating ? 'default' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {isGenerating ? (
            <><span style={{ animation: 'pulse 1.5s infinite' }}>●</span> Generating...</>
          ) : (
            <>✨ Auto-Fill All</>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', background: `linear-gradient(90deg, ${BLUE}, #22c55e)`,
          width: `${progressPct}%`, transition: 'width 0.3s',
        }} />
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
        overflowX: 'auto', flexShrink: 0,
      }}>
        {sections.map((s, idx) => {
          const isCurrent = idx === currentPage;
          const sFilled = s.questions.filter(q => q.answer.trim()).length;
          const sTotal = s.questions.length;
          const isComplete = sFilled === sTotal;
          return (
            <button
              key={s.id}
              onClick={() => goToPage(idx)}
              style={{
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: isCurrent ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderBottom: isCurrent ? `2px solid ${BLUE}` : '2px solid transparent',
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
          );
        })}
      </div>

      {/* Section content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '1.2rem' }}>{section.icon}</span>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.text }}>{section.title}</h2>
            <span style={{ fontSize: '0.65rem', color: C.textMuted, marginLeft: 'auto' }}>{sectionFilled}/{sectionTotal} answered</span>
          </div>
          {section.description && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: C.textMuted }}>{section.description}</p>
          )}
          <button
            onClick={() => generateSectionAnswers(section.id)}
            disabled={isGenerating}
            style={{
              marginTop: 10, padding: '6px 14px', borderRadius: 8,
              background: 'rgba(59,130,246,0.1)', border: `1px dashed rgba(59,130,246,0.3)`,
              color: BLUE, fontSize: '0.72rem', fontWeight: 600,
              cursor: isGenerating ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {generatingSection === section.id ? (
              <><span style={{ animation: 'pulse 1.5s infinite' }}>●</span> AI is writing...</>
            ) : (
              <>✨ Auto-Fill This Section</>
            )}
          </button>
        </div>

        {section.questions.map(q => (
          <QuestionField key={q.id} question={q} onChange={value => onUpdateAnswer(section.id, q.id, value)} />
        ))}
      </div>

      {/* Pagination */}
      <div style={{
        padding: '10px 20px', borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: currentPage === 0 ? 'transparent' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${currentPage === 0 ? 'transparent' : C.border}`,
            color: currentPage === 0 ? C.textMuted : C.text,
            fontSize: '0.78rem', fontWeight: 600, cursor: currentPage === 0 ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >← Previous</button>
        <span style={{ fontSize: '0.72rem', color: C.textMuted }}>Page {currentPage + 1} of {sections.length}</span>
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === sections.length - 1}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: currentPage === sections.length - 1 ? 'transparent' : BLUE,
            border: 'none',
            color: currentPage === sections.length - 1 ? C.textMuted : '#fff',
            fontSize: '0.78rem', fontWeight: 600,
            cursor: currentPage === sections.length - 1 ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >Next →</button>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
