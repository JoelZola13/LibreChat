/**
 * DraftList — Displays existing draft articles with edit/delete actions.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGlassStyles } from '../../shared/useGlassStyles';
import { SB_API_BASE } from '../../shared/apiConfig';
import { Edit3, Trash2, RefreshCw, FileText, Clock } from 'lucide-react';
import { formatDate } from '../newsConstants';
import type { Article } from '../newsTypes';

const CATEGORY_COLORS: Record<string, string> = {
  Local: '#3b82f6',
  National: '#22c55e',
  International: '#a855f7',
  'Street Voices': '#f59e0b',
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface DraftListProps {
  drafts: Article[];
  loading: boolean;
  onRefresh: () => void;
}

export default function DraftList({ drafts, loading, onRefresh }: DraftListProps) {
  const navigate = useNavigate();
  const { colors: themeColors, glassCard } = useGlassStyles();

  // Always dark colors (dashboard has dark background)
  const colors = {
    ...themeColors,
    text: '#fff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(255, 255, 255, 0.15)',
    surface: 'rgba(255, 255, 255, 0.08)',
    surfaceHover: 'rgba(255, 255, 255, 0.12)',
    accent: '#FFD600',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.15)',
    success: '#22c55e',
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 404) {
        onRefresh();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '0 4px',
        }}
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
          }}
        >
          <FileText size={20} style={{ color: colors.accent }} />
          Your Drafts
          {drafts.length > 0 && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: colors.textMuted,
                background: colors.surface,
                padding: '2px 10px',
                borderRadius: '12px',
              }}
            >
              {drafts.length}
            </span>
          )}
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '10px',
            padding: '6px 12px',
            color: colors.textSecondary,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontFamily: 'Rubik, sans-serif',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Draft List */}
      <div
        style={{
          ...glassCard,
          borderRadius: '20px',
          overflow: 'hidden',
        }}
      >
        {loading && drafts.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textMuted,
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
            }}
          >
            Loading drafts...
          </div>
        ) : drafts.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textMuted,
              fontFamily: 'Rubik, sans-serif',
              fontSize: '14px',
            }}
          >
            No drafts yet. Use the columns above to start drafting articles.
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            {drafts.map((draft) => {
              const catColor = CATEGORY_COLORS[draft.category || ''] || colors.textMuted;
              return (
                <motion.div
                  key={draft.id}
                  variants={staggerItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 20px',
                    borderBottom: `1px solid ${colors.border}`,
                    transition: 'background 0.15s',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/news/editor/${draft.id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Category Badge */}
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'Rubik, sans-serif',
                      color: '#fff',
                      background: catColor,
                      minWidth: '75px',
                      textAlign: 'center',
                    }}
                  >
                    {draft.category || 'Uncategorized'}
                  </span>

                  {/* Title + Excerpt */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'Rubik, sans-serif',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: colors.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {draft.title}
                    </div>
                    {draft.excerpt && (
                      <div
                        style={{
                          fontFamily: 'Rubik, sans-serif',
                          fontSize: '12px',
                          color: colors.textMuted,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {draft.excerpt}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <span
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: colors.textMuted,
                      fontFamily: 'Rubik, sans-serif',
                    }}
                  >
                    <Clock size={11} />
                    {formatDate(draft.published_at) || 'Just now'}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/news/editor/${draft.id}`);
                      }}
                      title="Edit draft"
                      style={{
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '6px 10px',
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontFamily: 'Rubik, sans-serif',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.accent;
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = colors.surface;
                        e.currentTarget.style.color = colors.textSecondary;
                      }}
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft.id);
                      }}
                      title="Delete draft"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '6px',
                        color: colors.textMuted,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.errorBg;
                        e.currentTarget.style.color = colors.error;
                        e.currentTarget.style.borderColor = colors.error;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = colors.textMuted;
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
