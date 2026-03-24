import { useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';
import { useActiveUser } from '../shared/useActiveUser';
import AuthPopupModal from '../shared/AuthPopupModal';
import { getReturnLabel, resolveReturnPath } from './returnNavigation';

const SB_API_BASE = '/sbapi';

const TAB_LABELS = ['General', 'Location', 'Contact Info', 'Social Networks', 'Media', 'Tags'] as const;

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category' },
  { value: 'Shelters', label: 'Shelters' },
  { value: 'Health', label: 'Health' },
  { value: 'Food', label: 'Food' },
  { value: 'Programs', label: 'Programs' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Employment', label: 'Employment' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Select type' },
  { value: 'Non-Profit', label: 'Non-Profit' },
  { value: 'Government', label: 'Government' },
  { value: 'Community', label: 'Community' },
  { value: 'Private', label: 'Private' },
  { value: 'Religious', label: 'Religious' },
];

const AGES_OPTIONS = ['All', 'Children', 'Youth', 'Adults', 'Seniors'];
const GENDER_OPTIONS = ['All', 'Men', 'Women', 'Non-Binary', 'LGBTQ2S+'];

const COUNTRY_OPTIONS = ['Canada', 'United States'];
const CITY_OPTIONS = [
  { value: '', label: 'Select city' },
  { value: 'Toronto', label: 'Toronto' },
  { value: 'Vancouver', label: 'Vancouver' },
  { value: 'Montreal', label: 'Montreal' },
  { value: 'Calgary', label: 'Calgary' },
  { value: 'Edmonton', label: 'Edmonton' },
  { value: 'Ottawa', label: 'Ottawa' },
  { value: 'Winnipeg', label: 'Winnipeg' },
  { value: 'Hamilton', label: 'Hamilton' },
  { value: 'London', label: 'London' },
  { value: 'Mississauga', label: 'Mississauga' },
];

const SOCIAL_NETWORK_OPTIONS = ['Facebook', 'Twitter', 'Instagram', 'LinkedIn', 'YouTube', 'TikTok'];

const TAG_OPTIONS = [
  'Aboriginal', 'Accessibility', 'Addiction', 'ADHD', 'Autism', 'Black Services',
  'Case Management', 'Children', 'Community', 'Counselling', 'Crisis', 'Cultural',
  'Dental', 'Disability', 'Drop-in', 'Education', 'Emergency', 'Employment',
  'Family', 'Food', 'Free', 'Harm Reduction', 'Health', 'Housing',
  'Immigration', 'Indigenous', 'LGBTQ2S+', 'Legal', 'Literacy', 'Men',
  'Mental Health', 'Newcomer', 'Outreach', 'Parenting', 'Peer Support', 'Recreation',
  'Referrals', 'Seniors', 'Shelter', 'Substance Use', 'Support Groups', 'Training',
  'Transit', 'Violence Prevention', 'Women', 'Youth',
];

type FormData = {
  name: string;
  description: string;
  category: string;
  type: string;
  ages_served: string;
  gender_served: string;
  address: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  website: string;
  social_networks: Array<{ network: string; url: string }>;
  thumb_image: File | null;
  gallery_images: File[];
  video_url: string;
  tags: string[];
};

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  category: '',
  type: '',
  ages_served: 'All',
  gender_served: 'All',
  address: '',
  country: 'Canada',
  city: '',
  email: '',
  phone: '',
  website: '',
  social_networks: [],
  thumb_image: null,
  gallery_images: [],
  video_url: '',
  tags: [],
};

