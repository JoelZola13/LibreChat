import React, { useState, useCallback, useRef } from 'react';
import { DEFAULT_COLORS } from '../tasks/constants';
import { sbFetch } from '../shared/sbFetch';
import type { GrantSection } from './grantSections';
import type { GrantOpportunity, PipelineStage } from './grantTypes';

const C = DEFAULT_COLORS;
const PURPLE = '#8b5cf6';

interface Props {
  onCreated: (grant: GrantOpportunity, sections: GrantSection[]) => void;
  onClose: () => void;
}

type ModalStep = 'url' | 'extracting' | 'needs_login' | 'browser_open' | 'extracting_portal';

export default function NewGrantModal({ onCreated, onClose }: Props) {
  const [grantUrl, setGrantUrl] = useState('');
  const [step, setStep] = useState<ModalStep>('url');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Common prompt builder
  const buildExtractionPrompt = (url: string, isPortalExtraction: boolean) => {
    const portalInstructions = isPortalExtraction
      ? `IMPORTANT: The user has already logged into the grant portal in the Playwright browser.
The browser should already be on the portal page. Use browser_snapshot to read the current page.
Navigate through ALL pages/tabs of the application form using browser_click.
Take a browser_snapshot of EACH page to capture every question.
Look for tabs, sections, "Next" buttons, and multi-page forms.
Do NOT try to log in — the user already did that.`
      : `STRATEGY — try these in order:
1. Use web_fetch on the URL to get the page content
2. If that doesn't have the full application questions, search for the grant guidelines PDF or application guide using web_search
3. If you find linked pages (FAQ, guidelines PDF, eligibility page), fetch those too
4. If the application questions are NOT on the public page, search for "{grant name} application questions PDF", "{grant name} sample application", "{grant name} guidelines"
5. Use the Playwright browser tools (browser_navigate, browser_snapshot) to navigate the grant page and explore every link
6. Do whatever it takes to find EVERY question in the application

If you determine the actual application form is behind a login portal, return this special JSON:
{"needs_login": true, "portal_url": "https://the-portal-url.com", "grant_name": "Name", "funder": "Funder"}`;

    return `Go to this grant URL and pull ALL the details, guidelines, eligibility criteria, application questions, and requirements: ${url}

${portalInstructions}

Then structure EVERYTHING you find into a JSON format for our grant writing tool.

Return ONLY a JSON object with this exact structure:
{
  "grant": {
    "name": "Grant Name",
    "funder": "Funder Organization",
    "funderAbbrev": "SHORT",
    "amount": "Up to $X per year for N years",
    "deadline": "Date (type of deadline)",
    "url": "${url}",
    "stage": "identified"
  },
  "sections": [
    {
      "id": "section-slug",
      "title": "Section Title",
      "description": "What this section covers",
      "icon": "emoji",
      "questions": [
        {
          "id": "question-slug",
          "label": "The exact question from the grant application",
          "type": "short|long|select",
          "options": ["Option 1", "Option 2"],
          "required": true,
          "hint": "Any guidance the grant provides for this question",
          "wordLimit": 300
        }
      ]
    }
  ]
}

CRITICAL RULES:
- Fetch the actual grant page first — do NOT guess at questions
- Extract EVERY question from the application, including eligibility checks, narrative questions, budget sections, and reporting requirements
- Group into 5-10 logical sections
- Use "short" for names/numbers/dates, "long" for paragraphs/narratives, "select" for multiple choice with the EXACT options listed
- Include word/character limits where specified
- Include all hints and guidance notes the funder provides
- Be thorough — this builds the entire application form
- If the grant specifies budget categories, include a "Budget" section with questions for each budget line item
- If there's a project plan/timeline requirement, include that as a section too`;
  };

  // Stream response from agent and parse
  const runExtraction = useCallback(async (prompt: string, onNeedsLogin: (url: string) => void) => {
    const controller = new AbortController();
    controllerRef.current = controller;

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
            if (content) {
              fullContent += content;
              if (content.includes('⏳')) {
                setProgress(content.replace(/⏳\s*/g, '').trim());
              }
            }
          } catch { /* skip */ }
        }
        boundary = buffer.indexOf('\n');
      }
    }
    reader.releaseLock();

    // Extract JSON
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract structured data. The page may have unusual formatting.');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Check if needs login
    if (parsed.needs_login && parsed.portal_url) {
      onNeedsLogin(parsed.portal_url);
      return null;
    }

    if (!parsed.grant || !parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid response — missing grant info or sections.');
    }

    return parsed;
  }, []);

  // Parse extracted data into grant + sections
  const parseGrantData = useCallback((parsed: Record<string, unknown>) => {
    const grant: GrantOpportunity = {
      id: `grant-${Date.now()}`,
      name: String((parsed.grant as Record<string, unknown>)?.name || 'New Grant'),
      funder: String((parsed.grant as Record<string, unknown>)?.funder || 'Unknown Funder'),
      funderAbbrev: (parsed.grant as Record<string, unknown>)?.funderAbbrev ? String((parsed.grant as Record<string, unknown>).funderAbbrev) : undefined,
      amount: (parsed.grant as Record<string, unknown>)?.amount ? String((parsed.grant as Record<string, unknown>).amount) : undefined,
      deadline: (parsed.grant as Record<string, unknown>)?.deadline ? String((parsed.grant as Record<string, unknown>).deadline) : undefined,
      url: String((parsed.grant as Record<string, unknown>)?.url || grantUrl.trim()),
      stage: (String((parsed.grant as Record<string, unknown>)?.stage || 'identified') as PipelineStage),
      documents: { opportunity: true, narrative: false, budget: false, projectPlan: false },
    };

    const sections: GrantSection[] = (parsed.sections as Record<string, unknown>[]).map((s) => ({
      id: String(s.id || `section-${Math.random().toString(36).slice(2)}`),
      title: String(s.title || 'Untitled Section'),
      description: s.description ? String(s.description) : undefined,
      icon: String(s.icon || '📋'),
      part: 'grant' as const,
      questions: Array.isArray(s.questions) ? (s.questions as Record<string, unknown>[]).map((q) => ({
        id: String(q.id || `q-${Math.random().toString(36).slice(2)}`),
        label: String(q.label || 'Question'),
        type: (['short', 'long', 'select'].includes(String(q.type)) ? String(q.type) : 'long') as 'short' | 'long' | 'select',
        options: Array.isArray(q.options) ? q.options.map(String) : undefined,
        answer: '',
        required: Boolean(q.required),
        hint: q.hint ? String(q.hint) : undefined,
        wordLimit: typeof q.wordLimit === 'number' ? q.wordLimit : undefined,
      })) : [],
    }));

    return { grant, sections };
  }, [grantUrl]);

  // Step 1: Initial extraction (public page)
  const handleExtract = useCallback(async () => {
    if (!grantUrl.trim()) {
      setError('Paste the grant URL.');
      return;
    }

    setStep('extracting');
    setError(null);
    setProgress('Fetching grant page...');

    try {
      const prompt = buildExtractionPrompt(grantUrl.trim(), false);
      const result = await runExtraction(prompt, (loginUrl) => {
        setPortalUrl(loginUrl);
        setStep('needs_login');
        setProgress('');
      });

      if (result) {
        setProgress('Building grant application form...');
        const { grant, sections } = parseGrantData(result);

        if (sections.length === 0) {
          throw new Error('No questions extracted. The grant page might require login.');
        }

        const totalQ = sections.reduce((sum, s) => sum + s.questions.length, 0);
        setProgress(`Found ${sections.length} sections, ${totalQ} questions`);
        onCreated(grant, sections);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStep('url');
    }
  }, [grantUrl, runExtraction, parseGrantData, onCreated]);

  // Step 2: Open browser for login
  const handleOpenBrowser = useCallback(async () => {
    setStep('browser_open');
    setProgress('Opening browser...');
    setError(null);

    try {
      // Tell agent to open Playwright browser to the portal URL
      const url = portalUrl || grantUrl.trim();
      const resp = await sbFetch('/sbapi/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'agent/grant_manager',
          messages: [{ role: 'user', content: `Use browser_navigate to open this URL in the Playwright browser: ${url}\nThen take a browser_screenshot so the user can see the page.\nDo NOT try to fill in any login credentials. Just navigate to the page and stop.` }],
          stream: true,
        }),
      });

      if (!resp.ok) throw new Error(`API error ${resp.status}`);

      // Just consume the stream — we don't need the output
      const reader = resp.body!.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      reader.releaseLock();

      setProgress('Browser is open — log in now, then click "I\'m Logged In"');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open browser');
      setStep('needs_login');
    }
  }, [portalUrl, grantUrl]);

  // Step 3: User confirms login, extract from portal
  const handleLoggedIn = useCallback(async () => {
    setStep('extracting_portal');
    setProgress('Reading application form from portal...');
    setError(null);

    try {
      const prompt = buildExtractionPrompt(portalUrl || grantUrl.trim(), true);
      const result = await runExtraction(prompt, () => {
        // Shouldn't happen in portal mode, but handle anyway
        setError('Still can\'t access the form. Make sure you\'re logged in and on the application page.');
        setStep('browser_open');
      });

      if (result) {
        setProgress('Building grant application form...');
        const { grant, sections } = parseGrantData(result);

        if (sections.length === 0) {
          throw new Error('No questions found in the portal. Navigate to the application form and try again.');
        }

        const totalQ = sections.reduce((sum, s) => sum + s.questions.length, 0);
        setProgress(`Found ${sections.length} sections, ${totalQ} questions`);
        onCreated(grant, sections);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Portal extraction failed');
      setStep('browser_open');
    }
  }, [portalUrl, grantUrl, runExtraction, parseGrantData, onCreated]);

  const handleCancel = useCallback(() => {
    controllerRef.current?.abort();
    onClose();
  }, [onClose]);

  const isWorking = step === 'extracting' || step === 'extracting_portal';

  return (
    <>
      <div onClick={handleCancel} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1001, width: 520,
        background: '#1a1a24', borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${PURPLE}, rgba(79,70,229,0.8))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
            }}>
              {step === 'needs_login' || step === 'browser_open' ? '🔐' : '✨'}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: C.text }}>
                {step === 'needs_login' ? 'Login Required' :
                 step === 'browser_open' ? 'Log In to Portal' :
                 'Add New Grant'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: C.textMuted }}>
                {step === 'needs_login'
                  ? 'This grant application is behind a login portal'
                  : step === 'browser_open'
                  ? 'Log in with your credentials, then confirm below'
                  : 'Paste the grant URL — AI extracts all questions automatically'}
              </p>
            </div>
          </div>

          {/* URL Input — shown in url step */}
          {step === 'url' && (
            <div style={{ marginBottom: 20 }}>
              <input
                type="url"
                value={grantUrl}
                onChange={e => setGrantUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleExtract(); }}
                placeholder="https://example.com/grants/..."
                autoFocus
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          )}

          {/* Needs Login — explain and offer browser */}
          {step === 'needs_login' && (
            <div style={{
              padding: '16px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)',
            }}>
              <div style={{ fontSize: '0.82rem', color: '#eab308', fontWeight: 600, marginBottom: 6 }}>
                🔒 Grant portal detected
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.6 }}>
                The application questions are on a portal that requires login.
                We'll open a browser window — <strong style={{ color: C.text }}>you log in yourself</strong>, then
                click "I'm Logged In" and the AI will read all the questions from the portal.
              </p>
              {portalUrl && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)', fontSize: '0.7rem',
                  color: C.textMuted, wordBreak: 'break-all',
                }}>
                  📍 {portalUrl}
                </div>
              )}
            </div>
          )}

          {/* Browser Open — waiting for user to log in */}
          {step === 'browser_open' && (
            <div style={{
              padding: '16px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 600, marginBottom: 6 }}>
                🌐 Browser is open
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.6 }}>
                A Chromium window should have popped up. <strong style={{ color: C.text }}>Log in with your credentials</strong> and
                navigate to the grant application form. Once you can see the application questions, click the button below.
              </p>
              <div style={{
                marginTop: 12, padding: '10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', fontSize: '0.7rem', color: C.textMuted,
              }}>
                <strong>Tips:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 16, lineHeight: 1.8 }}>
                  <li>Make sure you're on the actual application form page</li>
                  <li>If the form has multiple pages/tabs, start from the first one</li>
                  <li>The AI will navigate through all pages automatically</li>
                </ul>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: '0.75rem',
            }}>
              {error}
            </div>
          )}

          {/* Progress */}
          {isWorking && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
              color: PURPLE, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
              {progress || 'Working...'}
            </div>
          )}

          {/* Actions — change based on step */}
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 'url' && (
              <button
                onClick={handleExtract}
                disabled={!grantUrl.trim()}
                style={{
                  flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                  background: !grantUrl.trim() ? 'rgba(139,92,246,0.3)' : PURPLE,
                  color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                  cursor: !grantUrl.trim() ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                ✨ Extract Grant
              </button>
            )}

            {step === 'extracting' && (
              <button disabled style={{
                flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                background: 'rgba(139,92,246,0.3)', color: '#fff', fontSize: '0.88rem',
                fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>●</span> Extracting...
              </button>
            )}

            {step === 'needs_login' && (
              <button
                onClick={handleOpenBrowser}
                style={{
                  flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                  background: '#eab308', color: '#000', fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                🌐 Open Browser to Log In
              </button>
            )}

            {step === 'browser_open' && (
              <button
                onClick={handleLoggedIn}
                style={{
                  flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                  background: '#22c55e', color: '#000', fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                ✓ I'm Logged In — Extract Questions
              </button>
            )}

            {step === 'extracting_portal' && (
              <button disabled style={{
                flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                background: 'rgba(34,197,94,0.3)', color: '#fff', fontSize: '0.88rem',
                fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ animation: 'pulse 1.5s infinite' }}>●</span> Reading portal...
              </button>
            )}

            <button
              onClick={handleCancel}
              style={{
                padding: '13px 20px', borderRadius: 10,
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textMuted, fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </>
  );
}
