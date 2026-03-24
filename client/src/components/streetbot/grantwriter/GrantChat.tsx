import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import type { ChatMessage } from './grantTypes';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

// Simple markdown renderer — handles headers, bold, italic, lists, code blocks, links
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '12px 16px',
            fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto',
            margin: '8px 0', color: '#e2e8f0', border: `1px solid ${C.border}`,
          }}>
            {codeBlockLang && <div style={{ fontSize: '0.65rem', color: C.textMuted, marginBottom: 6 }}>{codeBlockLang}</div>}
            <code>{codeBlockContent.trimEnd()}</code>
          </pre>
        );
        codeBlockContent = '';
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} style={{ fontSize: '0.9rem', fontWeight: 700, color: C.text, margin: '14px 0 6px' }}>{inlineFormat(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} style={{ fontSize: '1rem', fontWeight: 700, color: C.text, margin: '16px 0 8px' }}>{inlineFormat(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, margin: '18px 0 8px' }}>{inlineFormat(line.slice(2))}</h2>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '12px 0' }} />);
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 4 }}>
          <span style={{ color: PURPLE, flexShrink: 0 }}>•</span>
          <span style={{ flex: 1 }}>{inlineFormat(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 4 }}>
          <span style={{ color: PURPLE, flexShrink: 0, fontWeight: 600, minWidth: 18 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1 }}>{inlineFormat(line.slice(numMatch[0].length))}</span>
        </div>
      );
      continue;
    }

    // Empty line = paragraph break
    if (!line.trim()) {
      elements.push(<div key={i} style={{ height: 8 }} />);
      continue;
    }

    // Normal paragraph
    elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.6 }}>{inlineFormat(line)}</p>);
  }

  return elements;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold, italic, inline code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code `text`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Link [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Find the earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, idx: remaining.indexOf(boldMatch[0]) } : null,
      codeMatch ? { type: 'code', match: codeMatch, idx: remaining.indexOf(codeMatch[0]) } : null,
      linkMatch ? { type: 'link', match: linkMatch, idx: remaining.indexOf(linkMatch[0]) } : null,
    ].filter(Boolean).sort((a, b) => a!.idx - b!.idx);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    if (first.idx > 0) {
      parts.push(remaining.slice(0, first.idx));
    }

    if (first.type === 'bold') {
      parts.push(<strong key={keyIdx++} style={{ fontWeight: 700, color: C.text }}>{first.match![1]}</strong>);
    } else if (first.type === 'code') {
      parts.push(<code key={keyIdx++} style={{ background: 'rgba(139,92,246,0.15)', padding: '1px 5px', borderRadius: 3, fontSize: '0.85em', fontFamily: 'monospace' }}>{first.match![1]}</code>);
    } else if (first.type === 'link') {
      parts.push(<a key={keyIdx++} href={first.match![2]} target="_blank" rel="noopener noreferrer" style={{ color: PURPLE, textDecoration: 'underline' }}>{first.match![1]}</a>);
    }

    remaining = remaining.slice(first.idx + first.match![0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

// ── Tool call progress chip ──
function ToolChip({ text }: { text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem',
      background: 'rgba(139,92,246,0.1)', border: `1px solid rgba(139,92,246,0.2)`,
      color: PURPLE, fontFamily: 'monospace', margin: '2px 4px 2px 0',
    }}>
      <span style={{ fontSize: '0.8rem' }}>🔧</span>
      {text}
    </div>
  );
}

// ── Main Chat Component ──

interface GrantChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  grantName?: string;
}

