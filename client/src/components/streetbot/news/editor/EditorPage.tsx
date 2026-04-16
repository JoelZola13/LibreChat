/**
 * EditorPage — Page wrapper for the news block editor.
 * /news/editor → new article
 * /news/editor/:id → edit existing article
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlassStyles } from '../../shared/useGlassStyles';
import { GlassBackground } from '../../shared/GlassBackground';
import { SB_API_BASE } from '../../shared/apiConfig';
import { ArrowLeft, Save, Send, Loader2, ChevronDown, Eye, PenLine, RefreshCw, Upload, ImageIcon } from 'lucide-react';
import BlockEditor from './BlockEditor';
import type { EditorBlock } from './BlockEditor';
import { tryParseHtmlToBlocks, blocksToHtml, extractGalleryImages } from './blockConversions';

type Article = {
  id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  content_blocks?: any[];
  author?: string;
  category?: string;
  tags?: string[];
  image_url?: string;
  status?: string;
  is_featured?: boolean;
  is_breaking?: boolean;
};

const CATEGORIES = ['Street Voices', 'Local', 'National', 'International'];

export default function EditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors: themeColors } = useGlassStyles();

  // Always use dark colors since this page has a dark background
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
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.15)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.15)',
  };

  // Extract article ID from URL: /news/editor/:id
  const pathSegments = location.pathname.replace(/^\/news\/editor\/?/, '').split('/').filter(Boolean);
  const articleId = pathSegments.length > 0 ? pathSegments[0] : null;

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('Street Voices');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [seoMeta, setSeoMeta] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoHashtags, setSeoHashtags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [initialBlocks, setInitialBlocks] = useState<any[] | undefined>(undefined);
  const [rawHtmlContent, setRawHtmlContent] = useState('');
  const [loading, setLoading] = useState(!!articleId);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showMetadata, setShowMetadata] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const loadedRef = useRef(false);

  // Load existing article
  useEffect(() => {
    if (!articleId || loadedRef.current) return;
    loadedRef.current = true;

    const fetchArticle = async () => {
      try {
        // Try by slug first, then by ID
        let res = await fetch(`${SB_API_BASE}/news/articles/slug/${encodeURIComponent(articleId)}`);
        if (!res.ok && res.status === 404) {
          res = await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(articleId)}`);
        }
        if (!res.ok) throw new Error(`Article not found (HTTP ${res.status})`);
        const data: Article = await res.json();

        setTitle(data.title || '');
        setExcerpt(data.excerpt || '');
        setCategory(data.category || 'Street Voices');
        setTags((data.tags || []).join(', '));
        setImageUrl(data.image_url || '');
        setImageSource(data.image_credit || '');
        setImageCaption(data.image_caption || '');
        setSeoMeta(data.seo_meta || '');
        setSeoKeywords(data.seo_keywords || '');
        setSeoHashtags(data.seo_hashtags || '');
        setIsFeatured(data.is_featured || false);

        // Store raw HTML for preview fallback
        if (data.content) {
          setRawHtmlContent(data.content);
        }

        // Load blocks: prefer content_blocks, fall back to HTML conversion
        if (data.content_blocks && Array.isArray(data.content_blocks) && data.content_blocks.length > 0) {
          setInitialBlocks(data.content_blocks);
        } else if (data.content) {
          const parsed = tryParseHtmlToBlocks(data.content);
          setInitialBlocks(parsed);
        }
      } catch (err) {
        console.error('Failed to load article:', err);
        setSaveMessage('Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  const handleBlocksChange = useCallback((newBlocks: EditorBlock[]) => {
    setBlocks(newBlocks);
  }, []);

  const saveArticle = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      setSaveMessage('Please add a title');
      return;
    }

    const isSave = status === 'draft';
    if (isSave) setSaving(true);
    else setPublishing(true);
    setSaveMessage('');

    try {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const payload: Record<string, unknown> = {
        title,
        slug,
        excerpt: excerpt || undefined,
        category,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        image_url: imageUrl || undefined,
        image_credit: imageSource || undefined,
        image_caption: imageCaption || undefined,
        seo_meta: seoMeta || undefined,
        seo_keywords: seoKeywords || undefined,
        seo_hashtags: seoHashtags || undefined,
        is_featured: isFeatured,
        status,
        content_blocks: blocks,
      };

      if (status === 'published') {
        payload.published_at = new Date().toISOString();
      }

      let res: Response;
      if (articleId) {
        res = await fetch(`${SB_API_BASE}/news/articles/${encodeURIComponent(articleId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${SB_API_BASE}/news/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Save failed: ${res.status} ${errText}`);
      }

      const saved: Article = await res.json();
      setSaveMessage(status === 'published' ? 'Published!' : 'Draft saved!');

      // If new article, redirect to editor with ID
      if (!articleId && saved.id) {
        navigate(`/news/editor/${saved.id}`, { replace: true });
      }
    } catch (err) {
      console.error('Save failed:', err);
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <GlassBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div
            className="p-8 rounded-2xl text-center"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(24px)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: colors.accent }} />
            <p style={{ color: colors.textSecondary }}>Loading article...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: '#0C0A09' }}>
      <GlassBackground />
      <div className="relative z-10 max-w-[900px] mx-auto px-4 py-6">
        {/* Toolbar */}
        <div
          className="flex items-center gap-3 mb-6 p-3 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${colors.border}`,
          }}
        >
          <button
            onClick={() => navigate('/news/dashboard')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex-1" />

          {/* Save message */}
          {saveMessage && (
            <span
              className="text-sm px-3 py-1 rounded-lg"
              style={{
                color: saveMessage.includes('fail') || saveMessage.includes('Please')
                  ? colors.error
                  : colors.success,
                background: saveMessage.includes('fail') || saveMessage.includes('Please')
                  ? colors.errorBg
                  : colors.successBg,
              }}
            >
              {saveMessage}
            </span>
          )}

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
            }}
          >
            Metadata
            <ChevronDown
              size={14}
              style={{ transform: showMetadata ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
            />
          </button>

          <button
            onClick={() => setPreviewing(!previewing)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{
              background: previewing ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${previewing ? 'rgba(250,204,21,0.3)' : colors.border}`,
              color: previewing ? colors.accent : colors.textSecondary,
            }}
          >
            {previewing ? <PenLine size={14} /> : <Eye size={14} />}
            {previewing ? 'Edit' : 'Preview'}
          </button>

          <button
            onClick={() => saveArticle('draft')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${colors.border}`,
              color: colors.text,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>

          <button
            onClick={() => saveArticle('published')}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{
              background: colors.accent,
              color: '#000',
              border: 'none',
              boxShadow: `0 4px 14px ${colors.accentGlow}`,
              opacity: publishing ? 0.6 : 1,
            }}
          >
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publish
          </button>
        </div>

        {/* Metadata panel (collapsible) */}
        {showMetadata && (
          <div
            className="mb-6 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: 'rgba(0,0,0,0.3)',
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="community, art, events"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: 'rgba(0,0,0,0.3)',
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
                Cover Image URL
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  background: 'rgba(0,0,0,0.3)',
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  style={{ accentColor: colors.accent }}
                />
                <span className="text-sm" style={{ color: colors.textSecondary }}>
                  Featured article
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Hero cover image section */}
        <div
          className="mb-6 rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${colors.border}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Cover"
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Image caption */}
              <div style={{ padding: '8px 16px 0', borderTop: `1px solid ${colors.border}` }}>
                <input
                  type="text"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Image caption (e.g. A community shelter in downtown Toronto)"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.text,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>
              {/* Image controls bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px 10px',
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="text"
                  value={imageSource}
                  onChange={(e) => setImageSource(e.target.value)}
                  placeholder="Image source / credit..."
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.textSecondary,
                    fontSize: '12px',
                    fontFamily: 'Rubik, sans-serif',
                    fontStyle: 'italic',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    fontSize: '12px',
                    fontFamily: 'Rubik, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Upload size={12} />
                  Upload
                </button>
                <button
                  onClick={async () => {
                    setGeneratingImage(true);
                    try {
                      const searchQuery = title || 'community news article';
                      const res = await fetch(`${SB_API_BASE}/news/generate-image?query=${encodeURIComponent(searchQuery)}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.image_url) {
                          setImageUrl(data.image_url);
                          setImageSource(data.credit || '');
                        }
                      }
                    } catch (err) {
                      console.error('Image generation failed:', err);
                    } finally {
                      setGeneratingImage(false);
                    }
                  }}
                  disabled={generatingImage}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: generatingImage ? 'rgba(168,85,247,0.3)' : 'rgba(168,85,247,0.6)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    fontFamily: 'Rubik, sans-serif',
                    cursor: generatingImage ? 'not-allowed' : 'pointer',
                    opacity: generatingImage ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {generatingImage ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {generatingImage ? 'Generating...' : 'Generate New Image'}
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '40px 24px',
                color: colors.textMuted,
              }}
            >
              <ImageIcon size={32} style={{ opacity: 0.4 }} />
              <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '14px', margin: 0 }}>
                No cover image
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={14} />
                  Upload Image
                </button>
                <button
                  onClick={() => {
                    const url = prompt('Enter image URL:');
                    if (url) setImageUrl(url);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  <ImageIcon size={14} />
                  Add URL
                </button>
              </div>
            </div>
          )}
          {/* Hidden file input for uploads */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                setImageUrl(url);
                setImageSource(file.name);
              }
            }}
          />
        </div>

        {/* Category badge */}
        {category && (
          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              color: '#fff',
              background:
                category === 'Local' ? '#3b82f6' :
                category === 'National' ? '#22c55e' :
                category === 'International' ? '#a855f7' :
                '#f59e0b',
              marginBottom: '12px',
            }}
          >
            {category}
          </span>
        )}

        {/* Title */}
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title..."
          rows={1}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }}
          ref={(el) => {
            if (el && title) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: colors.text,
            fontFamily: 'Rubik, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            marginBottom: '8px',
            padding: '0',
            resize: 'none',
            overflow: 'hidden',
            wordBreak: 'break-word' as const,
          }}
        />

        {/* Excerpt */}
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Write a brief excerpt..."
          rows={2}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: colors.textSecondary,
            fontFamily: 'Rubik, sans-serif',
            fontSize: '1.125rem',
            lineHeight: 1.6,
            marginBottom: '24px',
            padding: '0',
            resize: 'none',
          }}
        />

        {/* Block Editor / Preview */}
        {previewing ? (
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${colors.border}`,
              minHeight: '400px',
              fontFamily: 'Rubik, sans-serif',
              color: colors.text,
              fontSize: '1.125rem',
              lineHeight: 1.8,
            }}
          >
            {(() => {
              const hasBlocks = blocks.length > 0 && blocks.some((b) => {
                const c = b.content;
                return b.type !== 'paragraph' || (Array.isArray(c) && c.length > 0 && c.some((item: any) => item.text));
              });
              const previewHtml = hasBlocks ? blocksToHtml(blocks as any) : rawHtmlContent;
              return previewHtml ? (
                <div
                  className="news-article-prose"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  style={{ wordBreak: 'break-word' }}
                />
              ) : (
                <p style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: '80px' }}>
                  Start writing to see a preview...
                </p>
              );
            })()}
          </div>
        ) : (
          <BlockEditor
            initialBlocks={initialBlocks}
            onChange={handleBlocksChange}
            editable={true}
          />
        )}

        {/* SEO Section */}
        {(seoMeta || seoKeywords || seoHashtags || articleId) && (
          <div
            className="mt-8 p-5 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${colors.border}`,
            }}
          >
            <h3
              style={{
                fontFamily: 'Rubik, sans-serif',
                fontSize: '14px',
                fontWeight: 700,
                color: colors.accent,
                marginBottom: '16px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              SEO & Social
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Meta Description */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    fontFamily: 'Rubik, sans-serif',
                    marginBottom: '4px',
                  }}
                >
                  <span>Meta Description</span>
                  <span style={{ color: seoMeta.length > 150 ? colors.error : colors.textMuted }}>
                    {seoMeta.length}/150
                  </span>
                </label>
                <textarea
                  value={seoMeta}
                  onChange={(e) => setSeoMeta(e.target.value)}
                  placeholder="140-150 character description for search engines..."
                  rows={2}
                  maxLength={160}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.text,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Keywords */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    fontFamily: 'Rubik, sans-serif',
                    marginBottom: '4px',
                  }}
                >
                  Keywords
                </label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="housing, toronto, policy, community, advocacy..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.text,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Hashtags */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.textMuted,
                    fontFamily: 'Rubik, sans-serif',
                    marginBottom: '4px',
                  }}
                >
                  Hashtags
                </label>
                <input
                  type="text"
                  value={seoHashtags}
                  onChange={(e) => setSeoHashtags(e.target.value)}
                  placeholder="#StreetVoices #Toronto #Community..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    background: 'rgba(0,0,0,0.3)',
                    color: colors.text,
                    fontSize: '13px',
                    fontFamily: 'Rubik, sans-serif',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div style={{ height: '100px' }} />
      </div>

      {/* Prose styles for preview (matches NewsPage article rendering) */}
      <style>{`
        .news-article-prose h1,
        .news-article-prose h2,
        .news-article-prose h3,
        .news-article-prose h4 {
          font-family: Rubik, sans-serif;
          font-weight: 600;
          line-height: 1.3;
          margin-top: 2em;
          margin-bottom: 0.75em;
        }
        .news-article-prose h1 { font-size: 2rem; }
        .news-article-prose h2 { font-size: 1.625rem; }
        .news-article-prose h3 { font-size: 1.375rem; }
        .news-article-prose h4 { font-size: 1.125rem; }
        .news-article-prose p {
          margin-bottom: 1.5em;
        }
        .news-article-prose a {
          color: #FACC15;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .news-article-prose a:hover {
          color: #FDE68A;
        }
        .news-article-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 2em 0;
        }
        .news-article-prose blockquote {
          border-left: 3px solid #FACC15;
          padding-left: 1.25em;
          margin: 1.5em 0;
          font-style: italic;
          opacity: 0.85;
        }
        .news-article-prose ul,
        .news-article-prose ol {
          padding-left: 1.5em;
          margin-bottom: 1.5em;
        }
        .news-article-prose li {
          margin-bottom: 0.5em;
        }
        .news-article-prose ul li { list-style: disc; }
        .news-article-prose ol li { list-style: decimal; }
        .news-article-prose pre {
          background: rgba(0,0,0,0.4);
          border-radius: 8px;
          padding: 1em;
          overflow-x: auto;
          margin: 1.5em 0;
          font-size: 0.875rem;
        }
        .news-article-prose code {
          background: rgba(0,0,0,0.3);
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .news-article-prose pre code {
          background: none;
          padding: 0;
        }
        .news-article-prose hr {
          border: none;
          height: 1px;
          background: rgba(255,255,255,0.1);
          margin: 2em 0;
        }
        .news-article-prose figure {
          margin: 2em 0;
        }
        .news-article-prose figure img {
          border-radius: 12px;
          width: 100%;
        }
        .news-article-prose figcaption {
          text-align: center;
          font-size: 0.875rem;
          opacity: 0.6;
          margin-top: 0.5em;
        }
        .news-article-prose figure.editorial-wide {
          margin-left: -60px;
          margin-right: -60px;
        }
        @media (max-width: 768px) {
          .news-article-prose figure.editorial-wide {
            margin-left: 0;
            margin-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