export default function AddListingPage() {
  const { isMobile, isTablet } = useResponsive();
  const { isDark, colors } = useGlassStyles();
  const { activeUser, resolved } = useActiveUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [authOpen, setAuthOpen] = useState(false);
  const [form, setForm] = useState<FormData>({ ...INITIAL_FORM });
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Social network temp inputs
  const [socialNetwork, setSocialNetwork] = useState('Facebook');
  const [socialUrl, setSocialUrl] = useState('');

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const locationState = location.state as { returnTo?: string } | null;
  const backLinkTarget = resolveReturnPath(
    locationState?.returnTo ?? null,
    new URLSearchParams(location.search).get('returnTo'),
  );
  const backLinkLabel = getReturnLabel(backLinkTarget);

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)';
  const inputBorder = isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.12)';
  const accentColor = isDark ? '#f9d900' : '#b8960a';

  const pagePadding = isMobile ? '80px 16px 60px' : isTablet ? '90px 20px 60px' : '110px 20px 60px';

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const addSocialNetwork = useCallback(() => {
    if (!socialUrl.trim()) return;
    setForm(prev => ({
      ...prev,
      social_networks: [...prev.social_networks, { network: socialNetwork, url: socialUrl.trim() }],
    }));
    setSocialUrl('');
  }, [socialNetwork, socialUrl]);

  const removeSocialNetwork = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      social_networks: prev.social_networks.filter((_, i) => i !== index),
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  }, []);

  const handleThumbChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm(prev => ({ ...prev, thumb_image: file }));
  }, []);

  const handleGalleryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setForm(prev => ({ ...prev, gallery_images: files }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      setSubmitError('Place name is required.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category_names: form.category ? [form.category] : undefined,
        service_type: form.type.trim() || undefined,
        ages_served: form.ages_served || undefined,
        gender_served: form.gender_served || undefined,
        address: form.address.trim() || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        social_networks: form.social_networks.length > 0 ? form.social_networks : undefined,
        video_url: form.video_url.trim() || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
      };

      const res = await fetch(`${SB_API_BASE}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Server returned ${res.status}`);
      }

      const created = await res.json().catch(() => null);

      // Upload thumb image if present
      if (form.thumb_image && created?.id) {
        const fd = new FormData();
        fd.append('logo', form.thumb_image);
        await fetch(`${SB_API_BASE}/services/${created.id}/logo`, {
          method: 'POST',
          body: fd,
        }).catch(() => {/* logo upload is best-effort */});
      }

      setSubmitSuccess(true);
      if (created?.id) {
        setTimeout(() => navigate(`/directory/service/${created.id}`), 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.includes('404') || msg.includes('Not Found')) {
        setSubmitError('Listing submissions are not yet available. Your form data has been saved locally — check back soon.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate]);

  // ---------- Shared styles ----------

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: inputBorder,
    background: inputBg,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Rubik, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 6,
    fontFamily: 'Rubik, sans-serif',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  // ---------- Not logged in — sign-in prompt ----------

  if (!activeUser || !resolved) {
    return (
      <main style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: pagePadding,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: isMobile ? '32px 24px' : '48px 40px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: isDark ? 'rgba(255,214,0,0.15)' : 'rgba(255,214,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28,
          }}>
            +
          </div>
          <h1 style={{
            fontSize: isMobile ? 22 : 26, fontWeight: 700,
            margin: '0 0 12px', color: colors.text, fontFamily: 'Rubik, sans-serif',
          }}>
            Sign in to Add a Listing
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.6, margin: '0 0 28px' }}>
            You need to be signed in to add your organization or service to the Street Voices directory.
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              height: 48, padding: '0 36px', borderRadius: 50, border: 'none',
              background: '#FFD600', color: '#000', fontSize: 16, fontWeight: 700,
              fontFamily: 'Rubik, sans-serif', cursor: 'pointer', marginBottom: 16,
            }}
          >
            Sign In
          </button>
          <div>
            <Link to={backLinkTarget} style={{ color: accentColor, fontSize: 14, fontWeight: 500 }}>
              {backLinkLabel}
            </Link>
          </div>
        </div>
        <AuthPopupModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialTab="login" />
      </main>
    );
  }

  // ---------- Success state ----------

  if (submitSuccess) {
    return (
      <main style={{
        maxWidth: 900, margin: '0 auto', padding: pagePadding,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh',
      }}>
        <div style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: isMobile ? '32px 24px' : '48px 40px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28, color: '#22c55e',
          }}>
            &#10003;
          </div>
          <h2 style={{
            fontSize: 22, fontWeight: 700, textAlign: 'center',
            margin: '0 0 16px', color: colors.text, fontFamily: 'Rubik, sans-serif',
          }}>
            Listing Submitted
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 1.6 }}>
            Your listing has been submitted for review. You will be redirected shortly.
          </p>
        </div>
      </main>
    );
  }

  // ---------- Tab content renderers ----------

  const renderGeneral = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          PLACE NAME <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder="e.g. Downtown Community Shelter"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          DESCRIPTION <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Describe the services offered, hours, eligibility..."
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 12, marginBottom: 16,
      }}>
        <div>
          <label style={labelStyle}>CATEGORY</label>
          <select
            value={form.category}
            onChange={e => updateField('category', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>TYPE</label>
          <select
            value={form.type}
            onChange={e => updateField('type', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 12,
      }}>
        <div>
          <label style={labelStyle}>AGES SERVED</label>
          <select
            value={form.ages_served}
            onChange={e => updateField('ages_served', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {AGES_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>GENDER SERVED</label>
          <select
            value={form.gender_served}
            onChange={e => updateField('gender_served', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {GENDER_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );

  const renderLocation = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          PLACE ADDRESS <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={form.address}
          onChange={e => updateField('address', e.target.value)}
          placeholder="e.g. 123 Queen Street West"
          style={inputStyle}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 12,
      }}>
        <div>
          <label style={labelStyle}>COUNTRY</label>
          <select
            value={form.country}
            onChange={e => updateField('country', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {COUNTRY_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>CITY</label>
          <select
            value={form.city}
            onChange={e => updateField('city', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
          >
            {CITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );

  const renderContactInfo = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>EMAIL</label>
        <input
          type="email"
          value={form.email}
          onChange={e => updateField('email', e.target.value)}
          placeholder="contact@example.org"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>PHONE NUMBER</label>
        <input
          type="tel"
          value={form.phone}
          onChange={e => updateField('phone', e.target.value)}
          placeholder="(416) 555-0123"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>WEBSITE</label>
        <input
          type="url"
          value={form.website}
          onChange={e => updateField('website', e.target.value)}
          placeholder="https://example.org"
          style={inputStyle}
        />
      </div>
    </>
  );

  const renderSocialNetworks = () => (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr auto',
        gap: 12, alignItems: 'end', marginBottom: 16,
      }}>
        <div>
          <label style={labelStyle}>NETWORK</label>
          <select
            value={socialNetwork}
            onChange={e => setSocialNetwork(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto', minWidth: 140 }}
          >
            {SOCIAL_NETWORK_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>URL</label>
          <input
            type="url"
            value={socialUrl}
            onChange={e => setSocialUrl(e.target.value)}
            placeholder="https://facebook.com/yourpage"
            style={inputStyle}
          />
        </div>
        <button
          type="button"
          onClick={addSocialNetwork}
          style={{
            height: 42, padding: '0 24px', borderRadius: 10,
            border: 'none', background: '#FFD600', color: '#000',
            fontSize: 14, fontWeight: 700, fontFamily: 'Rubik, sans-serif',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Add
        </button>
      </div>

      {form.social_networks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.social_networks.map((sn, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 14px', borderRadius: 10,
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: colors.text, fontFamily: 'Rubik, sans-serif', minWidth: 80 }}>
                {sn.network}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: 'Rubik, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sn.url}
              </span>
              <button
                type="button"
                onClick={() => removeSocialNetwork(i)}
                style={{
                  background: 'none', border: 'none', color: '#ef4444',
                  fontSize: 13, cursor: 'pointer', padding: '4px 8px',
                  fontFamily: 'Rubik, sans-serif', fontWeight: 600,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderMedia = () => (
    <>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>THUMB IMAGE</label>
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleThumbChange}
          style={{
            ...inputStyle,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        />
        <p style={{ fontSize: 12, color: colors.textSecondary, margin: '6px 0 0', fontFamily: 'Rubik, sans-serif' }}>
          Max 1MB. JPG, PNG, or WebP recommended.
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>GALLERY IMAGES</label>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleGalleryChange}
          style={{
            ...inputStyle,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        />
        <p style={{ fontSize: 12, color: colors.textSecondary, margin: '6px 0 0', fontFamily: 'Rubik, sans-serif' }}>
          Max 1MB each. You can select multiple files.
        </p>
      </div>

      <div>
        <label style={labelStyle}>VIDEO URL</label>
        <input
          type="url"
          value={form.video_url}
          onChange={e => updateField('video_url', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          style={inputStyle}
        />
      </div>
    </>
  );

  const renderTags = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {TAG_OPTIONS.map(tag => {
        const selected = form.tags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            style={{
              padding: '8px 16px',
              borderRadius: 50,
              border: selected
                ? '2px solid #FFD600'
                : isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.12)',
              background: selected
                ? isDark ? 'rgba(255,214,0,0.15)' : 'rgba(255,214,0,0.12)'
                : 'transparent',
              color: selected ? (isDark ? '#FFD600' : '#8b6e00') : colors.text,
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );

  const tabRenderers = [renderGeneral, renderLocation, renderContactInfo, renderSocialNetworks, renderMedia, renderTags];

  // ---------- Add listing form — tabbed wizard ----------

  return (
    <main style={{
      maxWidth: 760,
      margin: '0 auto',
      padding: pagePadding,
      color: colors.text,
    }}>
      {/* Header */}
      <h1 style={{
        fontSize: isMobile ? 24 : isTablet ? 28 : 32,
        fontWeight: 700, margin: '0 0 8px', fontFamily: 'Rubik, sans-serif',
      }}>
        Add a Listing
      </h1>
      <p style={{ color: colors.textSecondary, fontSize: 15, margin: '0 0 28px', lineHeight: 1.5 }}>
        Submit a new service to the Street Voices directory.
        Fields marked with <span style={{ color: '#ef4444' }}>*</span> are required.
      </p>

      {submitError && (
        <div style={{
          background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          color: isDark ? '#fca5a5' : '#b91c1c', fontSize: 14,
        }}>
          {submitError}
        </div>
      )}

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
        marginBottom: 24,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {TAB_LABELS.map((label, i) => {
          const isActive = activeTab === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveTab(i)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid #FFD600' : '3px solid transparent',
                padding: isMobile ? '10px 12px' : '12px 20px',
                fontSize: isMobile ? 12 : 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? colors.text : colors.textSecondary,
                fontFamily: 'Rubik, sans-serif',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content — Single Glass Card */}
      <div style={{
        background: cardBg,
        border: cardBorder,
        borderRadius: 16,
        padding: isMobile ? '24px 16px' : '32px 28px',
        backdropFilter: 'blur(20px)',
        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 2px 16px rgba(0,0,0,0.04)',
        marginBottom: 24,
      }}>
        {tabRenderers[activeTab]()}
      </div>

      {/* Navigation Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: activeTab === 0 ? 'flex-end' : 'space-between',
        gap: 12,
      }}>
        {activeTab > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab(prev => prev - 1)}
            style={{
              height: 44, padding: '0 28px', borderRadius: 50,
              border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
              background: 'transparent',
              color: colors.text,
              fontSize: 15, fontWeight: 600,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
            }}
          >
            Previous
          </button>
        )}

        {activeTab < TAB_LABELS.length - 1 ? (
          <button
            type="button"
            onClick={() => setActiveTab(prev => prev + 1)}
            style={{
              height: 44, padding: '0 32px', borderRadius: 50,
              border: 'none', background: '#FFD600', color: '#000',
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              height: 44, padding: '0 32px', borderRadius: 50,
              border: 'none',
              background: submitting ? (isDark ? 'rgba(255,214,0,0.5)' : 'rgba(255,214,0,0.6)') : '#FFD600',
              color: '#000',
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Rubik, sans-serif',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Listing'}
          </button>
        )}
      </div>
    </main>
  );
}
