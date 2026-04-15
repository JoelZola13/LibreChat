/**
 * NewsDashboard — Article generation and management dashboard.
 * Route: /news/dashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGlassStyles } from '../../shared/useGlassStyles';
import { GlassBackground } from '../../shared/GlassBackground';
import { SB_API_BASE } from '../../shared/apiConfig';
import {
  ArrowLeft,
  Loader2,
  Layers,
  Sparkles,
  PenLine,
  Send,
  ChevronDown,
} from 'lucide-react';
import DraftList from './DraftList';
import type { Article } from '../newsTypes';

const ARTICLE_TYPES = [
  'Entertainment',
  'Film',
  'Health',
  'Economy',
  'Housing',
  'Community',
  'Culture',
  'Education',
  'Technology',
  'Environment',
  'Sports',
  'Politics',
] as const;

export default function NewsDashboard() {
  const { colors: themeColors } = useGlassStyles();

  // Always use dark colors since dashboard has dark background (#0C0A09)
  const colors = {
    ...themeColors,
    text: '#fff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.15)',
    borderHover: 'rgba(255, 255, 255, 0.25)',
    surface: 'rgba(255, 255, 255, 0.08)',
    surfaceHover: 'rgba(255, 255, 255, 0.12)',
    accent: '#FFD600',
    accentGlow: 'rgba(255, 214, 0, 0.4)',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    glassShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.15)',
  };

  const [drafts, setDrafts] = useState<Article[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);

  // Daily generation with progress tracking
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(3);
  const [progressPhase, setProgressPhase] = useState('');
  const [progressLog, setProgressLog] = useState<string[]>([]);

  // Custom article generator
  const [customType, setCustomType] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`${SB_API_BASE}/news/articles?status=draft&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const articles: Article[] = Array.isArray(data) ? data : data.articles || data.data || [];
        setDrafts(articles.filter((a: Article) => a.status === 'draft'));
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleGenerateDaily = async () => {
    setGenerating(true);
    setGenerateMessage('Starting article generation...');
    setProgressStep(0);
    setProgressTotal(3);
    setProgressPhase('');
    setProgressLog([]);

    try {
      const res = await fetch(`${SB_API_BASE}/news/generate-daily`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setProgressStep(data.step || 0);
            setProgressTotal(data.total || 3);
            setProgressPhase(data.phase || '');
            setGenerateMessage(data.message || '');

            if (data.phase === 'done' || data.phase === 'error') {
              setProgressLog((prev) => [...prev, data.message]);
            }

            if (data.phase === 'complete') {
              fetchDrafts();
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      setGenerateMessage('All articles generated!');
    } catch (err) {
      console.error('Generate failed:', err);
      setGenerateMessage(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setTimeout(() => {
        setGenerateMessage('');
        setProgressLog([]);
        setProgressPhase('');
      }, 8000);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customTopic.trim()) {
      setCustomMessage('Please enter a topic.');
      setTimeout(() => setCustomMessage(''), 3000);
      return;
    }

    setGeneratingCustom(true);
    setCustomMessage('Generating article...');

    try {
      const res = await fetch(`${SB_API_BASE}/news/generate-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: customType || 'General',
          topic: customTopic,
          description: customDescription || undefined,
        }),
      });

      if (!res.ok) throw new Error(`Generation failed: ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      fetchDrafts();
      setCustomMessage('Article generated!');
      setCustomTopic('');
      setCustomDescription('');
    } catch (err) {
      console.error('Custom generate failed:', err);
      setCustomMessage(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGeneratingCustom(false);
      setTimeout(() => setCustomMessage(''), 5000);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: '#0C0A09' }}>
      <GlassBackground />

      <div
        className="relative z-10"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '24px 20px 60px',
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '12px',
          }}
        >
          <Link
            to="/news"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: colors.textSecondary,
              textDecoration: 'none',
              fontSize: '14px',
              fontFamily: 'Rubik, sans-serif',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textSecondary)}
          >
            <ArrowLeft size={16} />
            Back to News
          </Link>
          <h1
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              fontWeight: 800,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <Layers size={24} style={{ color: colors.accent }} />
            News Dashboard
          </h1>
        </motion.div>

        {/* Generate Daily Articles — Hero CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '32px 24px',
            marginBottom: '28px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(168,85,247,0.2)',
          }}
        >
          <button
            onClick={handleGenerateDaily}
            disabled={generating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px 40px',
              borderRadius: '16px',
              background: generating
                ? 'rgba(168,85,247,0.4)'
                : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: generating ? 'none' : '0 8px 32px rgba(168,85,247,0.4)',
              opacity: generating ? 0.8 : 1,
              cursor: generating ? 'not-allowed' : 'pointer',
              fontFamily: 'Rubik, sans-serif',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              transition: 'all 0.3s',
            }}
          >
            {generating ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Sparkles size={22} />
            )}
            {generating ? 'Generating Articles...' : 'Generate Daily Articles'}
          </button>

          {/* Status message */}
          <p
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
              color: generating ? colors.textSecondary : colors.textMuted,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {generateMessage || 'Creates 1 local, 1 national, and 1 international article automatically'}
          </p>

          {/* Progress bar + log (visible during generation) */}
          {generating && (
            <div style={{ width: '100%', maxWidth: '500px', marginTop: '8px' }}>
              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #a855f7, #7c3aed)',
                    transition: 'width 0.5s ease',
                    width: `${Math.max(
                      5,
                      ((progressStep - 1) / progressTotal) * 100 +
                        (progressPhase === 'researching' ? 5 :
                         progressPhase === 'writing' ? 15 :
                         progressPhase === 'image' ? 25 :
                         progressPhase === 'saving' ? 30 :
                         progressPhase === 'done' ? 33.3 : 0)
                    )}%`,
                  }}
                />
              </div>
              {/* Step counter */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '6px',
                  fontSize: '12px',
                  fontFamily: 'Rubik, sans-serif',
                  color: colors.textMuted,
                }}
              >
                <span>Step {progressStep} of {progressTotal}</span>
                <span style={{ textTransform: 'capitalize' }}>{progressPhase}</span>
              </div>
              {/* Activity log */}
              {progressLog.length > 0 && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {progressLog.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '12px',
                        fontFamily: 'Rubik, sans-serif',
                        color: log.includes('failed') || log.includes('timed out')
                          ? colors.error
                          : colors.success,
                        padding: '2px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{log.includes('failed') || log.includes('timed out') ? '✗' : '✓'}</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Draft List */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <DraftList
            drafts={drafts}
            loading={loadingDrafts}
            onRefresh={fetchDrafts}
          />
        </motion.div>

        {/* Custom Article Generator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ marginTop: '32px' }}
        >
          <h2
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              padding: '0 4px',
            }}
          >
            <PenLine size={20} style={{ color: colors.accent }} />
            Generate Custom Article
          </h2>
          <div
            style={{
              background: colors.cardBg,
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              borderRadius: '20px',
              border: `1px solid ${colors.border}`,
              boxShadow: colors.glassShadow,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Type selector + Topic in a row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {/* Article type dropdown */}
              <div style={{ position: 'relative', minWidth: '180px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    fontFamily: 'Rubik, sans-serif',
                    marginBottom: '6px',
                  }}
                >
                  Article Type
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 32px 10px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      background: 'rgba(0,0,0,0.3)',
                      color: colors.text,
                      fontSize: '14px',
                      fontFamily: 'Rubik, sans-serif',
                      outline: 'none',
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select type...</option>
                    {ARTICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.textMuted,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Topic */}
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    fontFamily: 'Rubik, sans-serif',
                    marginBottom: '6px',
                  }}
                >
                  Topic <span style={{ color: colors.accent }}>*</span>
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. Toronto Film Festival highlights, youth mental health programs..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.text,
                    fontSize: '14px',
                    fontFamily: 'Rubik, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Description (optional) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: colors.textMuted,
                  fontFamily: 'Rubik, sans-serif',
                  marginBottom: '6px',
                }}
              >
                Description <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Add any details, angle, or notes you want the article to cover..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  background: 'rgba(0,0,0,0.3)',
                  color: colors.text,
                  fontSize: '14px',
                  fontFamily: 'Rubik, sans-serif',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '60px',
                }}
              />
            </div>

            {/* Generate button + message */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleGenerateCustom}
                disabled={generatingCustom || !customTopic.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderRadius: '12px',
                  background: customTopic.trim()
                    ? colors.accent
                    : colors.surface,
                  color: customTopic.trim() ? '#000' : colors.textMuted,
                  border: 'none',
                  boxShadow: customTopic.trim() ? `0 4px 14px ${colors.accentGlow}` : 'none',
                  cursor: generatingCustom || !customTopic.trim() ? 'not-allowed' : 'pointer',
                  opacity: generatingCustom ? 0.7 : 1,
                  fontFamily: 'Rubik, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {generatingCustom ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {generatingCustom ? 'Generating...' : 'Generate Article'}
              </button>
              {customMessage && (
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    fontWeight: 500,
                    color: customMessage.includes('fail') || customMessage.includes('Failed')
                      ? colors.error
                      : colors.success,
                  }}
                >
                  {customMessage}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