export default function GrantChat({ messages, isStreaming, onSend, onCancel, grantName }: GrantChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Intake form state
  const [showForm, setShowForm] = useState(true);
  const [formData, setFormData] = useState({
    grantUrl: '',
    grantGuidelines: '',
    organizationName: 'Street Voices',
    organizationMission: '',
    grantQuestions: '',
  });

  const handleFormSubmit = useCallback(() => {
    const parts: string[] = [];
    parts.push('I need help with a grant application. Here\'s the information:\n');

    if (formData.grantUrl.trim()) {
      parts.push(`**Grant URL:** ${formData.grantUrl.trim()}`);
      parts.push(`First, pull all the details from this grant page and give me a full breakdown.\n`);
    }

    if (formData.grantGuidelines.trim()) {
      parts.push(`**Grant Guidelines:**\n${formData.grantGuidelines.trim()}\n`);
    }

    if (formData.organizationName.trim()) {
      parts.push(`**Organization:** ${formData.organizationName.trim()}`);
    }

    if (formData.organizationMission.trim()) {
      parts.push(`**Our Mission & Experience:**\n${formData.organizationMission.trim()}\n`);
    }

    if (formData.grantQuestions.trim()) {
      parts.push(`**Grant Questions We Need to Answer:**\n${formData.grantQuestions.trim()}\n`);
    }

    parts.push('\nAnalyze this grant opportunity for us. Assess our fit, identify what we need to prepare, and recommend next steps.');

    onSend(parts.join('\n'));
    setShowForm(false);
  }, [formData, onSend]);

  const updateForm = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages[messages.length - 1]?.content]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, []);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 300, overflow: 'hidden',
    }}>
      {/* Chat header */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.8))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem',
        }}>
          📋
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>
            Grant Manager
          </div>
          <div style={{ fontSize: '0.65rem', color: C.textMuted }}>
            {grantName ? `Working on: ${grantName}` : 'Ready to research and write grants'}
          </div>
        </div>
        {isStreaming && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.7rem', color: PURPLE,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: PURPLE,
              animation: 'pulse 1.5s infinite',
            }} />
            Thinking...
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Intake form — shows before first message */}
        {messages.length === 0 && showForm && (
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0 4px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {/* Form header */}
            <div style={{ textAlign: 'center', padding: '8px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text }}>Grant Application Intake</div>
              <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: 4 }}>
                Fill in what you have — the Grant Manager will handle the rest.
              </div>
            </div>

            {/* Grant URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.text, marginBottom: 5 }}>
                Grant URL
              </label>
              <input
                type="url"
                value={formData.grantUrl}
                onChange={e => updateForm('grantUrl', e.target.value)}
                placeholder="https://otf.ca/our-grants/..."
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <div style={{ fontSize: '0.62rem', color: C.textMuted, marginTop: 3 }}>
                The agent will fetch and analyze the full grant page.
              </div>
            </div>

            {/* Grant Guidelines */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.text, marginBottom: 5 }}>
                Grant Guidelines / Criteria
              </label>
              <textarea
                value={formData.grantGuidelines}
                onChange={e => updateForm('grantGuidelines', e.target.value)}
                placeholder="Paste eligibility criteria, scoring rubric, or key requirements here..."
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Org Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.text, marginBottom: 5 }}>
                Organization Name
              </label>
              <input
                type="text"
                value={formData.organizationName}
                onChange={e => updateForm('organizationName', e.target.value)}
                placeholder="Your organization name"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>

            {/* Org Mission */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.text, marginBottom: 5 }}>
                Organization Mission & Relevant Experience
              </label>
              <textarea
                value={formData.organizationMission}
                onChange={e => updateForm('organizationMission', e.target.value)}
                placeholder="Describe your mission, track record, and relevant programs..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Grant Questions */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.text, marginBottom: 5 }}>
                Grant Questions <span style={{ fontWeight: 400, color: C.textMuted }}>(one per line)</span>
              </label>
              <textarea
                value={formData.grantQuestions}
                onChange={e => updateForm('grantQuestions', e.target.value)}
                placeholder={"What systemic barriers does your project address?\nHow will you measure impact?\nDescribe your scaling strategy..."}
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
              <button
                onClick={handleFormSubmit}
                disabled={!formData.grantUrl.trim() && !formData.grantGuidelines.trim()}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: (formData.grantUrl.trim() || formData.grantGuidelines.trim())
                    ? `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.9))`
                    : 'rgba(139,92,246,0.2)',
                  color: '#fff', fontSize: '0.85rem', fontWeight: 700,
                  cursor: (formData.grantUrl.trim() || formData.grantGuidelines.trim()) ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  boxShadow: (formData.grantUrl.trim() || formData.grantGuidelines.trim())
                    ? '0 4px 14px rgba(139,92,246,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                ✨ Generate Grant Proposal
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.textMuted, fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Empty state when form is skipped */}
        {messages.length === 0 && !showForm && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12, color: C.textMuted,
          }}>
            <div style={{ fontSize: '2rem' }}>📋</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Chat with the Grant Manager</div>
            <div style={{ fontSize: '0.78rem', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
              Ask anything — paste a URL, request a draft, or discuss strategy.
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 12,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.8))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700, color: '#fff',
            }}>
              {msg.role === 'user' ? 'J' : 'GM'}
            </div>

            {/* Content */}
            <div style={{
              maxWidth: '80%', minWidth: 0,
              padding: '10px 16px', borderRadius: 12,
              background: msg.role === 'user'
                ? 'rgba(59,130,246,0.12)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : C.border}`,
              fontSize: '0.82rem', color: C.textSecondary, lineHeight: 1.6,
            }}>
              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {msg.toolCalls.map((tc, i) => <ToolChip key={i} text={tc} />)}
                </div>
              )}

              {/* Message content */}
              <div>{renderMarkdown(msg.content)}</div>

              {/* Streaming cursor */}
              {msg.isStreaming && !msg.content && (
                <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: PURPLE,
                      animation: `pulse 1.4s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          border: `1px solid ${C.border}`, padding: '8px 12px',
          transition: 'border-color 0.2s',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message Grant Manager..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: '0.85rem', fontFamily: 'inherit',
              resize: 'none', maxHeight: 150, lineHeight: 1.5,
            }}
          />
          {isStreaming ? (
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(239,68,68,0.15)', border: `1px solid rgba(239,68,68,0.3)`,
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                color: '#ef4444', fontSize: '0.75rem', fontWeight: 600,
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? PURPLE : 'rgba(139,92,246,0.3)',
                border: 'none', borderRadius: 8, padding: '6px 14px',
                cursor: input.trim() ? 'pointer' : 'default',
                color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                fontFamily: 'inherit', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
