/**
 * DraftColumn — A single drafting column for one article category.
 * Used in the News Dashboard to draft Local, National, and International articles simultaneously.
 */
import { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useGlassStyles } from '../../shared/useGlassStyles';
import { SB_API_BASE } from '../../shared/apiConfig';
import { Save, Loader2, Trash2, ImagePlus } from 'lucide-react';
import BlockEditor from '../editor/BlockEditor';
import type { EditorBlock } from '../editor/BlockEditor';
import type { Article } from '../newsTypes';

const CATEGORY_COLORS: Record<string, string> = {
  Local: '#3b82f6',
  National: '#22c55e',
  International: '#a855f7',
};

export interface DraftColumnHandle {
  save: () => Promise<Article | null>;
  hasContent: () => boolean;
  loadDraft: (article: Article) => void;
}

interface DraftColumnProps {
  category: string;
  onSaved: (article: Article) => void;
}

const DraftColumn = forwardRef<DraftColumnHandle, DraftColumnProps>(
  function DraftColumn({ category, onSaved }, ref) {
    const { colors: themeColors, glassInput } = useGlassStyles();

    // Always dark colors (dashboard has dark background)
    const colors = {
      ...themeColors,
      text: '#fff',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(255, 255, 255, 0.15)',
      borderHover: 'rgba(255, 255, 255, 0.25)',
      surface: 'rgba(255, 255, 255, 0.08)',
      accent: '#FFD600',
      accentGlow: 'rgba(255, 214, 0, 0.4)',
      cardBg: 'rgba(255, 255, 255, 0.06)',
      glassShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      error: '#ef4444',
      success: '#22c55e',
    };

    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [showImageInput, setShowImageInput] = useState(false);
    const [blocks, setBlocks] = useState<EditorBlock[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [editorKey, setEditorKey] = useState(0);

    const hasContent = useCallback(() => {
      return title.trim().length > 0;
    }, [title]);

    const handleBlocksChange = useCallback((newBlocks: EditorBlock[]) => {
      setBlocks(newBlocks);
    }, []);

    const save = useCallback(async (): Promise<Article | null> => {
      if (!title.trim()) return null;

      setSaving(true);
      setMessage('');

      try {
        const slug =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') +
          '-' +
          Date.now().toString(36);

        const payload = {
          title,
          slug,
          excerpt: excerpt || undefined,
          category,
          tags: [category.toLowerCase()],
          image_url: imageUrl || undefined,
          status: 'draft',
          content_blocks: blocks,
        };

        const res = await fetch(`${SB_API_BASE}/news/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Save failed: ${res.status} ${errText}`);
        }

        const saved: Article = await res.json();
        setMessage('Saved!');
        onSaved(saved);

        // Reset form
        setTitle('');
        setExcerpt('');
        setImageUrl('');
        setBlocks([]);
        setShowImageInput(false);
        setEditorKey((k) => k + 1);

        setTimeout(() => setMessage(''), 2000);
        return saved;
      } catch (err) {
        console.error('Save failed:', err);
        setMessage(err instanceof Error ? err.message : 'Save failed');
        return null;
      } finally {
        setSaving(false);
      }
    }, [title, excerpt, imageUrl, blocks, category, onSaved]);

    const loadDraft = useCallback((article: Article) => {
      setTitle(article.title || '');
      setExcerpt(article.excerpt || '');
      setImageUrl(article.image_url || article.feature_image_url || '');
      if (article.image_url || article.feature_image_url) {
        setShowImageInput(true);
      }
      // If there's markdown content but no blocks, convert to a single text block
      if (article.content && (!article.content_blocks || article.content_blocks.length === 0)) {
        setBlocks([{ id: crypto.randomUUID(), type: 'text', content: article.content }] as EditorBlock[]);
      } else if (article.content_blocks && article.content_blocks.length > 0) {
        setBlocks(article.content_blocks as EditorBlock[]);
      }
      setEditorKey((k) => k + 1);
    }, []);

    useImperativeHandle(ref, () => ({ save, hasContent, loadDraft }), [save, hasContent, loadDraft]);

    const clearForm = () => {
      setTitle('');
      setExcerpt('');
      setImageUrl('');
      setBlocks([]);
      setShowImageInput(false);
      setMessage('');
      setEditorKey((k) => k + 1);
    };

    const categoryColor = CATEGORY_COLORS[category] || colors.accent;

    return (
      <div
        style={{
          background: colors.cardBg,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '20px',
          border: `1px solid ${colors.border}`,
          boxShadow: colors.glassShadow,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Category Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              color: '#fff',
              background: categoryColor,
              boxShadow: `0 2px 8px ${categoryColor}66`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fff',
              }}
            />
            {category}
          </span>
          <button
            onClick={clearForm}
            title="Clear form"
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textMuted,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.error)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Form Fields */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {/* Title */}
          <input
            type="text"
            placeholder="Article title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              ...glassInput,
              padding: '10px 14px',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              width: '100%',
            }}
          />

          {/* Excerpt */}
          <textarea
            placeholder="Short excerpt or summary..."
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            style={{
              ...glassInput,
              padding: '10px 14px',
              fontSize: '13px',
              fontFamily: 'Rubik, sans-serif',
              resize: 'vertical',
              minHeight: '52px',
              width: '100%',
            }}
          />

          {/* Image URL (collapsible) */}
          {!showImageInput ? (
            <button
              onClick={() => setShowImageInput(true)}
              style={{
                background: 'transparent',
                border: `1px dashed ${colors.border}`,
                borderRadius: '10px',
                padding: '8px',
                color: colors.textMuted,
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.borderHover;
                e.currentTarget.style.color = colors.textSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.color = colors.textMuted;
              }}
            >
              <ImagePlus size={14} />
              Add cover image URL
            </button>
          ) : (
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{
                ...glassInput,
                padding: '8px 12px',
                fontSize: '12px',
                fontFamily: 'Rubik, sans-serif',
                width: '100%',
              }}
            />
          )}

          {/* Block Editor (compact) */}
          <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '16px' }}>
            <BlockEditor key={editorKey} onChange={handleBlocksChange} />
          </div>
        </div>

        {/* Footer: Save + Message */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          {message && (
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'Rubik, sans-serif',
                color: message.includes('fail') || message.includes('Failed') ? colors.error : colors.success,
              }}
            >
              {message}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => save()}
            disabled={saving || !title.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              border: 'none',
              cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              background: title.trim() ? colors.accent : colors.surface,
              color: title.trim() ? '#000' : colors.textMuted,
              boxShadow: title.trim() ? `0 4px 14px ${colors.accentGlow}` : 'none',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
        </div>
      </div>
    );
  },
);

export default DraftColumn;
